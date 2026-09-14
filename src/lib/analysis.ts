import type { Entity, Relationship, Alert } from './types';

export interface EntityExtractionResult {
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
  keywords: string[];
}

export interface ExtractedEntity {
  name: string;
  type: string;
  subtype: string | null;
  metadata: Record<string, string>;
}

export interface ExtractedRelationship {
  source: string;
  target: string;
  type: string;
  description: string;
}

const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const VEHICLE_REGEX = /\b([A-Z]{2}[-\s]?\d{1,2}[-\s]?[A-Z]{1,3}[-\s]?\d{1,4})\b/g;
const MONEY_REGEX = /(?:Rs\.?|INR|₹)\s?[\d,]+(?:\.\d+)?(?:\s?(?:crore|lakh|thousand|k|cr))?/gi;

const PERSON_KEYWORDS = [
  'suspect', 'accused', 'victim', 'witness', 'associate', 'known offender',
  'arrested', 'detained', 'interrogated', 'identified',
];

const ORG_KEYWORDS = [
  'gang', 'syndicate', 'organization', 'group', 'cartel', 'ring', 'network',
  'company', 'firm', 'enterprise',
];

const LOCATION_KEYWORDS = [
  'located at', 'found at', 'arrested at', 'residence', 'address', 'area',
  'district', 'sector', 'near', 'spot', 'venue',
];

const RELATIONSHIP_KEYWORDS: Record<string, string[]> = {
  family: ['brother', 'sister', 'father', 'mother', 'son', 'daughter', 'wife', 'husband', 'cousin', 'relative', 'family'],
  financial: ['transaction', 'transferred', 'paid', 'received', 'money', 'funds', 'payment', 'laundered', 'invested', 'Rs', 'INR', '₹'],
  communication: ['called', 'phone', 'contact', 'messaged', 'whatsapp', 'communicated', 'CDR', 'call record'],
  associate: ['associate', 'accomplice', 'partner', 'met', 'linked', 'connected', 'together', 'accompanied'],
  organizational: ['member', 'belongs to', 'part of', 'works for', 'joined', 'leads', 'founded'],
};

