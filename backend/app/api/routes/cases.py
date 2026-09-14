"""
Cases API endpoints
"""
from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from app.models.schemas import Case, CaseCreate, CaseUpdate
from app.services.db import DatabaseService

router = APIRouter(prefix="/cases", tags=["cases"])

@router.get("", response_model=List[Dict[str, Any]])
def list_cases():
    return DatabaseService.get_cases()

@router.get("/{case_id}", response_model=Dict[str, Any])
def get_case(case_id: str):
    c = DatabaseService.get_case(case_id)
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
    return c

@router.post("", response_model=Dict[str, Any])
def create_case(payload: CaseCreate):
    return DatabaseService.create_case(payload.model_dump())
