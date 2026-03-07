"""
compare.py
----------
Upload & Compare pipeline for the AI Test Case Generator.

Stages
------
  1  Upload    — handled by the FastAPI endpoint (multipart UploadFile)
  2  Normalize — parse CSV / JSON / plain-text  ->  list[NormalizedCase]
  3  Map       — assign each NormalizedCase to a project feature
  4  Retrieve  — load AI-generated test cases from the DB (done in main.py)
  5  Embed     — vectorise all texts via OpenAI text-embedding-3-small
  6  Match     — cosine similarity -> matched / AI-only / manual-only / redundant
  7  Report    — assemble the structured gap report dict
"""

import csv
import io
import json
import math
from dataclasses import dataclass
from typing import Optional

# ---------------------------------------------------------------------------
# Thresholds
# ---------------------------------------------------------------------------

MATCH_THRESHOLD     = 0.70   # manual <-> AI similarity to count as "matched"
NEAR_MISS_THRESHOLD = 0.52   # manual <-> AI similarity to flag as a near-miss (same scenario, different wording)
REDUNDANT_THRESHOLD = 0.88   # manual <-> manual similarity to flag as redundant
FEATURE_MAP_MIN_SIM = 0.52   # minimum similarity to assign a case to any feature


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class NormalizedCase:
    """A single test case extracted and normalised from the uploaded file."""
    raw_id: str
    title: str
    description: str
    steps: str
    expected_result: str
    hinted_feature: str   # value from the 'feature'/'module' column; may be ""

    @property
    def full_text(self) -> str:
        parts = [self.title, self.description, self.steps, self.expected_result]
        return " | ".join(p for p in parts if p.strip())

    @property
    def display_title(self) -> str:
        return self.title if self.title.strip() else f"Case #{self.raw_id}"


# ---------------------------------------------------------------------------
# Stage 2 - Normalize
# ---------------------------------------------------------------------------

def _find_col(headers: list, *candidates: str) -> Optional[str]:
    """Return the first header that case-insensitively matches any candidate."""
    lower_map = {h.lower().strip(): h for h in headers}
    for c in candidates:
        if c.lower() in lower_map:
            return lower_map[c.lower()]
    return None


