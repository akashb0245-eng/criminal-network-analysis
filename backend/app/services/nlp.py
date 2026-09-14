"""
NLP and Entity Extraction Service for SENTINEL
Provides hybrid extraction (NLP heuristics + Indian context identifiers + provenance tracking)
"""
import re
from typing import List, Dict, Any, Tuple, Set
from app.models.schemas import ExtractedEntity, ExtractedRelationship, EntityType, RelationshipType

# --- REGEX IDENTIFIERS (Indian & International context) ---
PHONE_REGEX = re.compile(r'(?:\+91[-.\s]?)?[6-9]\d{9}|\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b')
EMAIL_REGEX = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
VEHICLE_REGEX = re.compile(r'\b([A-Z]{2}[-\s]?\d{1,2}[-\s]?[A-Z]{1,3}[-\s]?\d{1,4})\b')
PAN_REGEX = re.compile(r'\b([A-Z]{5}[0-9]{4}[A-Z])\b')
AADHAAR_REGEX = re.compile(r'\b(\d{4}\s\d{4}\s\d{4})\b')
MONEY_REGEX = re.compile(r'(?:Rs\.?|INR|₹)\s?([\d,]+(?:\.\d+)?(?:\s?(?:crore|lakh|thousand|k|cr))?)', re.IGNORECASE)
ACCOUNT_REGEX = re.compile(r'(?:A/C|Account|Acc\.?|Acc\sNo\.?|A/c\sno\.?)\s?[:#-]?\s?(\d{9,18})', re.IGNORECASE)

# Stopwords & noise filters to eliminate false positive entity names
FALSE_POSITIVE_NAMES = {
    'First Information Report', 'First Information', 'Information Report', 'The Accused', 
    'The Suspect', 'Police Station', 'High Court', 'Supreme Court', 'District Court',
    'Crime Branch', 'Special Cell', 'Call Detail', 'Call Details', 'Call Record',
    'Bank Account', 'Savings Account', 'Current Account', 'Mobile Number', 'Phone Number',
    'Vehicle Registration', 'Investigation Officer', 'Sub Inspector', 'Assistant Commissioner',
    'State Bank', 'Union Bank', 'Hdfc Bank', 'Icici Bank', 'Axis Bank', 'On March', 'On April',
    'On January', 'On February', 'On May', 'On June', 'On July', 'On August', 'On September',
    'On October', 'On November', 'On December', 'This Case', 'That Day', 'Near Spot'
}

# Context trigger dictionaries
PERSON_TRIGGERS = {
    'suspect': ('suspect', 0.90),
    'accused': ('suspect', 0.95),
    'arrested': ('suspect', 0.95),
    'detained': ('suspect', 0.85),
    'interrogated': ('suspect', 0.85),
    'mastermind': ('suspect', 0.95),
    'kingpin': ('suspect', 0.95),
    'gangster': ('suspect', 0.95),
    'victim': ('victim', 0.90),
    'witness': ('witness', 0.85),
    'informant': ('informant', 0.85),
    'associate': ('associate', 0.80),
    'handler': ('suspect', 0.90),
    'operator': ('suspect', 0.85)
}

ORG_SUFFIXES = [
    'Gang', 'Syndicate', 'Cartel', 'Group', 'Ring', 'Network', 'Enterprise', 
    'Enterprises', 'Outfit', 'Modules', 'Module', 'Faction', 'Traders', 'Logistics',
    'Corporation', 'Pvt Ltd', 'LLP', 'Agency', 'Front'
]

LOCATION_INDICATORS = [
    'Sector', 'Colony', 'Nagar', 'Marg', 'Road', 'Street', 'Enclave', 'Vihar',
    'Bagh', 'Chowk', 'Bazaar', 'District', 'Police Station', 'Border', 'Airport',
    'Railway Station', 'Toll Plaza', 'Hideout', 'Warehouse', 'Safehouse'
]

