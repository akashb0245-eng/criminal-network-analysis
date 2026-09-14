# SENTINEL Architecture & Technical Specification

## 1. System Overview

**SENTINEL** is an intelligence analysis and criminal network investigation platform engineered for the **Smart India Hackathon (SIH)**. It transitions criminal investigation from static records into a dynamic, queryable knowledge graph with algorithmic network analysis and suspicious pattern discovery.

```
+-----------------------------------------------------------------------------------------+
|                                    SENTINEL PLATFORM                                    |
+-----------------------------------------------------------------------------------------+
                                 
      [ RAW INTELLIGENCE DATA ]
         |
         +--> Unstructured Text (FIRs, Interrogation Transcripts, Social Media)
         +--> Structured CDR Logs (Call Detail Records CSV: duration, cell towers)
         +--> Financial Ledgers (Bank Transactions CSV: hawala, transfers)
         |
         v
+-----------------------------------------------------------------------------------------+
|                                  PROCESSING PIPELINE                                    |
|                                                                                         |
|   1. NLP & Identifier Extraction (Regex + Contextual Indian Identifiers)                |
|   2. Multi-tier Entity Resolution (Fuzzy + Phonetic + Identifier Matching)              |
|   3. Directional & Weighted Graph Construction                                          |
+-----------------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------------+
|                              FASTAPI BACKEND SERVICE                                    |
|                                                                                         |
|   [ NetworkX Analytics Engine ]              [ Anomaly & Pattern Detector ]             |
|   - Brandes' Betweenness Centrality          - Circular Money Laundering Cycles         |
|   - PageRank Algorithm                       - Bridge / Cut-Vertex Gatekeepers          |
|   - Louvain Community Detection              - High Communication Burst Anomalies       |
|   - Dijkstra Shortest Path Explorer          - Financial Mule Pass-Through Hubs         |
+-----------------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------------+
|                             REACT INVESTIGATOR FRONTEND                                 |
|                                                                                         |
|   - Case Investigation Dashboard & High-Risk Target Explorer                            |
|   - 2D Network Graph (Dynamic Betweenness Node Sizing & Louvain Cell Colors)            |
|   - Shortest Path Pathfinder (Relational hops & Edge Inspection)                        |
|   - Real-time Anomaly Leads & Factor-Ranked Influencer Leaderboard                      |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Core Mathematical Formulations

### 2.1 Brandes' Exact Betweenness Centrality
Betweenness measures the extent to which an entity lies on the shortest relational paths between all other entity pairs in the criminal network:
$$C_B(v) = \sum_{s \neq v \neq t} \frac{\sigma_{st}(v)}{\sigma_{st}}$$
Where $\sigma_{st}$ is the total number of shortest paths from node $s$ to node $t$, and $\sigma_{st}(v)$ is the number of those paths that pass through node $v$. Entities with high betweenness act as **critical operational brokers / gatekeepers** between isolated criminal cells.

### 2.2 PageRank
PageRank computes the structural prestige and indirect influence of a node based on incoming relational ties:
$$PR(u) = \frac{1-d}{N} + d \sum_{v \in M(u)} \frac{PR(v)}{L(v)}$$
Where $d = 0.85$ is the damping factor, $M(u)$ is the set of nodes linking to $u$, and $L(v)$ is the out-degree of node $v$.

### 2.3 Composite Influencer Ranking Formula
$$\text{Influence Score} = \text{round}\Big(\big(0.35 \times \widehat{PR} + 0.35 \times \widehat{C_B} + 0.20 \times \widehat{\text{Deg}} + 0.10 \times \frac{\text{Risk}}{100}\big) \times 100\Big)$$
All factor contributions are exposed transparently to the investigator.

---

## 3. Entity Resolution Architecture

Incoming entities from disparate sources (FIR text, CDR phone logs, Bank records) are matched against the case entity pool through 4 sequential filters:

1. **Exact Identifier Match (Confidence 1.0):** Phone numbers (E.164 normalized), vehicle registration plates, bank account numbers, emails.
2. **Normalized Name Match (Confidence 0.98):** Canonicalized whitespace, punctuation-stripped lowercase tokens.
3. **Abbreviation & Initial Resolution (Confidence 0.90):** Matches single-letter initial patterns (e.g. `"R. Kumar"` $\leftrightarrow$ `"Rajesh Kumar"`).
4. **Token Sort Fuzzy Similarity (Confidence $\ge 0.85$):** Levenshtein token distance thresholding to absorb spelling variants.
