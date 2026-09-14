/*
# Criminal Network Analysis System - Core Schema

## Overview
Creates the complete database schema for an AI-powered criminal network analysis platform.
This is a single-tenant app with no authentication — all data is intentionally shared/public
for the investigation team using the system.

## New Tables

1. `cases` — Investigation cases that group entities, relationships, evidence, and alerts.
   - id (uuid, PK)
   - name (text, not null)
   - description (text)
   - status (text: 'open', 'closed', 'pending', default 'open')
   - priority (text: 'low', 'medium', 'high', 'critical', default 'medium')
   - created_at (timestamptz, default now())
   - updated_at (timestamptz, default now())

2. `entities` — People, organizations, locations, vehicles, phone numbers involved in cases.
   - id (uuid, PK)
   - case_id (uuid, FK to cases, cascade delete)
   - name (text, not null)
   - type (text: 'person', 'organization', 'location', 'vehicle', 'phone', 'email')
   - subtype (text, e.g. 'suspect', 'witness', 'victim' for persons)
   - metadata (jsonb — flexible attributes: age, address, plate, etc.)
   - risk_score (int, 0-100, default 0)
   - is_key_influencer (boolean, default false)
   - notes (text)
   - created_at (timestamptz, default now())

3. `relationships` — Connections between entities within a case.
   - id (uuid, PK)
   - case_id (uuid, FK to cases, cascade delete)
   - source_entity_id (uuid, FK to entities, cascade delete)
   - target_entity_id (uuid, FK to entities, cascade delete)
   - type (text: 'associate', 'family', 'financial', 'communication', 'location', 'organizational')
   - strength (int, 1-10, default 5)
   - description (text)
   - evidence_id (uuid, FK to evidence, nullable, cascade set null)
   - created_at (timestamptz, default now())

4. `evidence` — Raw intelligence data from various sources.
   - id (uuid, PK)
   - case_id (uuid, FK to cases, cascade delete)
   - entity_id (uuid, FK to entities, nullable, cascade set null — linked entity)
   - source_type (text: 'fir', 'cdr', 'financial', 'surveillance', 'social_media', 'criminal_history', 'intelligence_report')
   - title (text, not null)
   - content (text — raw text content for analysis)
   - extracted_data (jsonb — NLP extraction results)
   - status (text: 'pending', 'analyzed', 'flagged', default 'pending')
   - created_at (timestamptz, default now())

5. `alerts` — Suspicious pattern detections and warnings.
   - id (uuid, PK)
   - case_id (uuid, FK to cases, cascade delete)
   - entity_id (uuid, FK to entities, nullable, cascade set null)
   - alert_type (text: 'frequent_contact', 'financial_anomaly', 'hub_activity', 'co_occurrence', 'repeated_offense', 'network_cluster')
   - severity (text: 'low', 'medium', 'high', 'critical', default 'medium')
   - title (text, not null)
   - description (text)
   - is_resolved (boolean, default false)
   - created_at (timestamptz, default now())

6. `events` — Crime events or incidents linked to cases.
   - id (uuid, PK)
   - case_id (uuid, FK to cases, cascade delete)
   - title (text, not null)
   - description (text)
   - event_date (timestamptz)
   - location (text)
   - severity (text: 'low', 'medium', 'high', 'critical', default 'medium')
   - created_at (timestamptz, default now())

## Security
- RLS enabled on all tables.
- All tables use `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)` because
  this is a single-tenant, no-auth application where all data is intentionally shared.
- No user_id columns or auth.uid() checks — there is no sign-in flow.

## Indexes
- entities.case_id for case-scoped queries
- relationships.case_id, source_entity_id, target_entity_id for graph traversal
- evidence.case_id, status for filtering
- alerts.case_id, severity for prioritization
- events.case_id, event_date for timeline queries
*/

-- Cases table
CREATE TABLE IF NOT EXISTS cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'pending')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_cases" ON cases;
CREATE POLICY "anon_select_cases" ON cases FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_cases" ON cases;
CREATE POLICY "anon_insert_cases" ON cases FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_cases" ON cases;
CREATE POLICY "anon_update_cases" ON cases FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_cases" ON cases;
CREATE POLICY "anon_delete_cases" ON cases FOR DELETE TO anon, authenticated USING (true);

