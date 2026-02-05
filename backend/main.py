from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List
from datetime import timedelta
import json
from collections import defaultdict

from openai import OpenAI
import os
from dotenv import load_dotenv

import models
import schemas
import auth
from database import engine, get_db

load_dotenv()

# Create database tables
models.Base.metadata.create_all(bind=engine)

# Initialize OpenAI
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

app = FastAPI(title="AI Test Case Generator API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============= AUTH ENDPOINTS =============

@app.post("/signup", response_model=schemas.UserResponse)
def signup(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # Check if user exists
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # Create new user
    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(
        email=user.email,
        username=user.username,
        hashed_password=hashed_password
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/token", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=schemas.UserResponse)
def get_current_user_info(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

# ============= PROJECT ENDPOINTS =============

@app.post("/projects", response_model=schemas.ProjectResponse)
def create_project(
    project: schemas.ProjectCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new project (e.g., "Business 1", "E-commerce Platform")
    No requirement_text needed - you'll add features/test cases later
    """
    new_project = models.Project(
        user_id=current_user.id,
        name=project.name,
        description=project.description
    )
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    return new_project

@app.get("/projects", response_model=List[schemas.ProjectResponse])
def get_user_projects(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Get all projects for the current user"""
    projects = db.query(models.Project).filter(models.Project.user_id == current_user.id).all()
    return projects

@app.get("/projects/{project_id}", response_model=schemas.ProjectWithGroupedTestCases)
def get_project(
    project_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a project with all test cases grouped by feature
    Example response:
    {
      "id": 1,
      "name": "Business 1",
      "features": [
        {
          "feature_name": "Login",
          "requirement_text": "...",
          "test_cases": [...]
        },
        {
          "feature_name": "Signup",
          "requirement_text": "...",
          "test_cases": [...]
        }
      ]
    }
    """
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Group test cases by feature
    features_dict = defaultdict(lambda: {"test_cases": [], "requirement_text": ""})
    
    for tc in project.test_cases:
        features_dict[tc.feature_name]["test_cases"].append(tc)
        features_dict[tc.feature_name]["requirement_text"] = tc.requirement_text
    
    # Convert to list of FeatureTestCases
    features = [
        {
            "feature_name": feature_name,
            "requirement_text": data["requirement_text"],
            "test_cases": data["test_cases"]
        }
        for feature_name, data in features_dict.items()
    ]
    
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
        "features": features
    }

@app.put("/projects/{project_id}", response_model=schemas.ProjectResponse)
def update_project(
    project_id: int,
    project_update: schemas.ProjectUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Update project name or description"""
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if project_update.name is not None:
        project.name = project_update.name
    if project_update.description is not None:
        project.description = project_update.description
    
    db.commit()
    db.refresh(project)
    return project

@app.delete("/projects/{project_id}")
def delete_project(
    project_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a project and all its test cases"""
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    db.delete(project)
    db.commit()
    return {"message": "Project deleted successfully"}

# ============= TEST CASE ENDPOINTS =============

@app.post("/projects/{project_id}/generate-test-cases")
async def generate_and_save_test_cases(
    project_id: int,
    request: schemas.GenerateTestCasesRequest,  # NEW - takes feature_name and requirement_text
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate test cases for a specific feature within a project
    
    Example request:
    {
      "feature_name": "User Login",
      "requirement_text": "As a user, I want to log in with email and password..."
    }
    """
    # Get project
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if this feature already has test cases
    existing_test_cases = db.query(models.TestCase).filter(
        models.TestCase.project_id == project_id,
        models.TestCase.feature_name == request.feature_name
    ).first()
    
    if existing_test_cases:
        raise HTTPException(
            status_code=400, 
            detail=f"Test cases already exist for feature '{request.feature_name}'. Delete them first or use a different feature name."
        )
    
    try:
        # Generate test cases with AI
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": """You are a QA expert. Generate comprehensive test cases from requirements.
                    
                    For each requirement, generate:
                    - Functional test cases (happy path)
                    - Negative test cases (invalid inputs, error scenarios)
                    - Boundary test cases (edge cases, limits)
                    - Exploratory test cases (unusual scenarios)
                    
                    Return ONLY valid JSON in this exact format with no markdown formatting:
                    {
                        "test_cases": [
                            {
                                "title": "Test case title",
                                "description": "Brief description",
                                "type": "functional",
                                "steps": ["Step 1", "Step 2"],
                                "expected_result": "Expected outcome"
                            }
                        ]
                    }
                    """
                },
                {
                    "role": "user",
                    "content": f"Generate test cases for this requirement:\n\n{request.requirement_text}"
                }
            ],
            temperature=0.7,
            max_tokens=2000,
            response_format={"type": "json_object"}
        )
        
        result = response.choices[0].message.content
        test_data = json.loads(result)
        
        # Save test cases to database with feature info
        saved_test_cases = []
        for tc_data in test_data["test_cases"]:
            test_case = models.TestCase(
                project_id=project_id,
                feature_name=request.feature_name,  # NEW
                requirement_text=request.requirement_text,  # NEW
                title=tc_data["title"],
                description=tc_data["description"],
                type=tc_data["type"],
                steps=tc_data["steps"],
                expected_result=tc_data["expected_result"]
            )
            db.add(test_case)
            saved_test_cases.append(test_case)
        
        db.commit()
        
        # Refresh all test cases to get their IDs
        for tc in saved_test_cases:
            db.refresh(tc)
        
        return {
            "message": f"Test cases generated and saved successfully for feature '{request.feature_name}'",
            "feature_name": request.feature_name,
            "test_cases_count": len(saved_test_cases),
            "test_cases": [schemas.TestCaseResponse.from_orm(tc) for tc in saved_test_cases]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating test cases: {str(e)}")

@app.get("/projects/{project_id}/features/{feature_name}/test-cases", response_model=List[schemas.TestCaseResponse])
def get_test_cases_by_feature(
    project_id: int,
    feature_name: str,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Get all test cases for a specific feature"""
    # Verify project belongs to user
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get test cases for this feature
    test_cases = db.query(models.TestCase).filter(
        models.TestCase.project_id == project_id,
        models.TestCase.feature_name == feature_name
    ).all()
    
    return test_cases

@app.delete("/projects/{project_id}/features/{feature_name}")
def delete_feature_test_cases(
    project_id: int,
    feature_name: str,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Delete all test cases for a specific feature"""
    # Verify project belongs to user
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Delete test cases for this feature
    deleted_count = db.query(models.TestCase).filter(
        models.TestCase.project_id == project_id,
        models.TestCase.feature_name == feature_name
    ).delete()
    
    db.commit()
    
    return {
        "message": f"Deleted {deleted_count} test cases for feature '{feature_name}'"
    }

@app.get("/")
def read_root():
    return {"message": "AI Test Case Generator API v2.0 - Feature-based test cases!"}