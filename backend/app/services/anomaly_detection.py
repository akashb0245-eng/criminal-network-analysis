"""
Explainable Pattern and Anomaly Detection Engine for SENTINEL
Detects:
1. Circular Financial Transfers (Directed Graph Cycles / Hawala / Money Laundering)
2. Bridge / Broker Entities (High Betweenness Gatekeepers / Cut-Vertices)
3. High Communication Velocity / Burst Activity (CDR Call Clusters)
4. Financial Pass-Through / Mule Accounts
5. Recidivist / High-Risk Central Nodes
"""
from typing import List, Dict, Any, Set, Tuple
import networkx as nx
from app.models.schemas import AlertBase, AlertType, Severity

class AnomalyDetectionEngine:
    @classmethod
    def detect_anomalies(
        cls,
        case_id: str,
        entities: List[Dict[str, Any]],
        relationships: List[Dict[str, Any]]
    ) -> List[AlertBase]:
        alerts: List[AlertBase] = []
        if not entities or not relationships:
            return alerts

        entity_dict = {e['id']: e for e in entities}
        
        # 1. Circular Financial Transfer Detection (Money Laundering Cycles)
        fin_graph = nx.DiGraph()
        for e in entities:
            fin_graph.add_node(e['id'], name=e.get('name', 'Unknown'))
            
        for r in relationships:
            if r.get('type') == 'financial':
                src = r.get('source_entity_id')
                tgt = r.get('target_entity_id')
                if src and tgt and fin_graph.has_node(src) and fin_graph.has_node(tgt):
                    fin_graph.add_edge(src, tgt, strength=r.get('strength', 5), desc=r.get('description', ''))

        try:
            cycles = list(nx.simple_cycles(fin_graph))
            for cycle in cycles:
                if 2 <= len(cycle) <= 6:
                    cycle_names = [entity_dict.get(n, {}).get('name', n) for n in cycle]
                    cycle_str = " ➔ ".join(cycle_names) + f" ➔ {cycle_names[0]}"
                    
                    alerts.append(AlertBase(
                        alert_type='circular_transaction',
                        severity='critical',
                        title=f"Circular Money Flow Detected: {cycle_names[0]} Loop",
                        description=f"Directed circular financial flow identified between {len(cycle)} entities: {cycle_str}. Indicates potential layered money laundering or hawala fund round-tripping.",
                        is_resolved=False
                    ))
        except Exception as e:
            print(f"Cycle detection error: {e}")

        # 2. Bridge / Broker Gatekeeper Detection (Cut-Vertices & High Betweenness Outliers)
        G_undirected = nx.Graph()
        for e in entities:
            G_undirected.add_node(e['id'], name=e.get('name', 'Unknown'), risk=e.get('risk_score', 0))
        for r in relationships:
            src, tgt = r.get('source_entity_id'), r.get('target_entity_id')
            if src and tgt and G_undirected.has_node(src) and G_undirected.has_node(tgt):
                G_undirected.add_edge(src, tgt)

        if G_undirected.number_of_nodes() >= 3 and G_undirected.number_of_edges() >= 2:
            # Articulation points (Cut-vertices)
            try:
                cut_vertices = list(nx.articulation_points(G_undirected))
                betweenness = nx.betweenness_centrality(G_undirected)
                
                for cv in cut_vertices:
                    ent = entity_dict.get(cv)
                    if ent:
                        bet_val = round(betweenness.get(cv, 0.0), 3)
                        alerts.append(AlertBase(
                            alert_type='bridge_broker',
                            severity='high',
                            title=f"Network Gatekeeper / Bridge: {ent.get('name')}",
                            description=f"'{ent.get('name')}' is a critical articulation point (Betweenness Centrality: {bet_val}). Removing this node partitions the network into disconnected cells. High likelihood of being an operational coordinator or courier.",
                            is_resolved=False
                        ))
            except Exception as e:
                print(f"Broker detection error: {e}")

        # 3. Dense / Burst Communication Detection
        pair_counts: Dict[Tuple[str, str], int] = {}
        pair_desc: Dict[Tuple[str, str], List[str]] = {}
        for r in relationships:
            if r.get('type') == 'communication':
                src, tgt = r.get('source_entity_id'), r.get('target_entity_id')
                if src and tgt:
                    key = tuple(sorted([src, tgt]))
                    pair_counts[key] = pair_counts.get(key, 0) + 1
                    desc = r.get('description')
                    if desc:
                        pair_desc.setdefault(key, []).append(desc)

        for (id1, id2), count in pair_counts.items():
            if count >= 3:
                e1, e2 = entity_dict.get(id1), entity_dict.get(id2)
                if e1 and e2:
                    severity = 'critical' if count >= 6 else 'high'
                    alerts.append(AlertBase(
                        alert_type='frequent_contact',
                        severity=severity,
                        title=f"Communication Surge: {e1.get('name')} ↔ {e2.get('name')}",
                        description=f"{count} distinct communication logs recorded between {e1.get('name')} and {e2.get('name')}. Strongly indicates synchronized operational coordination.",
                        is_resolved=False
                    ))

        # 4. Financial Anomaly / Mule Pass-through Accounts
        for ent in entities:
            eid = ent['id']
            in_fin = sum(1 for r in relationships if r.get('type') == 'financial' and r.get('target_entity_id') == eid)
            out_fin = sum(1 for r in relationships if r.get('type') == 'financial' and r.get('source_entity_id') == eid)
            
            if in_fin >= 2 and out_fin >= 2:
                alerts.append(AlertBase(
                    alert_type='financial_anomaly',
                    severity='high',
                    title=f"Financial Mule / Pass-Through Hub: {ent.get('name')}",
                    description=f"{ent.get('name')} exhibits mule characteristics with {in_fin} incoming and {out_fin} outgoing transactions in quick succession.",
                    is_resolved=False
                ))

        # 5. High-Risk Recidivism Hub
        for ent in entities:
            risk = ent.get('risk_score', 0)
            if risk >= 75:
                degree = G_undirected.degree(ent['id']) if G_undirected.has_node(ent['id']) else 0
                if degree >= 3:
                    alerts.append(AlertBase(
                        alert_type='repeated_offense',
                        severity='critical' if risk >= 85 else 'high',
                        title=f"Active High-Risk Central Node: {ent.get('name')}",
                        description=f"{ent.get('name')} has a high risk rating ({risk}/100) and maintains {degree} active relationships in this criminal network.",
                        is_resolved=False
                    ))

        return alerts
