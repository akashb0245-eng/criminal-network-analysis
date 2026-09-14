"""
Alerts API endpoints
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any
from app.services.db import DatabaseService

router = APIRouter(prefix="/alerts", tags=["alerts"])

@router.get("", response_model=List[Dict[str, Any]])
def list_alerts(case_id: str = Query(..., description="Case UUID")):
    return DatabaseService.get_alerts(case_id)

@router.patch("/{alert_id}/resolve", response_model=Dict[str, Any])
def resolve_alert(alert_id: str):
    success = DatabaseService.resolve_alert(alert_id)
    if not success:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"status": "success", "alert_id": alert_id, "is_resolved": True}