def parse_uploaded_file(filename: str, content: bytes) -> list:
    """
    Stage 2 - Normalize.

    Parse an uploaded file into NormalizedCase objects.

    Supported formats
    -----------------
    CSV  -- flexible column detection: title/name/test_case, description/desc,
            steps/test_steps, expected_result/expected, feature/module/requirement.
    JSON -- array of objects with the same flexible key names.
    Plain text -- one test-case title per non-empty line (fallback).
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    # JSON
    if ext == "json":
        raw = json.loads(content.decode("utf-8", errors="replace"))
        rows = raw if isinstance(raw, list) else [raw]
        cases = []
        for i, row in enumerate(rows):
            cases.append(NormalizedCase(
                raw_id          = str(row.get("id", i)),
                title           = str(row.get("title") or row.get("name") or row.get("test_case") or "").strip(),
                description     = str(row.get("description") or row.get("desc") or row.get("summary") or "").strip(),
                steps           = str(row.get("steps") or row.get("test_steps") or "").strip(),
                expected_result = str(row.get("expected_result") or row.get("expected") or row.get("expected_output") or "").strip(),
                hinted_feature  = str(row.get("feature") or row.get("module") or row.get("requirement") or row.get("component") or "").strip(),
            ))
        return [c for c in cases if c.full_text.strip()]

    # CSV
    if ext == "csv":
        text    = content.decode("utf-8-sig", errors="replace")
        reader  = csv.DictReader(io.StringIO(text))
        headers = list(reader.fieldnames or [])

        col_title    = _find_col(headers, "title", "name", "test_case", "test case", "testcase", "test name")
        col_desc     = _find_col(headers, "description", "desc", "summary", "detail")
        col_steps    = _find_col(headers, "steps", "test_steps", "test steps", "procedure", "action")
        col_expected = _find_col(headers, "expected_result", "expected result", "expected", "expected_output", "pass criteria")
        col_feature  = _find_col(headers, "feature", "module", "requirement", "component", "area", "category")

        cases = []
        for i, row in enumerate(reader):
            cases.append(NormalizedCase(
                raw_id          = str(i),
                title           = (row.get(col_title, "") or "").strip()    if col_title    else "",
                description     = (row.get(col_desc, "") or "").strip()     if col_desc     else "",
                steps           = (row.get(col_steps, "") or "").strip()    if col_steps    else "",
                expected_result = (row.get(col_expected, "") or "").strip() if col_expected else "",
                hinted_feature  = (row.get(col_feature, "") or "").strip()  if col_feature  else "",
            ))
        return [c for c in cases if c.full_text.strip()]

    # Plain-text fallback
    lines = content.decode("utf-8", errors="replace").splitlines()
    return [
        NormalizedCase(raw_id=str(i), title=line.strip(),
                       description="", steps="", expected_result="", hinted_feature="")
        for i, line in enumerate(lines)
        if line.strip()
    ]


# ---------------------------------------------------------------------------
# Stage 5 - Embed
# ---------------------------------------------------------------------------

def embed_texts(openai_client, texts: list) -> list:
    """
    Stage 5 - Embed.

    Call OpenAI text-embedding-3-small in one batch and return embedding
    vectors in the same order as the input list.
    """
    if not texts:
        return []
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=texts,
    )
    return [item.embedding for item in response.data]


# ---------------------------------------------------------------------------
# Cosine similarity
# ---------------------------------------------------------------------------

def _cosine(a: list, b: list) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na  = math.sqrt(sum(x * x for x in a))
    nb  = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0


# ---------------------------------------------------------------------------
# Stage 3 - Map to features
# ---------------------------------------------------------------------------

def map_cases_to_features(
    cases: list,
    feature_names: list,
    feature_embeddings: list,   # one embedding per feature (requirement_text)
    case_embeddings: list,      # one embedding per case (full_text)
) -> dict:
    """
    Stage 3 - Map.

    Assign each uploaded case to a project feature.

    Priority
    --------
    1. Exact case-insensitive match on hinted_feature.
    2. Substring containment match on hinted_feature.
    3. Semantic: highest cosine similarity to a feature's requirement_text,
       provided it exceeds FEATURE_MAP_MIN_SIM.
    4. Unassigned -> "__unmapped__".
    """
    result = {f: [] for f in feature_names}
    result["__unmapped__"] = []

    lower_features = {f.lower(): f for f in feature_names}

    for idx, case in enumerate(cases):
        assigned = False

        if case.hinted_feature:
            hint_lower = case.hinted_feature.lower()
            if hint_lower in lower_features:
                result[lower_features[hint_lower]].append(idx)
                assigned = True
            else:
                match = next(
                    (canon for key, canon in lower_features.items()
                     if hint_lower in key or key in hint_lower),
                    None,
                )
                if match:
                    result[match].append(idx)
                    assigned = True

        if not assigned:
            case_emb = case_embeddings[idx]
            pairs = [(_cosine(case_emb, feat_emb), feature_names[fi])
                     for fi, feat_emb in enumerate(feature_embeddings)]
            best_sim, best_feat = max(pairs, key=lambda p: p[0], default=(-1.0, None))
            if best_sim >= FEATURE_MAP_MIN_SIM and best_feat:
                result[best_feat].append(idx)
            else:
                result["__unmapped__"].append(idx)

    return result


# ---------------------------------------------------------------------------
# Stage 6 - Match
# ---------------------------------------------------------------------------

def match_cases(
    manual_titles: list,
    manual_embeddings: list,
    ai_titles: list,
    ai_embeddings: list,
) -> dict:
    """
    Stage 6 - Match.

    Greedy one-to-one bipartite matching between uploaded (manual) test cases
    and AI-generated test cases for a single feature.

    Three similarity tiers
    ----------------------
    >= MATCH_THRESHOLD     -> matched  (confirmed same scenario)
    >= NEAR_MISS_THRESHOLD -> near_misses (likely same scenario, different phrasing)
    <  NEAR_MISS_THRESHOLD -> manual_only (genuinely uncovered by AI)

    Returns a dict with:
        matched         -- [{manual_title, ai_title, similarity}]
        near_misses     -- [{manual_title, closest_ai_title, similarity}]
        ai_only         -- [ai_title, ...]
        manual_only     -- [manual_title, ...]
        redundant_pairs -- [{case_a, case_b, similarity}]
    """
    if not manual_embeddings or not ai_embeddings:
        return {
            "matched":         [],
            "near_misses":     [],
            "ai_only":         list(ai_titles),
            "manual_only":     list(manual_titles),
            "redundant_pairs": [],
        }

    sim_matrix = [
        [_cosine(m_emb, a_emb) for a_emb in ai_embeddings]
        for m_emb in manual_embeddings
    ]

    # --- Greedy matching at MATCH_THRESHOLD ---
    candidates = sorted(
        [(sim_matrix[mi][ai], mi, ai)
         for mi in range(len(manual_embeddings))
         for ai in range(len(ai_embeddings))
         if sim_matrix[mi][ai] >= MATCH_THRESHOLD],
        reverse=True,
    )

    used_manual: set = set()
    used_ai: set     = set()
    matched = []

    for sim, mi, ai in candidates:
        if mi in used_manual or ai in used_ai:
            continue
        matched.append({
            "manual_title": manual_titles[mi],
            "ai_title":     ai_titles[ai],
            "similarity":   round(sim, 3),
        })
        used_manual.add(mi)
        used_ai.add(ai)

    # --- Near-miss detection for remaining manual cases ---
    # For each unmatched manual case, find its closest AI case.
    # Track which AI indices are near-missed so they can be excluded from
    # ai_only — an AI case with any near-miss is partially covered, not a gap.
    unmatched_m = [i for i in range(len(manual_titles)) if i not in used_manual]
    near_misses: list         = []
    near_missed_ai: set       = set()   # AI indices claimed by at least one near-miss
    true_manual_only_indices  = []

    for mi in unmatched_m:
        row = sim_matrix[mi]
        best_ai_idx = max(range(len(ai_titles)), key=lambda j: row[j])
        best_sim    = row[best_ai_idx]
        if NEAR_MISS_THRESHOLD <= best_sim < MATCH_THRESHOLD:
            near_misses.append({
                "manual_title":      manual_titles[mi],
                "closest_ai_title":  ai_titles[best_ai_idx],
                "similarity":        round(best_sim, 3),
            })
            near_missed_ai.add(best_ai_idx)   # deduplicated by set
        else:
            true_manual_only_indices.append(mi)

    # ai_only = AI cases with neither a confirmed match nor any near-miss
    ai_only = [
        ai_titles[i] for i in range(len(ai_titles))
        if i not in used_ai and i not in near_missed_ai
    ]

    manual_only = [manual_titles[i] for i in true_manual_only_indices]

    # --- Redundancy within true manual-only cases ---
    redundant_pairs = []
    for ii, mi in enumerate(true_manual_only_indices):
        for mj in true_manual_only_indices[ii + 1:]:
            sim = _cosine(manual_embeddings[mi], manual_embeddings[mj])
            if sim >= REDUNDANT_THRESHOLD:
                redundant_pairs.append({
                    "case_a":     manual_titles[mi],
                    "case_b":     manual_titles[mj],
                    "similarity": round(sim, 3),
                })

    return {
        "matched":              matched,
        "near_misses":          near_misses,
        "near_missed_ai_count": len(near_missed_ai),   # unique AI cases partially covered
        "ai_only":              ai_only,
        "manual_only":          manual_only,
        "redundant_pairs":      redundant_pairs,
    }


# ---------------------------------------------------------------------------
# Feature-mapping suggestion  (used by the /compare/preview endpoint)
# ---------------------------------------------------------------------------

def suggest_feature_mapping(
    uploaded_feature_names: list,   # unique hinted_feature strings from the CSV
    project_feature_names: list,    # canonical names from the DB
    project_feature_embeddings: list,   # one embedding per project feature
    openai_client,
) -> list:
    """
    For each unique uploaded feature name, find the most similar project
    feature by embedding the uploaded name and computing cosine similarity
    against each project feature's requirement-text embedding.

    Returns a list of dicts:
        {uploaded_feature, suggested_project_feature, similarity}
    sorted by uploaded_feature name.
    """
    if not uploaded_feature_names or not project_feature_names:
        return []

    uploaded_embeddings = embed_texts(openai_client, uploaded_feature_names)

    results = []
    for i, name in enumerate(uploaded_feature_names):
        emb = uploaded_embeddings[i]
        pairs = [
            (_cosine(emb, proj_emb), project_feature_names[j])
            for j, proj_emb in enumerate(project_feature_embeddings)
        ]
        best_sim, best_feat = max(pairs, key=lambda p: p[0], default=(0.0, None))
        results.append({
            "uploaded_feature":         name,
            "suggested_project_feature": best_feat if best_sim >= 0.35 else None,
            "similarity":               round(best_sim, 3),
        })

    return sorted(results, key=lambda r: r["uploaded_feature"])


# ---------------------------------------------------------------------------
# Stage 7 - Report
# ---------------------------------------------------------------------------

def build_report(
    project_id: int,
    project_name: str,
    feature_results: list,
    unmapped_manual_cases: list,
    total_uploaded: int,
) -> dict:
    """
    Stage 7 - Report.

    Aggregate per-feature results into the final project-level gap report.
    """
    # Near-miss partial-coverage weight: an AI case with a near-miss counts as
    # 50% covered rather than 0% (gap) or 100% (confirmed match).
    NEAR_MISS_WEIGHT = 0.5

    total_ai              = sum(f["ai_cases_count"]        for f in feature_results)
    matched_count         = sum(len(f["matched"])           for f in feature_results)
    near_miss_count       = sum(len(f["near_misses"])       for f in feature_results)
    near_missed_ai_total  = sum(f["near_missed_ai_count"]   for f in feature_results)
    ai_only_count         = sum(len(f["ai_only"])           for f in feature_results)
    manual_only_ct        = sum(len(f["manual_only"])       for f in feature_results)
    redundant_ct          = sum(len(f["redundant_pairs"])   for f in feature_results)

    # Exact: only confirmed matches count
    exact_cov    = round(matched_count / total_ai * 100, 1) if total_ai else 0.0
    # Adjusted: near-missed AI cases contribute NEAR_MISS_WEIGHT each
    adjusted_cov = round(
        (matched_count + near_missed_ai_total * NEAR_MISS_WEIGHT) / total_ai * 100, 1
    ) if total_ai else 0.0

    return {
        "project_id":            project_id,
        "project_name":          project_name,
        "total_uploaded":        total_uploaded,
        "features":              feature_results,
        "unmapped_manual_cases": unmapped_manual_cases,
        "summary": {
            "total_ai_cases":        total_ai,
            "total_manual_cases":    sum(f["manual_cases_count"] for f in feature_results),
            "matched_count":         matched_count,
            "near_miss_count":       near_miss_count,
            "near_missed_ai_count":  near_missed_ai_total,
            "ai_only_count":         ai_only_count,
            "manual_only_count":     manual_only_ct,
            "redundant_count":       redundant_ct,
            "exact_coverage_pct":    exact_cov,
            "adjusted_coverage_pct": adjusted_cov,
            "unmapped_cases":        len(unmapped_manual_cases),
        },
    }
