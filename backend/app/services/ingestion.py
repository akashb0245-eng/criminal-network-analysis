"""
Data Ingestion Service for SENTINEL
Handles structured CDR parsing, Financial Ledger CSV parsing, and Text/FIR extraction with Entity Resolution.
"""
import uuid
from typing import List, Dict, Any, Tuple
from app.models.schemas import (
    CDRRecord, FinancialRecord, ExtractedEntity, ExtractedRelationship,
    IngestionCommitResponse
)
from app.services.db import DatabaseService
from app.services.nlp import NLPExtractionEngine
from app.services.resolution import EntityResolutionEngine

class IngestionService:
    @classmethod
    def ingest_text_report(
        cls,
        case_id: str,
        title: str,
        source_type: str,
        content: str,
        selected_entities: List[ExtractedEntity],
        selected_relationships: List[ExtractedRelationship]
    ) -> IngestionCommitResponse:
        """
        Commits verified extracted text report to database with entity resolution.
        """
        existing_entities = DatabaseService.get_entities(case_id)
        
        # 1. Create Evidence Record
        evidence_record = DatabaseService.create_evidence({
            "case_id": case_id,
            "title": title or "Intelligence Report",
            "source_type": source_type or "fir",
            "content": content,
            "extracted_data": {
                "entity_count": len(selected_entities),
                "relationship_count": len(selected_relationships)
            },
            "status": "analyzed"
        })
        evidence_id = evidence_record["id"]

        # 2. Resolve or Create Entities
        name_to_entity_id: Dict[str, str] = {}
        entities_to_create: List[Dict[str, Any]] = []
        created_count = 0
        linked_count = 0

        for candidate in selected_entities:
            # Check if candidate resolves to existing database entity
            matched_id, explanation, confidence = EntityResolutionEngine.resolve_entity(
                candidate_name=candidate.name,
                candidate_type=candidate.type,
                candidate_metadata=candidate.metadata,
                existing_entities=existing_entities
            )

            if matched_id:
                name_to_entity_id[candidate.name] = matched_id
                linked_count += 1
            else:
                new_id = str(uuid.uuid4())
                name_to_entity_id[candidate.name] = new_id
                
                # Default risk score based on subtype
                risk_score = 75 if candidate.subtype == 'suspect' else 40 if candidate.subtype == 'gang' else 20
                
                entity_dict = {
                    "id": new_id,
                    "case_id": case_id,
                    "name": candidate.name,
                    "type": candidate.type,
                    "subtype": candidate.subtype,
                    "metadata": {**candidate.metadata, "provenance": candidate.provenance},
                    "risk_score": risk_score,
                    "is_key_influencer": False,
                    "notes": f"Extracted from: {title}"
                }
                entities_to_create.append(entity_dict)
                existing_entities.append(entity_dict) # Keep memory pool updated for subsequent checks in this batch
                created_count += 1

        if entities_to_create:
            DatabaseService.create_entities_batch(entities_to_create)

        # 3. Create Relationships
        relationships_to_create: List[Dict[str, Any]] = []
        for rel in selected_relationships:
            src_id = name_to_entity_id.get(rel.source)
            tgt_id = name_to_entity_id.get(rel.target)
            
            if src_id and tgt_id and src_id != tgt_id:
                relationships_to_create.append({
                    "case_id": case_id,
                    "source_entity_id": src_id,
                    "target_entity_id": tgt_id,
                    "type": rel.type,
                    "strength": rel.strength,
                    "description": rel.description,
                    "evidence_id": evidence_id
                })

        if relationships_to_create:
            DatabaseService.create_relationships_batch(relationships_to_create)

        return IngestionCommitResponse(
            evidence_id=evidence_id,
            entities_created=created_count,
            entities_linked=linked_count,
            relationships_created=len(relationships_to_create)
        )

    @classmethod
    def ingest_cdr(
        cls,
        case_id: str,
        title: str,
        records: List[CDRRecord]
    ) -> IngestionCommitResponse:
        """
        Parses Call Detail Records (CDR), creates phone entities and aggregated communication edges.
        """
        existing_entities = DatabaseService.get_entities(case_id)
        
        # 1. Create Evidence log
        evidence_record = DatabaseService.create_evidence({
            "case_id": case_id,
            "title": title or "CDR Logs Import",
            "source_type": "cdr",
            "content": f"Ingested {len(records)} Call Detail Records",
            "extracted_data": {"record_count": len(records)},
            "status": "analyzed"
        })
        evidence_id = evidence_record["id"]

        # 2. Extract and Aggregate Phone Pairs
        phone_to_entity_id: Dict[str, str] = {}
        entities_to_create: List[Dict[str, Any]] = []
        created_count = 0
        linked_count = 0

        # Find or create entities for all phone numbers
        all_phones = set([r.caller_phone for r in records] + [r.receiver_phone for r in records])
        
        for phone in all_phones:
            clean_phone = phone.strip()
            name = f"Phone {clean_phone}"
            
            matched_id, _, _ = EntityResolutionEngine.resolve_entity(
                candidate_name=name,
                candidate_type='phone',
                candidate_metadata={"raw_number": clean_phone},
                existing_entities=existing_entities
            )

            if matched_id:
                phone_to_entity_id[clean_phone] = matched_id
                linked_count += 1
            else:
                new_id = str(uuid.uuid4())
                phone_to_entity_id[clean_phone] = new_id
                entity_dict = {
                    "id": new_id,
                    "case_id": case_id,
                    "name": name,
                    "type": "phone",
                    "subtype": "mobile",
                    "metadata": {"number": clean_phone},
                    "risk_score": 30,
                    "is_key_influencer": False,
                    "notes": f"Identified via CDR logs"
                }
                entities_to_create.append(entity_dict)
                existing_entities.append(entity_dict)
                created_count += 1

        if entities_to_create:
            DatabaseService.create_entities_batch(entities_to_create)

        # 3. Aggregate Call Relationships between Pairs
        pair_aggregates: Dict[Tuple[str, str], Dict[str, Any]] = {}
        for r in records:
            p1 = phone_to_entity_id.get(r.caller_phone.strip())
            p2 = phone_to_entity_id.get(r.receiver_phone.strip())
            if p1 and p2 and p1 != p2:
                pair_key = (p1, p2)
                if pair_key not in pair_aggregates:
                    pair_aggregates[pair_key] = {
                        "call_count": 0,
                        "total_duration": 0,
                        "towers": set(),
                        "first_call": r.timestamp,
                        "last_call": r.timestamp
                    }
                pair_aggregates[pair_key]["call_count"] += 1
                pair_aggregates[pair_key]["total_duration"] += r.duration_sec
                if r.cell_tower:
                    pair_aggregates[pair_key]["towers"].add(r.cell_tower)
                pair_aggregates[pair_key]["last_call"] = r.timestamp

        # Create relationship rows
        relationships_to_create: List[Dict[str, Any]] = []
        for (src_id, tgt_id), stats in pair_aggregates.items():
            strength = min(10, max(1, stats["call_count"] // 2 + 1))
            towers_str = f", Towers: {', '.join(list(stats['towers'])[:3])}" if stats["towers"] else ""
            desc = f"CDR: {stats['call_count']} calls ({stats['total_duration']}s total duration{towers_str})"
            
            relationships_to_create.append({
                "case_id": case_id,
                "source_entity_id": src_id,
                "target_entity_id": tgt_id,
                "type": "communication",
                "strength": strength,
                "description": desc,
                "evidence_id": evidence_id
            })

        if relationships_to_create:
            DatabaseService.create_relationships_batch(relationships_to_create)

        return IngestionCommitResponse(
            evidence_id=evidence_id,
            entities_created=created_count,
            entities_linked=linked_count,
            relationships_created=len(relationships_to_create)
        )

    @classmethod
    def ingest_financial(
        cls,
        case_id: str,
        title: str,
        records: List[FinancialRecord]
    ) -> IngestionCommitResponse:
        """
        Parses Financial Ledger CSVs, creates Bank Account entities and directional financial flow edges.
        """
        existing_entities = DatabaseService.get_entities(case_id)
        
        evidence_record = DatabaseService.create_evidence({
            "case_id": case_id,
            "title": title or "Financial Transaction Ledger",
            "source_type": "financial",
            "content": f"Ingested {len(records)} Financial Transactions",
            "extracted_data": {"transaction_count": len(records)},
            "status": "analyzed"
        })
        evidence_id = evidence_record["id"]

        acc_to_entity_id: Dict[str, str] = {}
        entities_to_create: List[Dict[str, Any]] = []
        created_count = 0
        linked_count = 0

        # Identify all accounts and holders
        all_accounts = {}
        for r in records:
            src_acc = r.source_account.strip()
            tgt_acc = r.target_account.strip()
            if src_acc not in all_accounts:
                all_accounts[src_acc] = r.source_holder
            if tgt_acc not in all_accounts:
                all_accounts[tgt_acc] = r.target_holder

        for acc_num, holder in all_accounts.items():
            name = f"{holder} (A/C {acc_num})" if holder else f"A/C {acc_num}"
            ent_type = 'person' if holder else 'bank_account'
            
            matched_id, _, _ = EntityResolutionEngine.resolve_entity(
                candidate_name=name,
                candidate_type=ent_type,
                candidate_metadata={"account_number": acc_num},
                existing_entities=existing_entities
            )

            if matched_id:
                acc_to_entity_id[acc_num] = matched_id
                linked_count += 1
            else:
                new_id = str(uuid.uuid4())
                acc_to_entity_id[acc_num] = new_id
                entity_dict = {
                    "id": new_id,
                    "case_id": case_id,
                    "name": name,
                    "type": ent_type,
                    "subtype": "bank_account",
                    "metadata": {"account_number": acc_num, "holder": holder},
                    "risk_score": 40,
                    "is_key_influencer": False,
                    "notes": "Extracted from Financial Records"
                }
                entities_to_create.append(entity_dict)
                existing_entities.append(entity_dict)
                created_count += 1

        if entities_to_create:
            DatabaseService.create_entities_batch(entities_to_create)

        # Aggregate transfers
        pair_aggregates: Dict[Tuple[str, str], Dict[str, Any]] = {}
        for r in records:
            src_id = acc_to_entity_id.get(r.source_account.strip())
            tgt_id = acc_to_entity_id.get(r.target_account.strip())
            if src_id and tgt_id and src_id != tgt_id:
                pair_key = (src_id, tgt_id)
                if pair_key not in pair_aggregates:
                    pair_aggregates[pair_key] = {
                        "txn_count": 0,
                        "total_amount": 0.0,
                        "currency": r.currency,
                        "first_date": r.timestamp,
                        "last_date": r.timestamp,
                        "notes": []
                    }
                pair_aggregates[pair_key]["txn_count"] += 1
                pair_aggregates[pair_key]["total_amount"] += r.amount
                if r.notes:
                    pair_aggregates[pair_key]["notes"].append(r.notes)
                pair_aggregates[pair_key]["last_date"] = r.timestamp

        relationships_to_create: List[Dict[str, Any]] = []
        for (src_id, tgt_id), stats in pair_aggregates.items():
            strength = min(10, max(1, int(stats["total_amount"] / 100000) + 1))
            formatted_amt = f"₹{stats['total_amount']:,.2f}" if stats['currency'] == 'INR' else f"{stats['currency']} {stats['total_amount']:,.2f}"
            desc = f"Financial Flow: {stats['txn_count']} transfers totaling {formatted_amt}"
            
            relationships_to_create.append({
                "case_id": case_id,
                "source_entity_id": src_id,
                "target_entity_id": tgt_id,
                "type": "financial",
                "strength": strength,
                "description": desc,
                "evidence_id": evidence_id
            })

        if relationships_to_create:
            DatabaseService.create_relationships_batch(relationships_to_create)

        return IngestionCommitResponse(
            evidence_id=evidence_id,
            entities_created=created_count,
            entities_linked=linked_count,
            relationships_created=len(relationships_to_create)
        )