export function extractFromText(text: string): EntityExtractionResult {
  const entities: ExtractedEntity[] = [];
  const relationships: ExtractedRelationship[] = [];
  const keywords: string[] = [];
  const seenNames = new Set<string>();

  // Extract phone numbers
  const phones = text.match(PHONE_REGEX) || [];
  phones.forEach((phone, i) => {
    const clean = phone.trim();
    if (clean.length >= 7) {
      const name = `Phone ${clean}`;
      if (!seenNames.has(name)) {
        seenNames.add(name);
        entities.push({ name, type: 'phone', subtype: null, metadata: { number: clean } });
      }
    }
  });

  // Extract emails
  const emails = text.match(EMAIL_REGEX) || [];
  emails.forEach((email) => {
    const name = email.trim();
    if (!seenNames.has(name)) {
      seenNames.add(name);
      entities.push({ name, type: 'email', subtype: null, metadata: { address: name } });
    }
  });

  // Extract vehicle plates
  const vehicles = text.match(VEHICLE_REGEX) || [];
  vehicles.forEach((v) => {
    const plate = v.trim().toUpperCase();
    if (!seenNames.has(plate)) {
      seenNames.add(plate);
      entities.push({ name: plate, type: 'vehicle', subtype: null, metadata: { plate } });
    }
  });

  // Extract money amounts as keywords
  const money = text.match(MONEY_REGEX) || [];
  money.forEach((m) => keywords.push(m.trim()));

  // Extract person names using capitalized word patterns near keywords
  const sentences = text.split(/[.!?]+/);
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();

    // Check for person keywords
    for (const kw of PERSON_KEYWORDS) {
      if (lower.includes(kw)) {
        const capitalizedNames = sentence.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/g) || [];
        for (const name of capitalizedNames) {
          if (!seenNames.has(name) && name.length > 4 && !['The', 'This', 'That', 'These', 'Those', 'FIR', 'First', 'Information'].includes(name)) {
            seenNames.add(name);
            const subtype = kw === 'victim' ? 'victim' : kw === 'witness' ? 'witness' : 'suspect';
            entities.push({ name, type: 'person', subtype, metadata: { context: kw } });
          }
        }
        break;
      }
    }

    // Check for org keywords
    for (const kw of ORG_KEYWORDS) {
      if (lower.includes(kw)) {
        const orgNames = sentence.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Gang|Syndicate|Cartel|Group|Ring|Organization|Company|Firm|Enterprise)\b/g) || [];
        for (const name of orgNames) {
          if (!seenNames.has(name)) {
            seenNames.add(name);
            entities.push({ name: name.trim(), type: 'organization', subtype: null, metadata: { context: kw } });
          }
        }
        break;
      }
    }

    // Check for location keywords
    for (const kw of LOCATION_KEYWORDS) {
      if (lower.includes(kw)) {
        const locNames = sentence.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Area|District|Sector|Colony|Nagar|Marg|Road|Street|Park)\b/g) || [];
        for (const name of locNames) {
          if (!seenNames.has(name)) {
            seenNames.add(name);
            entities.push({ name: name.trim(), type: 'location', subtype: null, metadata: { context: kw } });
          }
        }
        break;
      }
    }
  }

  // Extract relationships by scanning for keywords between entity names
  for (const sentence of sentences) {
    for (const [relType, kws] of Object.entries(RELATIONSHIP_KEYWORDS)) {
      for (const kw of kws) {
        if (sentence.toLowerCase().includes(kw)) {
          const namesInSentence = entities.filter((e) =>
            e.type === 'person' && sentence.includes(e.name)
          );
          if (namesInSentence.length >= 2) {
            for (let i = 0; i < namesInSentence.length; i++) {
              for (let j = i + 1; j < namesInSentence.length; j++) {
                relationships.push({
                  source: namesInSentence[i].name,
                  target: namesInSentence[j].name,
                  type: relType,
                  description: `Detected via keyword "${kw}" in text`,
                });
              }
            }
          }
          break;
        }
      }
    }
  }

  // Extract general keywords
  const allKeywords = [...PERSON_KEYWORDS, ...ORG_KEYWORDS];
  for (const kw of allKeywords) {
    if (text.toLowerCase().includes(kw)) {
      keywords.push(kw);
    }
  }

  return { entities, relationships, keywords: [...new Set(keywords)] };
}

export interface CentralityResult {
  entityId: string;
  degree: number;
  betweenness: number;
  influence: number;
}

export function computeDegreeCentrality(
  entities: Entity[],
  relationships: Relationship[]
): Map<string, CentralityResult> {
  const degreeMap = new Map<string, number>();
  for (const e of entities) {
    degreeMap.set(e.id, 0);
  }
  for (const r of relationships) {
    degreeMap.set(r.source_entity_id, (degreeMap.get(r.source_entity_id) || 0) + 1);
    degreeMap.set(r.target_entity_id, (degreeMap.get(r.target_entity_id) || 0) + 1);
  }

  const results = new Map<string, CentralityResult>();
  for (const e of entities) {
    const degree = degreeMap.get(e.id) || 0;
    const maxDegree = Math.max(...Array.from(degreeMap.values()), 1);
    const normalizedDegree = maxDegree > 0 ? degree / maxDegree : 0;
    const influence = Math.round(normalizedDegree * 60 + (e.risk_score / 100) * 40);
    results.set(e.id, {
      entityId: e.id,
      degree,
      betweenness: normalizedDegree,
      influence,
    });
  }
  return results;
}

