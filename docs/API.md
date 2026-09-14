# SENTINEL REST API Documentation

Base URL: `http://localhost:8000/api`

## Endpoints

### 1. Ingestion Pipeline

#### `POST /ingest/extract-text`
Extracts entities and relationships from raw text / FIR narratives and previews entity resolution matches.
- **Request Body:**
  ```json
  {
    "case_id": "uuid",
    "title": "FIR #4471",
    "source_type": "fir",
    "content": "Suspect Rajesh Kumar was arrested at Sector 14, Delhi..."
  }
  ```
- **Response:**
  ```json
  {
    "entities": [
      {
        "name": "Rajesh Kumar",
        "type": "person",
        "subtype": "suspect",
        "confidence": 0.95,
        "resolved_to_id": "existing-uuid-if-matched",
        "resolved_reason": "Exact canonical name match"
      }
    ],
    "relationships": [
      {
        "source": "Rajesh Kumar",
        "target": "Mohan Sharma",
        "type": "associate",
        "strength": 7,
        "description": "Criminal Associate: 'Rajesh Kumar frequently contacted Mohan Sharma...'"
      }
    ],
    "keywords": ["Sector 14", "FIR #4471"]
  }
  ```

#### `POST /ingest/commit-text`
Commits verified extracted entities and relationships into the case network graph.

#### `POST /ingest/cdr`
Parses structured Call Detail Records CSV and establishes communication graph edges.
- **Request Body:**
  ```json
  {
    "case_id": "uuid",
    "title": "Operation Nightfall CDR Batch",
    "records": [
      {
        "caller_phone": "+91-9876543210",
        "receiver_phone": "+91-9123456780",
        "timestamp": "2025-03-10T14:32:00Z",
        "duration_sec": 185,
        "call_type": "voice",
        "cell_tower": "Tower_Sector14_Delhi"
      }
    ]
  }
  ```

#### `POST /ingest/financial`
Parses structured Bank and Hawala ledger transactions and builds directional financial flow edges.

---

### 2. Analytics & Network Topology

#### `GET /analytics/{case_id}`
Computes full graph metrics, node centralities, Louvain communities, and detected anomalies.
- **Response:**
  ```json
  {
    "case_id": "uuid",
    "topology": {
      "node_count": 14,
      "edge_count": 18,
      "density": 0.1978,
      "connected_components": 1,
      "is_connected": true
    },
    "node_metrics": [
      {
        "entity_id": "uuid",
        "name": "Mohan Sharma",
        "pagerank": 0.184,
        "betweenness": 0.421,
        "degree": 6,
        "community_id": 0,
        "influence_score": 88,
        "score_breakdown": {
          "pagerank_contribution": 32.5,
          "betweenness_contribution": 35.0,
          "degree_contribution": 15.0,
          "risk_contribution": 5.5
        }
      }
    ],
    "communities": [
      {
        "community_id": 0,
        "label": "Cell/Cluster #1 (6 nodes)",
        "member_count": 6,
        "key_entities": ["Rajesh Kumar", "Mohan Sharma", "Priya Singh"]
      }
    ]
  }
  ```

#### `POST /analytics/{case_id}/run-anomalies`
Executes cycle detection and broker identification, persisting newly detected risk leads as alerts.

---

### 3. Shortest Path Navigation

#### `GET /relationships/shortest-path`
Calculates relational hops and edge connections between any two entities.
- **Query Params:** `case_id=UUID&source_id=UUID&target_id=UUID`
- **Response:**
  ```json
  {
    "found": true,
    "path": ["node_1", "node_2", "node_3"],
    "path_names": ["Kingpin Alpha", "Broker Bob", "Operative Charlie"],
    "length": 2,
    "edge_types": ["associate", "financial"]
  }
  ```