RELATIONSHIP_PATTERNS: Dict[RelationshipType, List[Tuple[str, int, str]]] = {
    'family': [
        ('brother of', 9, 'Brother'), ('sister of', 9, 'Sister'), ('father of', 9, 'Father'),
        ('mother of', 9, 'Mother'), ('son of', 9, 'Son'), ('daughter of', 9, 'Daughter'),
        ('wife of', 10, 'Spouse/Wife'), ('husband of', 10, 'Spouse/Husband'),
        ('cousin', 7, 'Cousin'), ('relative', 6, 'Relative'), ('family', 7, 'Family member')
    ],
    'financial': [
        ('transferred', 8, 'Fund Transfer'), ('transferred to', 8, 'Fund Transfer'),
        ('paid to', 7, 'Payment'), ('received from', 8, 'Received Funds'),
        ('laundered', 9, 'Money Laundering'), ('bank transfer', 8, 'Bank Transfer'),
        ('cash payment', 7, 'Cash Handover'), ('invested in', 7, 'Investment'),
        ('hawala', 10, 'Hawala Channel'), ('funded', 8, 'Financing')
    ],
    'communication': [
        ('called', 7, 'Phone Call'), ('frequently contacted', 9, 'Frequent Calls'),
        ('contacted', 6, 'Communication'), ('messaged', 6, 'Messaging'),
        ('whatsapp', 8, 'Encrypted Chat'), ('telegram', 8, 'Encrypted Chat'),
        ('signal', 8, 'Encrypted Chat'), ('CDR shows', 8, 'Call Detail Records')
    ],
    'associate': [
        ('associate of', 8, 'Criminal Associate'), ('accomplice', 9, 'Accomplice'),
        ('partner in', 8, 'Partner'), ('met with', 7, 'Physical Meeting'),
        ('spotted with', 7, 'Surveillance Sighting'), ('traveled with', 7, 'Joint Travel'),
        ('co-accused', 9, 'Co-Accused')
    ],
    'organizational': [
        ('member of', 8, 'Gang Member'), ('belongs to', 8, 'Affiliate'),
        ('works for', 7, 'Operative'), ('leads', 10, 'Leader/Kingpin'),
        ('headed by', 9, 'Leadership'), ('part of', 7, 'Syndicate Member'),
        ('founded', 9, 'Founder')
    ],
    'location': [
        ('residing at', 7, 'Residence'), ('spotted at', 7, 'Sighting Location'),
        ('arrested at', 9, 'Arrest Location'), ('operated from', 8, 'Base of Operation'),
        ('hideout at', 9, 'Hideout Location')
    ]
}

