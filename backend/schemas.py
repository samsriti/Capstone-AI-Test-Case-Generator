from pydantic import BaseModel, EmailStr
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

class TestCaseResponse(BaseModel):
    id: int
    project_id: int
    feature_name: str  # NEW
    requirement_text: str  # NEW
    title: str
    description: str
    type: str
    steps: List[str]
    expected_result: str
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