"""
Database service wrapping Supabase client with in-memory store fallback.
"""
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from app.config import settings

# Initialize Supabase client if credentials present
supabase_client = None
if settings.SUPABASE_URL and settings.SUPABASE_ANON_KEY:
    try:
        from supabase import create_client
        supabase_client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY
        )
    except Exception as e:
        print(f"Warning: Could not initialize Supabase client: {e}")

# In-memory store for offline fallback / caching
class MemoryStore:
    def __init__(self):
        self.cases: Dict[str, Dict[str, Any]] = {}
        self.entities: Dict[str, Dict[str, Any]] = {}
        self.relationships: Dict[str, Dict[str, Any]] = {}
        self.evidence: Dict[str, Dict[str, Any]] = {}
        self.alerts: Dict[str, Dict[str, Any]] = {}
        self.events: Dict[str, Dict[str, Any]] = {}

memory_store = MemoryStore()

def now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"

class DatabaseService:
    @staticmethod
    def get_cases() -> List[Dict[str, Any]]:
        if supabase_client:
            try:
                res = supabase_client.table('cases').select('*').order('created_at', desc=True).execute()
                if res.data is not None:
                    # Sync to memory store
                    for c in res.data:
                        memory_store.cases[c['id']] = c
                    return res.data
            except Exception as e:
                print(f"Supabase error fetching cases: {e}")
        return sorted(list(memory_store.cases.values()), key=lambda x: x.get('created_at', ''), reverse=True)

    @staticmethod
    def get_case(case_id: str) -> Optional[Dict[str, Any]]:
        if supabase_client:
            try:
                res = supabase_client.table('cases').select('*').eq('id', case_id).execute()
                if res.data and len(res.data) > 0:
                    c = res.data[0]
                    memory_store.cases[c['id']] = c
                    return c
            except Exception as e:
                print(f"Supabase error fetching case {case_id}: {e}")
        return memory_store.cases.get(case_id)

    @staticmethod
    def create_case(data: Dict[str, Any]) -> Dict[str, Any]:
        case_id = str(uuid.uuid4())
        record = {
            "id": case_id,
            "name": data["name"],
            "description": data.get("description"),
            "status": data.get("status", "open"),
            "priority": data.get("priority", "medium"),
            "created_at": now_iso(),
            "updated_at": now_iso()
        }
        if supabase_client:
            try:
                res = supabase_client.table('cases').insert(record).execute()
                if res.data and len(res.data) > 0:
                    created = res.data[0]
                    memory_store.cases[created['id']] = created
                    return created
            except Exception as e:
                print(f"Supabase error creating case: {e}")
        memory_store.cases[case_id] = record
        return record

    @staticmethod
    def get_entities(case_id: str) -> List[Dict[str, Any]]:
        if supabase_client:
            try:
                res = supabase_client.table('entities').select('*').eq('case_id', case_id).execute()
                if res.data is not None:
                    for e in res.data:
                        memory_store.entities[e['id']] = e
                    return res.data
            except Exception as e:
                print(f"Supabase error fetching entities: {e}")
        return [e for e in memory_store.entities.values() if e.get('case_id') == case_id]

    @staticmethod
    def create_entity(data: Dict[str, Any]) -> Dict[str, Any]:
        entity_id = str(uuid.uuid4())
        record = {
            "id": entity_id,
            "case_id": data["case_id"],
            "name": data["name"],
            "type": data["type"],
            "subtype": data.get("subtype"),
            "metadata": data.get("metadata", {}),
            "risk_score": data.get("risk_score", 0),
            "is_key_influencer": data.get("is_key_influencer", False),
            "notes": data.get("notes"),
            "created_at": now_iso()
        }
        if supabase_client:
            try:
                res = supabase_client.table('entities').insert(record).execute()
                if res.data and len(res.data) > 0:
                    created = res.data[0]
                    memory_store.entities[created['id']] = created
                    return created
            except Exception as e:
                print(f"Supabase error creating entity: {e}")
        memory_store.entities[entity_id] = record
        return record

    @staticmethod
    def create_entities_batch(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not records:
            return []
        for r in records:
            if "id" not in r:
                r["id"] = str(uuid.uuid4())
            if "created_at" not in r:
                r["created_at"] = now_iso()
        if supabase_client:
            try:
                res = supabase_client.table('entities').insert(records).execute()
                if res.data:
                    for e in res.data:
                        memory_store.entities[e['id']] = e
                    return res.data
            except Exception as e:
                print(f"Supabase error batch creating entities: {e}")
        for r in records:
            memory_store.entities[r['id']] = r
        return records

    @staticmethod
    def update_entity(entity_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if supabase_client:
            try:
                res = supabase_client.table('entities').update(updates).eq('id', entity_id).execute()
                if res.data and len(res.data) > 0:
                    updated = res.data[0]
                    memory_store.entities[entity_id] = updated
                    return updated
            except Exception as e:
                print(f"Supabase error updating entity {entity_id}: {e}")
        if entity_id in memory_store.entities:
            memory_store.entities[entity_id].update(updates)
            return memory_store.entities[entity_id]
        return None

    @staticmethod
    def get_relationships(case_id: str) -> List[Dict[str, Any]]:
        if supabase_client:
            try:
                res = supabase_client.table('relationships').select('*').eq('case_id', case_id).execute()
                if res.data is not None:
                    for r in res.data:
                        memory_store.relationships[r['id']] = r
                    return res.data
            except Exception as e:
                print(f"Supabase error fetching relationships: {e}")
        return [r for r in memory_store.relationships.values() if r.get('case_id') == case_id]

    @staticmethod
    def create_relationships_batch(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not records:
            return []
        for r in records:
            if "id" not in r:
                r["id"] = str(uuid.uuid4())
            if "created_at" not in r:
                r["created_at"] = now_iso()
        if supabase_client:
            try:
                res = supabase_client.table('relationships').insert(records).execute()
                if res.data:
                    for r in res.data:
                        memory_store.relationships[r['id']] = r
                    return res.data
            except Exception as e:
                print(f"Supabase error batch creating relationships: {e}")
        for r in records:
            memory_store.relationships[r['id']] = r
        return records

    @staticmethod
    def create_evidence(data: Dict[str, Any]) -> Dict[str, Any]:
        evidence_id = str(uuid.uuid4())
        record = {
            "id": evidence_id,
            "case_id": data["case_id"],
            "entity_id": data.get("entity_id"),
            "source_type": data["source_type"],
            "title": data["title"],
            "content": data.get("content"),
            "extracted_data": data.get("extracted_data", {}),
            "status": data.get("status", "analyzed"),
            "created_at": now_iso()
        }
        if supabase_client:
            try:
                res = supabase_client.table('evidence').insert(record).execute()
                if res.data and len(res.data) > 0:
                    created = res.data[0]
                    memory_store.evidence[created['id']] = created
                    return created
            except Exception as e:
                print(f"Supabase error creating evidence: {e}")
        memory_store.evidence[evidence_id] = record
        return record

    @staticmethod
    def get_evidence(case_id: str) -> List[Dict[str, Any]]:
        if supabase_client:
            try:
                res = supabase_client.table('evidence').select('*').eq('case_id', case_id).order('created_at', desc=True).execute()
                if res.data is not None:
                    return res.data
            except Exception as e:
                print(f"Supabase error fetching evidence: {e}")
        return [e for e in memory_store.evidence.values() if e.get('case_id') == case_id]

    @staticmethod
    def get_alerts(case_id: str) -> List[Dict[str, Any]]:
        if supabase_client:
            try:
                res = supabase_client.table('alerts').select('*').eq('case_id', case_id).order('created_at', desc=True).execute()
                if res.data is not None:
                    return res.data
            except Exception as e:
                print(f"Supabase error fetching alerts: {e}")
        return [a for a in memory_store.alerts.values() if a.get('case_id') == case_id]

    @staticmethod
    def create_alerts_batch(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not records:
            return []
        for r in records:
            if "id" not in r:
                r["id"] = str(uuid.uuid4())
            if "created_at" not in r:
                r["created_at"] = now_iso()
        if supabase_client:
            try:
                res = supabase_client.table('alerts').insert(records).execute()
                if res.data:
                    for a in res.data:
                        memory_store.alerts[a['id']] = a
                    return res.data
            except Exception as e:
                print(f"Supabase error batch creating alerts: {e}")
        for r in records:
            memory_store.alerts[r['id']] = r
        return records

    @staticmethod
    def resolve_alert(alert_id: str) -> bool:
        if supabase_client:
            try:
                supabase_client.table('alerts').update({"is_resolved": True}).eq('id', alert_id).execute()
            except Exception as e:
                print(f"Supabase error resolving alert: {e}")
        if alert_id in memory_store.alerts:
            memory_store.alerts[alert_id]["is_resolved"] = True
            return True
        return False
