from pydantic import BaseModel, EmailStr, field_validator
from typing import List, Optional
from datetime import datetime

# User schemas
class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

# Project schemas - SIMPLIFIED!
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    # requirement_text REMOVED!

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Test Case schemas
class TestCaseCreate(BaseModel):
    title: str
    description: str
    type: str
    steps: List[str]
    expected_result: str

# NEW - For generating test cases
class GenerateTestCasesRequest(BaseModel):
    feature_name: str  # e.g., "Login Feature"
    requirement_text: str  # The actual requirement

    @field_validator("feature_name")
    @classmethod
    def validate_feature_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("feature_name cannot be empty")
        if len(v) > 100:
            raise ValueError("feature_name must be 100 characters or fewer")
        return v

    @field_validator("requirement_text")
    @classmethod
    def validate_requirement_text(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("requirement_text cannot be empty")
        if len(v) > 3000:
            raise ValueError(
                "requirement_text must be 3000 characters or fewer. "
                "Please split large requirements into smaller feature descriptions."
            )
        return v

class RegenerateTestCasesRequest(BaseModel):
    requirement_text: str
    new_feature_name: Optional[str] = None

    @field_validator("requirement_text")
    @classmethod
    def validate_requirement_text(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("requirement_text cannot be empty")
        if len(v) > 3000:
            raise ValueError(
                "requirement_text must be 3000 characters or fewer. "
                "Please split large requirements into smaller feature descriptions."
            )
        return v

    @field_validator("new_feature_name")
    @classmethod
    def validate_new_feature_name(cls, v):
        if v is None:
            return v
        v = v.strip()
        if not v:
            return None
        if len(v) > 100:
            raise ValueError("new_feature_name must be 100 characters or fewer")
        return v


class TestCaseResponse(BaseModel):
    id: int
    project_id: int
    feature_name: str
    requirement_text: str
    title: str
    description: str
    type: str
    priority: Optional[str] = None
    steps: List[str]
    expected_result: str
    test_data: Optional[str] = None
    dependencies: Optional[str] = None
    compliance_note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ProjectWithTestCases(ProjectResponse):
    test_cases: List[TestCaseResponse] = []

# NEW - Grouped test cases by feature
class FeatureTestCases(BaseModel):
    feature_name: str
    requirement_text: str
    test_cases: List[TestCaseResponse]

class ProjectWithGroupedTestCases(ProjectResponse):
    features: List[FeatureTestCases] = []