export type CaseStatus = 'open' | 'closed' | 'pending';
export type CasePriority = 'low' | 'medium' | 'high' | 'critical';

export type EntityType = 'person' | 'organization' | 'location' | 'vehicle' | 'phone' | 'email';
export type RelationshipType = 'associate' | 'family' | 'financial' | 'communication' | 'location' | 'organizational';
export type SourceType = 'fir' | 'cdr' | 'financial' | 'surveillance' | 'social_media' | 'criminal_history' | 'intelligence_report';
export type AlertType = 'frequent_contact' | 'financial_anomaly' | 'hub_activity' | 'co_occurrence' | 'repeated_offense' | 'network_cluster';
export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type EvidenceStatus = 'pending' | 'analyzed' | 'flagged';

export interface Case {
  id: string;
  name: string;
  description: string | null;
  status: CaseStatus;
  priority: CasePriority;
  created_at: string;
  updated_at: string;
}

export interface Entity {
  id: string;
  case_id: string;
  name: string;
  type: EntityType;
  subtype: string | null;
  metadata: Record<string, unknown>;
  risk_score: number;
  is_key_influencer: boolean;
  notes: string | null;
  created_at: string;
}

export interface Relationship {
  id: string;
  case_id: string;
  source_entity_id: string;
  target_entity_id: string;
  type: RelationshipType;
  strength: number;
  description: string | null;
  evidence_id: string | null;
  created_at: string;
}

export interface Evidence {
  id: string;
  case_id: string;
  entity_id: string | null;
  source_type: SourceType;
  title: string;
  content: string | null;
  extracted_data: Record<string, unknown>;
  status: EvidenceStatus;
  created_at: string;
}

export interface Alert {
  id: string;
  case_id: string;
  entity_id: string | null;
  alert_type: AlertType;
  severity: Severity;
  title: string;
  description: string | null;
  is_resolved: boolean;
  created_at: string;
}

export interface CrimeEvent {
  id: string;
  case_id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  location: string | null;
  severity: Severity;
  created_at: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: EntityType;
  subtype: string | null;
  risk_score: number;
  is_key_influencer: boolean;
  degree: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  strength: number;
  label: string;
}