export function detectPatterns(
  entities: Entity[],
  relationships: Relationship[],
  caseId: string
): Omit<Alert, 'id' | 'case_id' | 'entity_id' | 'is_resolved' | 'created_at'>[] {
  const alerts: Omit<Alert, 'id' | 'case_id' | 'entity_id' | 'is_resolved' | 'created_at'>[] = [];
  const centrality = computeDegreeCentrality(entities, relationships);

  // Hub activity: entities with degree >= 5
  for (const [entityId, result] of centrality) {
    if (result.degree >= 5) {
      const entity = entities.find((e) => e.id === entityId);
      alerts.push({
        alert_type: 'hub_activity',
        severity: result.degree >= 8 ? 'critical' : 'high',
        title: `Hub Activity: ${entity?.name ?? 'Unknown'}`,
        description: `${entity?.name ?? 'Entity'} has ${result.degree} connections (influence score: ${result.influence}), acting as a central hub in the network.`,
      });
    }
  }

  // Frequent contact: pairs with multiple relationships
  const pairCount = new Map<string, number>();
  for (const r of relationships) {
    const key = [r.source_entity_id, r.target_entity_id].sort().join('|');
    pairCount.set(key, (pairCount.get(key) || 0) + 1);
  }
  for (const [key, count] of pairCount) {
    if (count >= 3) {
      const [id1, id2] = key.split('|');
      const e1 = entities.find((e) => e.id === id1);
      const e2 = entities.find((e) => e.id === id2);
      alerts.push({
        alert_type: 'frequent_contact',
        severity: count >= 5 ? 'high' : 'medium',
        title: `Frequent Contact: ${e1?.name ?? '?'} ↔ ${e2?.name ?? '?'}`,
        description: `${e1?.name ?? 'Entity 1'} and ${e2?.name ?? 'Entity 2'} are connected through ${count} separate relationships, suggesting a strong operational link.`,
      });
    }
  }

  // Financial anomaly: entities with many financial relationships
  for (const entity of entities) {
    const financialRels = relationships.filter(
      (r) =>
        r.type === 'financial' &&
        (r.source_entity_id === entity.id || r.target_entity_id === entity.id)
    );
    if (financialRels.length >= 3) {
      alerts.push({
        alert_type: 'financial_anomaly',
        severity: financialRels.length >= 5 ? 'high' : 'medium',
        title: `Financial Anomaly: ${entity.name}`,
        description: `${entity.name} is involved in ${financialRels.length} financial transactions, which may indicate money laundering or structured financial activity.`,
      });
    }
  }

  // Repeated offense: high risk score entities
  for (const entity of entities) {
    if (entity.risk_score >= 70) {
      alerts.push({
        alert_type: 'repeated_offense',
        severity: entity.risk_score >= 85 ? 'critical' : 'high',
        title: `High-Risk Individual: ${entity.name}`,
        description: `${entity.name} has a risk score of ${entity.risk_score}/100, indicating a pattern of repeated criminal activity.`,
      });
    }
  }

  return alerts;
}

export const ENTITY_TYPE_LABELS: Record<string, string> = {
  person: 'Person',
  organization: 'Organization',
  location: 'Location',
  vehicle: 'Vehicle',
  phone: 'Phone',
  email: 'Email',
};

export const RELATIONSHIP_TYPE_LABELS: Record<string, string> = {
  associate: 'Associate',
  family: 'Family',
  financial: 'Financial',
  communication: 'Communication',
  location: 'Location',
  organizational: 'Organizational',
};

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  fir: 'FIR / Police Report',
  cdr: 'Call Detail Record',
  financial: 'Financial Record',
  surveillance: 'Surveillance Report',
  social_media: 'Social Media Intelligence',
  criminal_history: 'Criminal History',
  intelligence_report: 'Intelligence Report',
};

export const ALERT_TYPE_LABELS: Record<string, string> = {
  frequent_contact: 'Frequent Contact',
  financial_anomaly: 'Financial Anomaly',
  hub_activity: 'Hub Activity',
  co_occurrence: 'Co-occurrence',
  repeated_offense: 'Repeated Offense',
  network_cluster: 'Network Cluster',
};

export const SEVERITY_COLORS: Record<string, string> = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
};

export const ENTITY_TYPE_COLORS: Record<string, string> = {
  person: '#3b82f6',
  organization: '#f59e0b',
  location: '#10b981',
  vehicle: '#8b5cf6',
  phone: '#06b6d4',
  email: '#ec4899',
};
