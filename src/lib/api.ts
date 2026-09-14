/**
 * SENTINEL API Client
 * Connects frontend views to the FastAPI backend service
 */
import { supabase } from './supabase';
import type { Case, Entity, Relationship, Alert, Evidence, CrimeEvent } from './types';

const API_BASE = '/api';

export interface ExtractedEntityCandidate {
  name: string;
  type: string;
  subtype: string | null;
  metadata: Record<string, any>;
  confidence: number;
  provenance?: string;
  resolved_to_id?: string | null;
  resolved_reason?: string | null;
  selected?: boolean;
}

export interface ExtractedRelationshipCandidate {
  source: string;
  target: string;
  type: string;
  strength: number;
  description: string;
  confidence: number;
  evidence_snippet?: string;
  selected?: boolean;
}

export interface ExtractionResponse {
  entities: ExtractedEntityCandidate[];
  relationships: ExtractedRelationshipCandidate[];
  keywords: string[];
  summary: Record<string, any>;
}

export interface NodeMetric {
  entity_id: string;
  name: string;
  type: string;
  degree: number;
  in_degree: number;
  out_degree: number;
  betweenness: number;
  closeness: number;
  pagerank: number;
  community_id: number;
  influence_score: number;
  score_breakdown: {
    pagerank_contribution: number;
    betweenness_contribution: number;
    degree_contribution: number;
    risk_contribution: number;
    explanation: string;
  };
}

export interface CommunityInfo {
  community_id: number;
  label: string;
  member_count: number;
  key_entities: string[];
}

export interface GraphTopology {
  node_count: number;
  edge_count: number;
  density: number;
  connected_components: number;
  is_connected: boolean;
  diameter: number | null;
  average_path_length: number | null;
}

export interface AnalyticsSummary {
  case_id: string;
  topology: GraphTopology;
  node_metrics: NodeMetric[];
  top_influencers: NodeMetric[];
  communities: CommunityInfo[];
  detected_anomalies: any[];
}

export interface ShortestPathResult {
  found: boolean;
  path: string[];
  path_names: string[];
  length: number;
  edge_types: string[];
}

export const api = {
  // --- Case Endpoints ---
  async getCases(): Promise<Case[]> {
    try {
      const res = await fetch(`${API_BASE}/cases`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend API offline, falling back to direct Supabase:', e);
    }
    const { data } = await supabase.from('cases').select('*').order('created_at', { ascending: false });
    return (data as Case[]) || [];
  },

  async createCase(data: { name: string; description?: string | null; priority: string }): Promise<Case> {
    try {
      const res = await fetch(`${API_BASE}/cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend API offline, falling back to direct Supabase:', e);
    }
    const { data: created } = await supabase.from('cases').insert(data).select().single();
    return created as Case;
  },

  // --- Entity Endpoints ---
  async getEntities(caseId: string): Promise<Entity[]> {
    try {
      const res = await fetch(`${API_BASE}/entities?case_id=${encodeURIComponent(caseId)}`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend API fallback:', e);
    }
    const { data } = await supabase.from('entities').select('*').eq('case_id', caseId).order('created_at', { ascending: false });
    return (data as Entity[]) || [];
  },

  async createEntity(payload: Partial<Entity> & { case_id: string; name: string; type: string }): Promise<Entity> {
    try {
      const res = await fetch(`${API_BASE}/entities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend API fallback:', e);
    }
    const { data } = await supabase.from('entities').insert(payload).select().single();
    return data as Entity;
  },

  // --- Relationship Endpoints ---
  async getRelationships(caseId: string): Promise<Relationship[]> {
    try {
      const res = await fetch(`${API_BASE}/relationships?case_id=${encodeURIComponent(caseId)}`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend API fallback:', e);
    }
    const { data } = await supabase.from('relationships').select('*').eq('case_id', caseId);
    return (data as Relationship[]) || [];
  },

  async getShortestPath(caseId: string, sourceId: string, targetId: string): Promise<ShortestPathResult> {
    try {
      const res = await fetch(
        `${API_BASE}/relationships/shortest-path?case_id=${encodeURIComponent(caseId)}&source_id=${encodeURIComponent(sourceId)}&target_id=${encodeURIComponent(targetId)}`
      );
      if (res.ok) return await res.json();
    } catch (e) {
      console.error('Shortest path failed:', e);
    }
    return { found: false, path: [], path_names: [], length: 0, edge_types: [] };
  },

  // --- Ingestion Endpoints ---
  async extractText(caseId: string, title: string, content: string, sourceType: string = 'fir'): Promise<ExtractionResponse> {
    const res = await fetch(`${API_BASE}/ingest/extract-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ case_id: caseId, title, content, source_type: sourceType }),
    });
    if (!res.ok) throw new Error('Failed to extract from text');
    return await res.json();
  },

  async commitTextIngestion(payload: {
    case_id: string;
    title: string;
    source_type: string;
    content: string;
    entities: ExtractedEntityCandidate[];
    relationships: ExtractedRelationshipCandidate[];
  }) {
    const res = await fetch(`${API_BASE}/ingest/commit-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to commit text ingestion');
    return await res.json();
  },

  async ingestCDR(payload: { case_id: string; title: string; records: any[] }) {
    const res = await fetch(`${API_BASE}/ingest/cdr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to ingest CDR');
    return await res.json();
  },

  async ingestFinancial(payload: { case_id: string; title: string; records: any[] }) {
    const res = await fetch(`${API_BASE}/ingest/financial`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to ingest Financial records');
    return await res.json();
  },

  // --- Analytics & Anomalies Endpoints ---
  async getAnalytics(caseId: string): Promise<AnalyticsSummary> {
    const res = await fetch(`${API_BASE}/analytics/${encodeURIComponent(caseId)}`);
    if (!res.ok) throw new Error('Failed to calculate graph analytics');
    return await res.json();
  },

  async runAnomalies(caseId: string): Promise<Alert[]> {
    const res = await fetch(`${API_BASE}/analytics/${encodeURIComponent(caseId)}/run-anomalies`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to run anomaly detection');
    return await res.json();
  },

  async getAlerts(caseId: string): Promise<Alert[]> {
    try {
      const res = await fetch(`${API_BASE}/alerts?case_id=${encodeURIComponent(caseId)}`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend API fallback:', e);
    }
    const { data } = await supabase.from('alerts').select('*').eq('case_id', caseId).order('created_at', { ascending: false });
    return (data as Alert[]) || [];
  },

  async resolveAlert(alertId: string) {
    const res = await fetch(`${API_BASE}/alerts/${encodeURIComponent(alertId)}/resolve`, {
      method: 'PATCH',
    });
    if (!res.ok) throw new Error('Failed to resolve alert');
    return await res.json();
  },
};
