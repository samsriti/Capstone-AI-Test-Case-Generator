from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List
from datetime import timedelta
import json

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
    new_project = models.Project(
        user_id=current_user.id,
        name=project.name,
        description=project.description,
        requirement_text=project.requirement_text
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
    projects = db.query(models.Project).filter(models.Project.user_id == current_user.id).all()
    return projects

@app.get("/projects/{project_id}", response_model=schemas.ProjectWithTestCases)
def get_project(
    project_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return project

@app.delete("/projects/{project_id}")
def delete_project(
    project_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
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
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # Get project
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Delete existing test cases for this project
    db.query(models.TestCase).filter(models.TestCase.project_id == project_id).delete()
    
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
                    "content": f"Generate test cases for this requirement:\n\n{project.requirement_text}"
                }
            ],
            temperature=0.7,
            max_tokens=2000,
            response_format={"type": "json_object"}
        )
        
        result = response.choices[0].message.content
        test_data = json.loads(result)
        
        # Save test cases to database
        saved_test_cases = []
        for tc_data in test_data["test_cases"]:
            test_case = models.TestCase(
                project_id=project_id,
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
            "message": "Test cases generated and saved successfully",
            "test_cases": [schemas.TestCaseResponse.from_orm(tc) for tc in saved_test_cases]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating test cases: {str(e)}")

@app.get("/")
def read_root():
    return {"message": "AI Test Case Generator API with Auth is running!"}