-- Entities table
CREATE TABLE IF NOT EXISTS entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('person', 'organization', 'location', 'vehicle', 'phone', 'email')),
  subtype text,
  metadata jsonb DEFAULT '{}'::jsonb,
  risk_score int NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  is_key_influencer boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_entities_case_id ON entities(case_id);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);

DROP POLICY IF EXISTS "anon_select_entities" ON entities;
CREATE POLICY "anon_select_entities" ON entities FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_entities" ON entities;
CREATE POLICY "anon_insert_entities" ON entities FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_entities" ON entities;
CREATE POLICY "anon_update_entities" ON entities FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_entities" ON entities;
CREATE POLICY "anon_delete_entities" ON entities FOR DELETE TO anon, authenticated USING (true);

-- Evidence table (created before relationships for FK)
CREATE TABLE IF NOT EXISTS evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES entities(id) ON DELETE SET NULL,
  source_type text NOT NULL CHECK (source_type IN ('fir', 'cdr', 'financial', 'surveillance', 'social_media', 'criminal_history', 'intelligence_report')),
  title text NOT NULL,
  content text,
  extracted_data jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'analyzed', 'flagged')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_evidence_case_id ON evidence(case_id);
CREATE INDEX IF NOT EXISTS idx_evidence_status ON evidence(status);

DROP POLICY IF EXISTS "anon_select_evidence" ON evidence;
CREATE POLICY "anon_select_evidence" ON evidence FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_evidence" ON evidence;
CREATE POLICY "anon_insert_evidence" ON evidence FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_evidence" ON evidence;
CREATE POLICY "anon_update_evidence" ON evidence FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_evidence" ON evidence;
CREATE POLICY "anon_delete_evidence" ON evidence FOR DELETE TO anon, authenticated USING (true);

-- Relationships table
CREATE TABLE IF NOT EXISTS relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  source_entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  target_entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('associate', 'family', 'financial', 'communication', 'location', 'organizational')),
  strength int NOT NULL DEFAULT 5 CHECK (strength >= 1 AND strength <= 10),
  description text,
  evidence_id uuid REFERENCES evidence(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_relationships_case_id ON relationships(case_id);
CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_entity_id);

DROP POLICY IF EXISTS "anon_select_relationships" ON relationships;
CREATE POLICY "anon_select_relationships" ON relationships FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_relationships" ON relationships;
CREATE POLICY "anon_insert_relationships" ON relationships FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_relationships" ON relationships;
CREATE POLICY "anon_update_relationships" ON relationships FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_relationships" ON relationships;
CREATE POLICY "anon_delete_relationships" ON relationships FOR DELETE TO anon, authenticated USING (true);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES entities(id) ON DELETE SET NULL,
  alert_type text NOT NULL CHECK (alert_type IN ('frequent_contact', 'financial_anomaly', 'hub_activity', 'co_occurrence', 'repeated_offense', 'network_cluster')),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title text NOT NULL,
  description text,
  is_resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_alerts_case_id ON alerts(case_id);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);

DROP POLICY IF EXISTS "anon_select_alerts" ON alerts;
CREATE POLICY "anon_select_alerts" ON alerts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_alerts" ON alerts;
CREATE POLICY "anon_insert_alerts" ON alerts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_alerts" ON alerts;
CREATE POLICY "anon_update_alerts" ON alerts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_alerts" ON alerts;
CREATE POLICY "anon_delete_alerts" ON alerts FOR DELETE TO anon, authenticated USING (true);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  event_date timestamptz,
  location text,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_events_case_id ON events(case_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);

DROP POLICY IF EXISTS "anon_select_events" ON events;
CREATE POLICY "anon_select_events" ON events FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_events" ON events;
CREATE POLICY "anon_insert_events" ON events FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_events" ON events;
CREATE POLICY "anon_update_events" ON events FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_events" ON events;
CREATE POLICY "anon_delete_events" ON events FOR DELETE TO anon, authenticated USING (true);

-- Auto-update updated_at on cases
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cases_updated_at ON cases;
CREATE TRIGGER trigger_cases_updated_at BEFORE UPDATE ON cases
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
