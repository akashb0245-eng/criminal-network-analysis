"""
Analytics API endpoints: Graph Topology, Centrality, Influencers, Communities, Anomaly Run
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, List
from app.models.schemas import AnalyticsSummaryResponse, AlertBase
from app.services.db import DatabaseService
from app.services.graph_analytics import GraphAnalyticsEngine
from app.services.anomaly_detection import AnomalyDetectionEngine

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/{case_id}", response_model=AnalyticsSummaryResponse)
def get_case_analytics(case_id: str):
    """Computes and returns full NetworkX graph analytics for case."""
    entities = DatabaseService.get_entities(case_id)
    relationships = DatabaseService.get_relationships(case_id)
    
    summary = GraphAnalyticsEngine.analyze_network(case_id, entities, relationships)
    
    # Also run anomaly detector and attach
    detected_anomalies = AnomalyDetectionEngine.detect_anomalies(case_id, entities, relationships)
    summary.detected_anomalies = detected_anomalies
    
    return summary

@router.post("/{case_id}/run-anomalies", response_model=List[Dict[str, Any]])
def run_and_persist_anomalies(case_id: str):
    """Executes anomaly detection suite and persists newly discovered alerts to database."""
    entities = DatabaseService.get_entities(case_id)
    relationships = DatabaseService.get_relationships(case_id)
    
    detected = AnomalyDetectionEngine.detect_anomalies(case_id, entities, relationships)
    
    # Fetch existing alerts to avoid duplicate spam
    existing_alerts = DatabaseService.get_alerts(case_id)
    existing_titles = set(a.get('title') for a in existing_alerts)
    
    new_alert_records = []
    for alert in detected:
        if alert.title not in existing_titles:
            new_alert_records.append({
                "case_id": case_id,
                "alert_type": alert.alert_type,
                "severity": alert.severity,
                "title": alert.title,
                "description": alert.description,
                "is_resolved": False
            })
            
    if new_alert_records:
        DatabaseService.create_alerts_batch(new_alert_records)
        
    # Also update key influencer status on top ranking entities
    summary = GraphAnalyticsEngine.analyze_network(case_id, entities, relationships)
    top_ids = set(inf.entity_id for inf in summary.top_influencers if inf.influence_score >= 50)
    
    for e in entities:
        is_top = e['id'] in top_ids
        if e.get('is_key_influencer') != is_top:
            DatabaseService.update_entity(e['id'], {"is_key_influencer": is_top})
            
    return DatabaseService.get_alerts(case_id)
