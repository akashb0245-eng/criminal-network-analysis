"""
NetworkX-Powered Real Graph Analytics Engine for SENTINEL
Computes genuine graph algorithms:
- Degree, In-Degree, Out-Degree Centrality
- Brandes' Betweenness Centrality
- Closeness Centrality
- PageRank
- Louvain Community Detection
- Connected Components & Shortest Paths
- Explainable Influential Entity Ranking
"""
from typing import List, Dict, Any, Optional, Tuple
import networkx as nx
from app.models.schemas import (
    NodeMetric, CommunityInfo, GraphTopology, AnalyticsSummaryResponse, ShortestPathResult
)

class GraphAnalyticsEngine:
    @classmethod
    def build_graph(
        cls, 
        entities: List[Dict[str, Any]], 
        relationships: List[Dict[str, Any]], 
        directed: bool = False
    ) -> nx.Graph:
        """Constructs NetworkX graph with node and edge attributes."""
        G = nx.DiGraph() if directed else nx.Graph()
        
        # Add nodes
        for e in entities:
            G.add_node(
                e['id'],
                name=e.get('name', 'Unknown'),
                type=e.get('type', 'person'),
                subtype=e.get('subtype'),
                risk_score=e.get('risk_score', 0),
                is_key_influencer=e.get('is_key_influencer', False)
            )
            
        # Add edges
        for r in relationships:
            src = r.get('source_entity_id')
            tgt = r.get('target_entity_id')
            if src and tgt and G.has_node(src) and G.has_node(tgt):
                weight = float(r.get('strength', 5))
                rel_type = r.get('type', 'associate')
                
                if G.has_edge(src, tgt):
                    # Multi-edge accumulation
                    G[src][tgt]['weight'] += weight
                    G[src][tgt]['types'].add(rel_type)
                else:
                    G.add_edge(
                        src, tgt,
                        weight=weight,
                        type=rel_type,
                        types={rel_type},
                        description=r.get('description', '')
                    )
                    
        return G

    @classmethod
    def analyze_network(
        cls, 
        case_id: str, 
        entities: List[Dict[str, Any]], 
        relationships: List[Dict[str, Any]]
    ) -> AnalyticsSummaryResponse:
        """Executes full graph analytics suite."""
        if not entities:
            return AnalyticsSummaryResponse(
                case_id=case_id,
                topology=GraphTopology(
                    node_count=0, edge_count=0, density=0.0,
                    connected_components=0, is_connected=False
                ),
                node_metrics=[],
                top_influencers=[],
                communities=[],
                detected_anomalies=[]
            )

        # Build graphs (both undirected for modularity/betweenness and directed for flow)
        G_undirected = cls.build_graph(entities, relationships, directed=False)
        G_directed = cls.build_graph(entities, relationships, directed=True)
        
        node_count = G_undirected.number_of_nodes()
        edge_count = G_undirected.number_of_edges()

        # 1. Centrality Computations
        deg_centrality = nx.degree_centrality(G_undirected) if node_count > 1 else {n: 0.0 for n in G_undirected}
        in_deg = dict(G_directed.in_degree()) if node_count > 0 else {}
        out_deg = dict(G_directed.out_degree()) if node_count > 0 else {}
        
        # Brandes' exact Betweenness Centrality
        try:
            betweenness = nx.betweenness_centrality(G_undirected, weight='weight', normalized=True)
        except Exception:
            betweenness = {n: 0.0 for n in G_undirected}
            
        # Closeness Centrality
        try:
            closeness = nx.closeness_centrality(G_undirected)
        except Exception:
            closeness = {n: 0.0 for n in G_undirected}

        # PageRank (with damping factor 0.85)
        try:
            pagerank = nx.pagerank(G_undirected, alpha=0.85, weight='weight', max_iter=200)
        except Exception:
            pagerank = {n: 1.0 / max(node_count, 1) for n in G_undirected}

        # 2. Community Detection (Louvain / Greedy Modularity)
        communities_list: List[CommunityInfo] = []
        node_community_map: Dict[str, int] = {}
        
        if node_count >= 2 and edge_count >= 1:
            try:
                raw_communities = list(nx.community.greedy_modularity_communities(G_undirected, weight='weight'))
                for cid, comm_nodes in enumerate(raw_communities):
                    for n in comm_nodes:
                        node_community_map[n] = cid
                    
                    member_names = [G_undirected.nodes[n].get('name', 'Unknown') for n in comm_nodes]
                    communities_list.append(CommunityInfo(
                        community_id=cid,
                        label=f"Cell/Cluster #{cid + 1} ({len(comm_nodes)} nodes)",
                        member_count=len(comm_nodes),
                        key_entities=member_names[:5]
                    ))
            except Exception as e:
                print(f"Community detection fallback: {e}")
                for n in G_undirected:
                    node_community_map[n] = 0
        else:
            for n in G_undirected:
                node_community_map[n] = 0

        # 3. Graph Topology Metrics
        density = nx.density(G_undirected)
        num_components = nx.number_connected_components(G_undirected) if node_count > 0 else 0
        is_connected = nx.is_connected(G_undirected) if node_count > 0 else False
        
        diameter = None
        avg_path_length = None
        if is_connected and node_count > 1:
            try:
                diameter = nx.diameter(G_undirected)
                avg_path_length = round(nx.average_shortest_path_length(G_undirected), 2)
            except Exception:
                pass

        topology = GraphTopology(
            node_count=node_count,
            edge_count=edge_count,
            density=round(density, 4),
            connected_components=num_components,
            is_connected=is_connected,
            diameter=diameter,
            average_path_length=avg_path_length
        )

        # 4. Composite Influencer Scoring & Explanation
        max_deg = max([G_undirected.degree(n) for n in G_undirected], default=1) or 1
        max_pr = max(pagerank.values(), default=1.0) or 1.0
        max_bet = max(betweenness.values(), default=1.0) or 1.0

        node_metrics: List[NodeMetric] = []
        entity_dict = {e['id']: e for e in entities}

        for node_id in G_undirected.nodes():
            raw_deg = G_undirected.degree(node_id)
            norm_deg = raw_deg / max_deg
            norm_pr = pagerank.get(node_id, 0.0) / max_pr
            norm_bet = betweenness.get(node_id, 0.0) / max_bet if max_bet > 0 else 0.0
            
            ent_data = entity_dict.get(node_id, {})
            risk_score = ent_data.get('risk_score', 0)
            
            # Mathematical Composite: 35% PageRank + 35% Betweenness + 20% Degree + 10% Risk
            composite_score = int(round(
                (0.35 * norm_pr + 0.35 * norm_bet + 0.20 * norm_deg + 0.10 * (risk_score / 100.0)) * 100
            ))
            composite_score = max(1, min(100, composite_score))

            score_breakdown = {
                "pagerank_contribution": round(norm_pr * 35, 1),
                "betweenness_contribution": round(norm_bet * 35, 1),
                "degree_contribution": round(norm_deg * 20, 1),
                "risk_contribution": round((risk_score / 100.0) * 10, 1),
                "explanation": f"PageRank {round(pagerank.get(node_id, 0.0), 3)}, Betweenness {round(betweenness.get(node_id, 0.0), 3)}, Degree {raw_deg}"
            }

            node_metrics.append(NodeMetric(
                entity_id=node_id,
                name=ent_data.get('name', 'Unknown'),
                type=ent_data.get('type', 'person'),
                degree=raw_deg,
                in_degree=in_deg.get(node_id, 0),
                out_degree=out_deg.get(node_id, 0),
                betweenness=round(betweenness.get(node_id, 0.0), 4),
                closeness=round(closeness.get(node_id, 0.0), 4),
                pagerank=round(pagerank.get(node_id, 0.0), 4),
                community_id=node_community_map.get(node_id, 0),
                influence_score=composite_score,
                score_breakdown=score_breakdown
            ))

        # Sort top influencers
        top_influencers = sorted(node_metrics, key=lambda x: x.influence_score, reverse=True)

        return AnalyticsSummaryResponse(
            case_id=case_id,
            topology=topology,
            node_metrics=node_metrics,
            top_influencers=top_influencers[:10],
            communities=communities_list,
            detected_anomalies=[]
        )

    @classmethod
    def find_shortest_path(
        cls, 
        entities: List[Dict[str, Any]], 
        relationships: List[Dict[str, Any]], 
        source_id: str, 
        target_id: str
    ) -> ShortestPathResult:
        """Finds shortest relational path between two entities with edge sequence."""
        G = cls.build_graph(entities, relationships, directed=False)
        
        if not G.has_node(source_id) or not G.has_node(target_id):
            return ShortestPathResult(found=False, path=[], path_names=[], length=0, edge_types=[])
            
        try:
            path = nx.shortest_path(G, source=source_id, target=target_id)
            path_names = [G.nodes[n].get('name', n) for n in path]
            
            edge_types = []
            for i in range(len(path) - 1):
                u, v = path[i], path[i + 1]
                edge_data = G.get_edge_data(u, v, default={})
                edge_types.append(edge_data.get('type', 'associate'))
                
            return ShortestPathResult(
                found=True,
                path=path,
                path_names=path_names,
                length=len(path) - 1,
                edge_types=edge_types
            )
        except nx.NetworkXNoPath:
            return ShortestPathResult(found=False, path=[], path_names=[], length=0, edge_types=[])
