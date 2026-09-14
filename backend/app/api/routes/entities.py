"""
Entities API endpoints
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
from app.models.schemas import Entity, EntityCreate, EntityUpdate
from app.services.db import DatabaseService

router = APIRouter(prefix="/entities", tags=["entities"])

@router.get("", response_model=List[Dict[str, Any]])
def list_entities(case_id: str = Query(..., description="Case UUID")):
    return DatabaseService.get_entities(case_id)

@router.post("", response_model=Dict[str, Any])
def create_entity(payload: EntityCreate):
    return DatabaseService.create_entity(payload.model_dump())

@router.patch("/{entity_id}", response_model=Dict[str, Any])
def update_entity(entity_id: str, payload: EntityUpdate):
    updates = payload.model_dump(exclude_unset=True)
    res = DatabaseService.update_entity(entity_id, updates)
    if not res:
        raise HTTPException(status_code=404, detail="Entity not found")
    return res