class NLPExtractionEngine:
    @classmethod
    def extract(cls, text: str) -> Dict[str, Any]:
        entities: List[ExtractedEntity] = []
        relationships: List[ExtractedRelationship] = []
        keywords: Set[str] = set()
        seen_entities: Dict[str, ExtractedEntity] = {}

        # 1. Deterministic Extraction of Structured Identifiers
        # Phones
        for match in PHONE_REGEX.finditer(text):
            raw = match.group().strip()
            clean = re.sub(r'[-.\s()]', '', raw)
            if len(clean) >= 10:
                name = f"Phone {raw}"
                if name not in seen_entities:
                    ent = ExtractedEntity(
                        name=name,
                        type='phone',
                        subtype='mobile',
                        metadata={"raw_number": raw, "normalized": clean},
                        confidence=0.98,
                        provenance=text[max(0, match.start()-20):min(len(text), match.end()+20)],
                        start_char=match.start(),
                        end_char=match.end()
                    )
                    seen_entities[name] = ent
                    entities.append(ent)

        # Emails
        for match in EMAIL_REGEX.finditer(text):
            email = match.group().strip().lower()
            if email not in seen_entities:
                ent = ExtractedEntity(
                    name=email,
                    type='email',
                    subtype='email',
                    metadata={"address": email},
                    confidence=0.99,
                    provenance=text[max(0, match.start()-20):min(len(text), match.end()+20)],
                    start_char=match.start(),
                    end_char=match.end()
                )
                seen_entities[email] = ent
                entities.append(ent)

        # Vehicle Plates
        for match in VEHICLE_REGEX.finditer(text):
            plate = match.group().strip().upper()
            if len(plate) >= 6 and plate not in seen_entities:
                ent = ExtractedEntity(
                    name=plate,
                    type='vehicle',
                    subtype='registration_plate',
                    metadata={"plate": plate},
                    confidence=0.92,
                    provenance=text[max(0, match.start()-20):min(len(text), match.end()+20)],
                    start_char=match.start(),
                    end_char=match.end()
                )
                seen_entities[plate] = ent
                entities.append(ent)

        # Bank Accounts
        for match in ACCOUNT_REGEX.finditer(text):
            acc_num = match.group(1).strip()
            name = f"A/C {acc_num}"
            if name not in seen_entities:
                ent = ExtractedEntity(
                    name=name,
                    type='bank_account',
                    subtype='bank_account',
                    metadata={"account_number": acc_num},
                    confidence=0.95,
                    provenance=text[max(0, match.start()-20):min(len(text), match.end()+20)],
                    start_char=match.start(),
                    end_char=match.end()
                )
                seen_entities[name] = ent
                entities.append(ent)

        # Currency amounts as keywords
        for match in MONEY_REGEX.finditer(text):
            keywords.add(f"₹{match.group(1).strip()}")

        # 2. Extract Named Entities from Text Contexts
        sentences = re.split(r'(?<=[.!?])\s+', text)
        
        for sentence in sentences:
            sentence_clean = sentence.strip()
            if not sentence_clean:
                continue

            # Person Names (Capturing Multi-word Title-cased phrases)
            person_candidates = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b', sentence_clean)
            for cand in person_candidates:
                cand_clean = cand.strip()
                if cand_clean in FALSE_POSITIVE_NAMES or len(cand_clean) < 4:
                    continue
                
                # Determine subtype & confidence by proximity to triggers
                subtype = 'person'
                confidence = 0.80
                context_str = sentence_clean
                
                sent_lower = sentence_clean.lower()
                for trig, (sub, conf) in PERSON_TRIGGERS.items():
                    if trig in sent_lower:
                        subtype = sub
                        confidence = conf
                        break
                
                if cand_clean not in seen_entities:
                    start_idx = text.find(cand_clean)
                    ent = ExtractedEntity(
                        name=cand_clean,
                        type='person',
                        subtype=subtype,
                        metadata={"context": context_str[:120]},
                        confidence=confidence,
                        provenance=context_str[:160],
                        start_char=start_idx if start_idx != -1 else None,
                        end_char=start_idx + len(cand_clean) if start_idx != -1 else None
                    )
                    seen_entities[cand_clean] = ent
                    entities.append(ent)

            # Organizations
            for org_suffix in ORG_SUFFIXES:
                org_matches = re.findall(rf'\b(?:[A-Z][a-z]+\s+)+{org_suffix}\b', sentence_clean)
                for org in org_matches:
                    org_clean = org.strip()
                    if org_clean not in seen_entities and org_clean not in FALSE_POSITIVE_NAMES:
                        start_idx = text.find(org_clean)
                        ent = ExtractedEntity(
                            name=org_clean,
                            type='organization',
                            subtype='gang' if 'Gang' in org_clean or 'Syndicate' in org_clean or 'Cartel' in org_clean else 'enterprise',
                            metadata={"org_type": org_suffix},
                            confidence=0.88,
                            provenance=sentence_clean[:160],
                            start_char=start_idx if start_idx != -1 else None,
                            end_char=start_idx + len(org_clean) if start_idx != -1 else None
                        )
                        seen_entities[org_clean] = ent
                        entities.append(ent)

            # Locations
            for loc_ind in LOCATION_INDICATORS:
                loc_matches = re.findall(rf'\b(?:[A-Z][a-z]+\s+)*[A-Z][a-z]+\s+{loc_ind}\b|\b{loc_ind}\s+\d+\b', sentence_clean)
                for loc in loc_matches:
                    loc_clean = loc.strip()
                    if loc_clean not in seen_entities and loc_clean not in FALSE_POSITIVE_NAMES:
                        start_idx = text.find(loc_clean)
                        ent = ExtractedEntity(
                            name=loc_clean,
                            type='location',
                            subtype='area',
                            metadata={"location_type": loc_ind},
                            confidence=0.85,
                            provenance=sentence_clean[:160],
                            start_char=start_idx if start_idx != -1 else None,
                            end_char=start_idx + len(loc_clean) if start_idx != -1 else None
                        )
                        seen_entities[loc_clean] = ent
                        entities.append(ent)

        # 3. Contextual Relationship Extraction with Provenance
        seen_rels: Set[Tuple[str, str, str]] = set()

        for sentence in sentences:
            sent_lower = sentence.lower()
            
            # Find entities mentioned in this sentence
            entities_in_sentence = [
                e for e in entities 
                if e.name.lower() in sent_lower or (e.type == 'phone' and e.metadata.get('raw_number', '') in sentence)
            ]
            
            if len(entities_in_sentence) >= 2:
                for rel_type, pattern_list in RELATIONSHIP_PATTERNS.items():
                    for pattern, strength, label in pattern_list:
                        if pattern.lower() in sent_lower:
                            for i in range(len(entities_in_sentence)):
                                for j in range(i + 1, len(entities_in_sentence)):
                                    e1 = entities_in_sentence[i]
                                    e2 = entities_in_sentence[j]
                                    
                                    # Form valid relationship key
                                    rel_key = (e1.name, e2.name, rel_type)
                                    if rel_key not in seen_rels and (e2.name, e1.name, rel_type) not in seen_rels:
                                        seen_rels.add(rel_key)
                                        relationships.append(ExtractedRelationship(
                                            source=e1.name,
                                            target=e2.name,
                                            type=rel_type,
                                            strength=strength,
                                            description=f"{label}: \"{sentence.strip()[:140]}\"",
                                            confidence=0.85,
                                            evidence_snippet=sentence.strip()
                                        ))
                            break

        return {
            "entities": entities,
            "relationships": relationships,
            "keywords": sorted(list(keywords)),
            "summary": {
                "entity_count": len(entities),
                "relationship_count": len(relationships),
                "by_type": {t: sum(1 for e in entities if e.type == t) for t in set(e.type for e in entities)}
            }
        }
