"""
Ingestion API endpoints: Text NLP Extraction, Commit, CDR Import, Financial Ledger Import
"""
from fastapi import APIRouter, HTTPException
from app.models.schemas import (
    TextExtractionRequest, TextExtractionResponse, IngestionCommitRequest,
    IngestionCommitResponse, CDRIngestRequest, FinancialIngestRequest
)
from app.services.nlp import NLPExtractionEngine
from app.services.ingestion import IngestionService
from app.services.resolution import EntityResolutionEngine
from app.services.db import DatabaseService

router = APIRouter(prefix="/ingest", tags=["ingestion"])

@router.post("/extract-text", response_model=TextExtractionResponse)
def extract_from_text(payload: TextExtractionRequest):
    """Performs hybrid NLP entity and relationship extraction on input text with resolution preview."""
    result = NLPExtractionEngine.extract(payload.content)
    existing_entities = DatabaseService.get_entities(payload.case_id)
    
    # Run entity resolution preview
    for ent in result["entities"]:
        matched_id, reason, conf = EntityResolutionEngine.resolve_entity(
            candidate_name=ent.name,
            candidate_type=ent.type,
            candidate_metadata=ent.metadata,
            existing_entities=existing_entities
        )
        if matched_id:
            ent.resolved_to_id = matched_id
            ent.resolved_reason = reason
            
    return TextExtractionResponse(
        entities=result["entities"],
        relationships=result["relationships"],
        keywords=result["keywords"],
        summary=result["summary"]
    )

@router.post("/commit-text", response_model=IngestionCommitResponse)
def commit_text_ingestion(payload: IngestionCommitRequest):
    """Commits verified extracted text report to database with entity resolution."""
    return IngestionService.ingest_text_report(
        case_id=payload.case_id,
        title=payload.title,
        source_type=payload.source_type,
        content=payload.content or "",
        selected_entities=payload.entities,
        selected_relationships=payload.relationships
    )

@router.post("/cdr", response_model=IngestionCommitResponse)
def ingest_cdr_records(payload: CDRIngestRequest):
    """Ingests structured Call Detail Records (CDR) and constructs communication network."""
    return IngestionService.ingest_cdr(
        case_id=payload.case_id,
        title=payload.title,
        records=payload.records
    )

@router.post("/financial", response_model=IngestionCommitResponse)
def ingest_financial_records(payload: FinancialIngestRequest):
    """Ingests structured financial transaction ledgers and constructs financial flow network."""
    return IngestionService.ingest_financial(
        case_id=payload.case_id,
        title=payload.title,
        records=payload.records
    )
