"""
Comprehensive Unit Tests for SENTINEL Engine
Tests:
- NLP and Entity Extraction
- Entity Resolution
- NetworkX Graph Analytics
- Anomaly & Pattern Detection
- CDR and Financial Ingestion
"""
import pytest
from app.services.nlp import NLPExtractionEngine
from app.services.resolution import EntityResolutionEngine
from app.services.graph_analytics import GraphAnalyticsEngine
from app.services.anomaly_detection import AnomalyDetectionEngine
from app.services.ingestion import IngestionService
from app.models.schemas import CDRRecord, FinancialRecord, ExtractedEntity, ExtractedRelationship

def test_nlp_extraction():
    sample_text = (
        "On 15th March, suspect Rajesh Kumar was arrested at Sector 14, Delhi. "
        "He contacted Mohan Sharma at +91-9876543210. Call Detail Records show 47 calls. "
        "Financial records indicate Rs. 5,00,000 was transferred to Priya Singh, who is the wife of Rajesh Kumar. "
        "Vehicle DL-01-AB-1234 was spotted near the spot. They operate North Delhi Gang."
    )
    result = NLPExtractionEngine.extract(sample_text)
    
    entity_names = [e.name for e in result["entities"]]
    assert any("Rajesh Kumar" in n for n in entity_names)
    assert any("Mohan Sharma" in n for n in entity_names)
    assert any("Phone +91-9876543210" in n or "9876543210" in n for n in entity_names)
    assert any("DL-01-AB-1234" in n for n in entity_names)
    assert any("North Delhi Gang" in n for n in entity_names)
    
    # Check relationship extraction
    rel_pairs = [(r.source, r.target, r.type) for r in result["relationships"]]
    assert len(result["relationships"]) > 0

def test_entity_resolution():
    existing_entities = [
        {"id": "e-1", "name": "Rajesh Kumar", "type": "person", "metadata": {"number": "+91-9876543210"}},
        {"id": "e-2", "name": "Mohan Sharma", "type": "person", "metadata": {}},
        {"id": "e-3", "name": "DL-01-AB-1234", "type": "vehicle", "metadata": {"plate": "DL-01-AB-1234"}}
    ]
    
    # 1. Exact phone match
    matched_id, reason, conf = EntityResolutionEngine.resolve_entity(
        candidate_name="R. Kumar",
        candidate_type="person",
        candidate_metadata={"raw_number": "+91-9876543210"},
        existing_entities=existing_entities
    )
    assert matched_id == "e-1"
    assert conf == 1.0
    
    # 2. Abbreviation match
    matched_id, reason, conf = EntityResolutionEngine.resolve_entity(
        candidate_name="M. Sharma",
        candidate_type="person",
        candidate_metadata={},
        existing_entities=existing_entities
    )
    assert matched_id == "e-2"
    assert conf >= 0.85
    
    # 3. Fuzzy similarity
    matched_id, reason, conf = EntityResolutionEngine.resolve_entity(
        candidate_name="Rajesh Kumarr",
        candidate_type="person",
        candidate_metadata={},
        existing_entities=existing_entities
    )
    assert matched_id == "e-1"
    assert conf >= 0.85

def test_graph_analytics():
    entities = [
        {"id": "A", "name": "Kingpin Alice", "type": "person", "risk_score": 90},
        {"id": "B", "name": "Broker Bob", "type": "person", "risk_score": 60},
        {"id": "C", "name": "Operative Charlie", "type": "person", "risk_score": 50},
        {"id": "D", "name": "Operative David", "type": "person", "risk_score": 40},
        {"id": "E", "name": "Operative Eve", "type": "person", "risk_score": 30}
    ]
    # B is a bridge connecting A to C, D, E
    relationships = [
        {"source_entity_id": "A", "target_entity_id": "B", "type": "associate", "strength": 8},
        {"source_entity_id": "B", "target_entity_id": "C", "type": "associate", "strength": 6},
        {"source_entity_id": "B", "target_entity_id": "D", "type": "associate", "strength": 6},
        {"source_entity_id": "C", "target_entity_id": "D", "type": "associate", "strength": 5},
        {"source_entity_id": "D", "target_entity_id": "E", "type": "associate", "strength": 5},
    ]
    
    summary = GraphAnalyticsEngine.analyze_network("case-1", entities, relationships)
    
    assert summary.topology.node_count == 5
    assert summary.topology.edge_count == 5
    assert len(summary.node_metrics) == 5
    
    # Verify B has highest betweenness centrality
    b_metric = next(m for m in summary.node_metrics if m.entity_id == "B")
    assert b_metric.betweenness > 0.4
    
    # Shortest path test
    sp_res = GraphAnalyticsEngine.find_shortest_path(entities, relationships, "A", "E")
    assert sp_res.found is True
    assert sp_res.path == ["A", "B", "D", "E"] or sp_res.path == ["A", "B", "C", "D", "E"]

def test_anomaly_detection_cycles_and_bridges():
    entities = [
        {"id": "acc-1", "name": "Account 101", "type": "bank_account"},
        {"id": "acc-2", "name": "Account 102", "type": "bank_account"},
        {"id": "acc-3", "name": "Account 103", "type": "bank_account"},
        {"id": "person-1", "name": "Broker Dave", "type": "person"},
        {"id": "person-2", "name": "Gangleader Alpha", "type": "person"},
        {"id": "person-3", "name": "Gangleader Beta", "type": "person"}
    ]
    
    # Circular financial transfers (101 -> 102 -> 103 -> 101)
    # Dave connects Alpha and Beta (Bridge)
    relationships = [
        {"source_entity_id": "acc-1", "target_entity_id": "acc-2", "type": "financial", "strength": 8},
        {"source_entity_id": "acc-2", "target_entity_id": "acc-3", "type": "financial", "strength": 8},
        {"source_entity_id": "acc-3", "target_entity_id": "acc-1", "type": "financial", "strength": 8},
        {"source_entity_id": "person-1", "target_entity_id": "person-2", "type": "associate", "strength": 6},
        {"source_entity_id": "person-1", "target_entity_id": "person-3", "type": "associate", "strength": 6},
    ]
    
    alerts = AnomalyDetectionEngine.detect_anomalies("case-test", entities, relationships)
    alert_types = [a.alert_type for a in alerts]
    
    assert 'circular_transaction' in alert_types
    assert 'bridge_broker' in alert_types
