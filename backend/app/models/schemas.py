"""
Pydantic data schemas for SENTINEL API
"""
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field
from datetime import datetime

CaseStatus = Literal['open', 'closed', 'pending']
CasePriority = Literal['low', 'medium', 'high', 'critical']
EntityType = Literal['person', 'organization', 'location', 'vehicle', 'phone', 'email', 'bank_account']
RelationshipType = Literal['associate', 'family', 'financial', 'communication', 'location', 'organizational']
SourceType = Literal['fir', 'cdr', 'financial', 'surveillance', 'social_media', 'criminal_history', 'intelligence_report']
AlertType = Literal['frequent_contact', 'financial_anomaly', 'hub_activity', 'co_occurrence', 'repeated_offense', 'network_cluster', 'circular_transaction', 'bridge_broker']
Severity = Literal['low', 'medium', 'high', 'critical']
EvidenceStatus = Literal['pending', 'analyzed', 'flagged']

# --- Case Schemas ---
class CaseBase(BaseModel):
    name: str = Field(..., min_length=1, description="Case name")
    description: Optional[str] = None
    status: CaseStatus = 'open'
    priority: CasePriority = 'medium'

class CaseCreate(CaseBase):
    pass

class CaseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[CaseStatus] = None
    priority: Optional[CasePriority] = None

class Case(CaseBase):
    id: str
    created_at: str
    updated_at: str

# --- Entity Schemas ---
class EntityBase(BaseModel):
    name: str
    type: EntityType
    subtype: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    risk_score: int = Field(default=0, ge=0, le=100)
    is_key_influencer: bool = False
    notes: Optional[str] = None

class EntityCreate(EntityBase):
    case_id: str

class EntityUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[EntityType] = None
    subtype: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    risk_score: Optional[int] = Field(default=None, ge=0, le=100)
    is_key_influencer: Optional[bool] = None
    notes: Optional[str] = None

class Entity(EntityBase):
    id: str
    case_id: str
    created_at: str

# --- Relationship Schemas ---
class RelationshipBase(BaseModel):
    source_entity_id: str
    target_entity_id: str
    type: RelationshipType
    strength: int = Field(default=5, ge=1, le=10)
    description: Optional[str] = None
    evidence_id: Optional[str] = None

class RelationshipCreate(RelationshipBase):
    case_id: str

class Relationship(RelationshipBase):
    id: str
    case_id: str
    created_at: str

# --- Evidence Schemas ---
class EvidenceBase(BaseModel):
    source_type: SourceType
    title: str
    content: Optional[str] = None
    extracted_data: Dict[str, Any] = Field(default_factory=dict)
    status: EvidenceStatus = 'pending'

class EvidenceCreate(EvidenceBase):
    case_id: str
    entity_id: Optional[str] = None

class Evidence(EvidenceBase):
    id: str
    case_id: str
    entity_id: Optional[str] = None
    created_at: str

# --- Alert Schemas ---
class AlertBase(BaseModel):
    alert_type: AlertType
    severity: Severity
    title: str
    description: Optional[str] = None
    is_resolved: bool = False

class AlertCreate(AlertBase):
    case_id: str
    entity_id: Optional[str] = None

class Alert(AlertBase):
    id: str
    case_id: str
    entity_id: Optional[str] = None
    created_at: str

# --- Crime Event Schemas ---
class CrimeEventBase(BaseModel):
    title: str
    description: Optional[str] = None
    event_date: Optional[str] = None
    location: Optional[str] = None
    severity: Severity = 'medium'

class CrimeEventCreate(CrimeEventBase):
    case_id: str

class CrimeEvent(CrimeEventBase):
    id: str
    case_id: str
    created_at: str

# --- Ingestion & Extraction Models ---
class ExtractedEntity(BaseModel):
    name: str
    type: EntityType
    subtype: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    provenance: Optional[str] = None
    start_char: Optional[int] = None
    end_char: Optional[int] = None
    resolved_to_id: Optional[str] = None
    resolved_reason: Optional[str] = None

class ExtractedRelationship(BaseModel):
    source: str
    target: str
    type: RelationshipType
    strength: int = Field(default=5, ge=1, le=10)
    description: str
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    evidence_snippet: Optional[str] = None

class TextExtractionRequest(BaseModel):
    case_id: str
    title: str
    source_type: SourceType = 'fir'
    content: str

class TextExtractionResponse(BaseModel):
    entities: List[ExtractedEntity]
    relationships: List[ExtractedRelationship]
    keywords: List[str]
    summary: Dict[str, Any]

class IngestionCommitRequest(BaseModel):
    case_id: str
    title: str
    source_type: SourceType
    content: Optional[str] = None
    entities: List[ExtractedEntity]
    relationships: List[ExtractedRelationship]

class IngestionCommitResponse(BaseModel):
    evidence_id: str
    entities_created: int
    entities_linked: int
    relationships_created: int

# --- CDR & Financial Ingestion Models ---
class CDRRecord(BaseModel):
    caller_phone: str
    receiver_phone: str
    timestamp: str
    duration_sec: int
    call_type: str = 'voice' # voice, sms, voip
    cell_tower: Optional[str] = None
    imei: Optional[str] = None

class CDRIngestRequest(BaseModel):
    case_id: str
    title: str
    records: List[CDRRecord]

class FinancialRecord(BaseModel):
    source_account: str
    target_account: str
    source_holder: Optional[str] = None
    target_holder: Optional[str] = None
    amount: float
    currency: str = 'INR'
    timestamp: str
    transaction_type: str = 'transfer' # transfer, deposit, withdrawal
    notes: Optional[str] = None

class FinancialIngestRequest(BaseModel):
    case_id: str
    title: str
    records: List[FinancialRecord]

# --- Graph & Analytics Models ---
class NodeMetric(BaseModel):
    entity_id: str
    name: str
    type: EntityType
    degree: int
    in_degree: int
    out_degree: int
    betweenness: float
    closeness: float
    pagerank: float
    community_id: int
    influence_score: int
    score_breakdown: Dict[str, Any]

class CommunityInfo(BaseModel):
    community_id: int
    label: str
    member_count: int
    key_entities: List[str]

class ShortestPathResult(BaseModel):
    found: bool
    path: List[str]
    path_names: List[str]
    length: int
    edge_types: List[str]

class GraphTopology(BaseModel):
    node_count: int
    edge_count: int
    density: float
    connected_components: int
    is_connected: bool
    diameter: Optional[int] = None
    average_path_length: Optional[float] = None

class AnalyticsSummaryResponse(BaseModel):
    case_id: str
    topology: GraphTopology
    node_metrics: List[NodeMetric]
    top_influencers: List[NodeMetric]
    communities: List[CommunityInfo]
    detected_anomalies: List[AlertBase]
