# SENTINEL — Criminal & Intelligence Network Analysis System

SENTINEL is an intelligence analysis and criminal network investigation platform built for the **Smart India Hackathon (SIH)**. It ingests multi-source unstructured and structured intelligence (FIRs, Call Detail Records, Financial Ledgers), extracts entities and relationships, resolves entity aliases, and constructs a queryable knowledge graph with **real NetworkX graph algorithms** and **explainable suspicious pattern detection**.

---

## Key Features

1. **Heterogeneous Data Ingestion**:
   - **Unstructured Text & FIRs**: Hybrid NLP entity extraction (Names, Organizations, Locations, Vehicles, Phones, Accounts) with confidence scoring and source text provenance.
   - **Call Detail Records (CDR CSV)**: Automated aggregation of call frequency, cumulative duration, cell tower locations, and communication graph edges.
   - **Financial Ledgers (CSV)**: Bank account transactions, Hawala fund round-tripping, and flow analysis.

2. **Explainable Entity Resolution**:
   - Matches candidate entities across FIR text and CDR logs using exact identifiers (Phone, Plate, Bank A/C), normalized string matching, initial abbreviations (e.g. `R. Kumar` $\leftrightarrow$ `Rajesh Kumar`), and fuzzy token similarity.

3. **NetworkX Graph Analytics Engine**:
   - **Brandes' Betweenness Centrality**: Pinpoints operational brokers/gatekeepers between disjoint criminal cells.
   - **PageRank**: Measures structural prestige and indirect influence across the network.
   - **Louvain Community Detection**: Discovers distinct modular gang sub-cells.
   - **Shortest Path Finder**: Trace relational connection chains and hops between any two suspects.

4. **Suspicious Pattern & Anomaly Detection**:
   - **Circular Money Transfers**: Detects directed cycles in money flows (Hawala / Money Laundering).
   - **Bridge Entities / Cut-Vertices**: Uncovers gatekeepers whose removal fragments the network.
   - **Communication Surges**: Flags high-frequency call bursts between suspects.
   - **Financial Mule Hubs**: Detects rapid pass-through structuring.

---

## Quickstart Guide

### 1. Backend Service (FastAPI)

```bash
# Navigate to backend directory
cd backend

# Activate virtual environment
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
# source venv/bin/activate

# Install dependencies (if not already installed)
pip install -r requirements.txt

# Run Unit Tests
python -m pytest tests/test_engine.py

# Start Backend Server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The API will be live at `http://127.0.0.1:8000` with interactive Swagger docs at `http://127.0.0.1:8000/docs`.

### 2. Frontend Application (React + Vite)

```bash
# In the root directory:
npm install

# Start Vite Development Server
npm run dev
```

The application will be accessible at `http://localhost:5173`.

---

## Architecture Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Mathematical formulations, graph algorithms, and entity resolution design.
- [docs/API.md](docs/API.md) — REST API endpoints, request schemas, and sample payloads.
- [docs/DATA_PIPELINE.md](docs/DATA_PIPELINE.md) — Ingestion pipelines, CDR schema, and anomaly detection rules.
