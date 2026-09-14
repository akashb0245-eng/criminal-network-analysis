"""
Relationships & Shortest Path API endpoints
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any
from app.models.schemas import RelationshipCreate, ShortestPathResult
from app.services.db import DatabaseService
from app.services.graph_analytics import GraphAnalyticsEngine

router = APIRouter(prefix="/relationships", tags=["relationships"])

@router.get("", response_model=List[Dict[str, Any]])
def list_relationships(case_id: str = Query(..., description="Case UUID")):
    return DatabaseService.get_relationships(case_id)

@router.post("", response_model=Dict[str, Any])
def create_relationship(payload: RelationshipCreate):
    created = DatabaseService.create_relationships_batch([payload.model_dump()])
    if not created:
        raise HTTPException(status_code=400, detail="Failed to create relationship")
    return created[0]

@router.get("/shortest-path", response_model=ShortestPathResult)
def get_shortest_path(
    case_id: str = Query(...),
    source_id: str = Query(...),
    target_id: str = Query(...)
):
    entities = DatabaseService.get_entities(case_id)
    relationships = DatabaseService.get_relationships(case_id)
    return GraphAnalyticsEngine.find_shortest_path(entities, relationships, source_id, target_id)
