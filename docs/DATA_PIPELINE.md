# SENTINEL Data Pipeline Specification

## 1. Heterogeneous Data Ingestion Formats

### 1.1 Unstructured Text & FIR Narratives
- **Sources:** Police First Information Reports (FIR), Witness Statements, Interrogation logs, Social media transcripts.
- **Pipeline:**
  1. Regular expression tokenization for structured identifiers (Indian mobile numbers, vehicle plates, bank accounts, emails).
  2. Sentence segmentation and syntactic noun-phrase identification for Person, Organization, and Location entities.
  3. Proximity and co-occurrence extraction for relational verbs (family ties, financial transactions, communications, criminal association).
  4. Entity Resolution verification against active case database.
  5. Interactive review and transactional commit into graph storage.

### 1.2 Call Detail Records (CDR)
- **Sources:** Telecom CDR CSV exports.
- **Fields:** `caller_phone`, `receiver_phone`, `timestamp`, `duration_sec`, `call_type`, `cell_tower`.
- **Pipeline:**
  1. Phone number E.164 normalization.
  2. Aggregates call volume and cumulative call duration between phone pairs.
  3. Automatically instantiates directional communication graph edges with call frequency weighting ($1 \le \text{strength} \le 10$).
  4. Cell tower and temporal interval tracking attached to edge metadata.

### 1.3 Financial Transaction Ledgers
- **Sources:** Bank statement CSVs, Hawala book entries, Payment gateway records.
- **Fields:** `source_account`, `target_account`, `source_holder`, `target_holder`, `amount`, `currency`, `timestamp`, `notes`.
- **Pipeline:**
  1. Account number & Account Holder entity extraction.
  2. Resolves holders with matching person nodes across previous FIRs or CDR records.
  3. Aggregates financial volume ($A \xrightarrow{\text{₹}} B$) and weights edges.
  4. Triggers cycle detection algorithms to flag layered money laundering paths.

---

## 2. Suspicious Pattern Detection Rules

| Anomaly Type | Analytical Mechanism | Law Enforcement Significance |
| :--- | :--- | :--- |
| **Circular Fund Transfer** | Directed graph simple cycle search ($A \to B \to C \to A$) | Uncovers Hawala round-tripping and shell account layering |
| **Network Gatekeeper (Broker)** | Articulation points (Cut-vertices) & Betweenness outliers | Identifies critical couriers or hidden coordinators between disjoint gangs |
| **Communication Burst** | Frequency $\ge 3$ distinct call events between suspect pair | High-velocity coordination prior to or following criminal incidents |
| **Financial Mule Pass-Through** | Multi-inflow ($\ge 2$) with immediate multi-outflow ($\ge 2$) | Identifies mule bank accounts used to disperse illicit proceeds |
| **High-Risk Central Node** | High recidivism score ($\ge 75$) + High Degree ($\ge 3$) | Priority apprehension targets |
