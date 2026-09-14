"""
Explainable Entity Resolution Engine
Resolves incoming extracted entities against existing case entities using multi-tier matching:
1. Exact Identifier Match (Phone, Vehicle, Account, Email)
2. Normalized Exact Match
3. Fuzzy Levenshtein / Jaro-Winkler Token Similarity
4. Alias & Abbreviation Resolution (e.g. "R. Kumar" vs "Rajesh Kumar")
"""
import re
from typing import List, Dict, Any, Optional, Tuple

try:
    from rapidfuzz import fuzz
except ImportError:
    # Lightweight fallback if rapidfuzz is building
    class FuzzFallback:
        @staticmethod
        def ratio(s1: str, s2: str) -> float:
            s1, s2 = s1.lower().strip(), s2.lower().strip()
            if s1 == s2:
                return 100.0
            longer = max(len(s1), len(s2))
            if longer == 0:
                return 100.0
            from difflib import SequenceMatcher
            return SequenceMatcher(None, s1, s2).ratio() * 100.0
        
        @staticmethod
        def token_sort_ratio(s1: str, s2: str) -> float:
            tokens1 = " ".join(sorted(s1.lower().split()))
            tokens2 = " ".join(sorted(s2.lower().split()))
            return FuzzFallback.ratio(tokens1, tokens2)
    fuzz = FuzzFallback()

def normalize_name(name: str) -> str:
    cleaned = re.sub(r'[^\w\s]', '', name).strip().lower()
    return " ".join(cleaned.split())

def is_abbreviation_of(short_name: str, long_name: str) -> bool:
    s_tokens = short_name.lower().split()
    l_tokens = long_name.lower().split()
    
    if len(s_tokens) == 0 or len(l_tokens) == 0:
        return False
        
    # Check if first token is initial e.g., "R. Kumar" -> "Rajesh Kumar"
    if len(s_tokens) == 2 and len(l_tokens) == 2:
        if len(s_tokens[0]) <= 2 and s_tokens[0][0] == l_tokens[0][0] and s_tokens[1] == l_tokens[1]:
            return True
        if len(l_tokens[0]) <= 2 and l_tokens[0][0] == s_tokens[0][0] and s_tokens[1] == l_tokens[1]:
            return True
    return False

class EntityResolutionEngine:
    @staticmethod
    def resolve_entity(
        candidate_name: str,
        candidate_type: str,
        candidate_metadata: Dict[str, Any],
        existing_entities: List[Dict[str, Any]],
        similarity_threshold: float = 85.0
    ) -> Tuple[Optional[str], Optional[str], float]:
        """
        Attempts to match candidate entity against existing case entities.
        Returns: (matched_entity_id, explanation_reason, match_confidence)
        """
        cand_norm = normalize_name(candidate_name)
        
        # 1. Exact Identifier Matching
        cand_phone = candidate_metadata.get('number') or candidate_metadata.get('raw_number')
        cand_plate = candidate_metadata.get('plate')
        cand_acc = candidate_metadata.get('account_number')
        cand_email = candidate_metadata.get('address')
        
        for entity in existing_entities:
            e_meta = entity.get('metadata', {})
            
            # Match by phone number
            if cand_phone and (e_meta.get('number') == cand_phone or e_meta.get('raw_number') == cand_phone):
                return entity['id'], f"Exact phone identifier match ({cand_phone}) with '{entity['name']}'", 1.0
                
            # Match by vehicle plate
            if cand_plate and e_meta.get('plate') and e_meta.get('plate').upper() == cand_plate.upper():
                return entity['id'], f"Exact vehicle registration match ({cand_plate}) with '{entity['name']}'", 1.0
                
            # Match by bank account number
            if cand_acc and e_meta.get('account_number') == cand_acc:
                return entity['id'], f"Exact bank account match ({cand_acc}) with '{entity['name']}'", 1.0
                
            # Match by email address
            if cand_email and e_meta.get('address') and e_meta.get('address').lower() == cand_email.lower():
                return entity['id'], f"Exact email identifier match ({cand_email}) with '{entity['name']}'", 1.0

        # 2. Type-compatible Name Matching (Person / Org / Location)
        best_match_id = None
        best_explanation = None
        best_score = 0.0

        for entity in existing_entities:
            # Must match entity type
            if entity.get('type') != candidate_type:
                continue
                
            e_name = entity.get('name', '')
            e_norm = normalize_name(e_name)
            
            # Exact normalized match
            if cand_norm == e_norm:
                return entity['id'], f"Exact canonical name match with '{e_name}'", 0.98

            # Abbreviation check (e.g. "R. Sharma" -> "Rajesh Sharma")
            if is_abbreviation_of(candidate_name, e_name):
                score = 0.90
                if score > best_score:
                    best_score = score
                    best_match_id = entity['id']
                    best_explanation = f"Name initial/abbreviation resolution with '{e_name}' (confidence {int(score*100)}%)"

            # Fuzzy token similarity
            sim_score = fuzz.token_sort_ratio(candidate_name, e_name)
            if sim_score >= similarity_threshold and (sim_score / 100.0) > best_score:
                best_score = sim_score / 100.0
                best_match_id = entity['id']
                best_explanation = f"Fuzzy string similarity ({int(sim_score)}%) with '{e_name}'"

        if best_match_id and best_score >= (similarity_threshold / 100.0):
            return best_match_id, best_explanation, best_score

        return None, None, 0.0
