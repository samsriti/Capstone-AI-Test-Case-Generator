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

# Project schemas
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    requirement_text: str

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    requirement_text: Optional[str] = None

class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    requirement_text: str
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

class TestCaseResponse(BaseModel):
    id: int
    project_id: int
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