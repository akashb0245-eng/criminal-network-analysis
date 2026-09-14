import { useState, useEffect, useCallback, useRef } from 'react';
import type { Case, Entity, Relationship } from '@/lib/types';
import { api, type AnalyticsSummary, type NodeMetric, type ShortestPathResult } from '@/lib/api';
import { ENTITY_TYPE_COLORS, ENTITY_TYPE_LABELS, RELATIONSHIP_TYPE_LABELS } from '@/lib/analysis';
import { 
  Activity, Share2, ZoomIn, ZoomOut, Maximize, X, AlertCircle, 
  Layers, Route, ShieldAlert, Zap, Compass, Info
} from 'lucide-react';

interface NetworkGraphProps {
  activeCase: Case | null;
}

interface SimNode {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  degree: number;
  risk_score: number;
  is_key_influencer: boolean;
  pagerank: number;
  betweenness: number;
  community_id: number;
  fixed: boolean;
}

interface SimEdge {
  source: string;
  target: string;
  type: string;
  strength: number;
}

const COMMUNITY_PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', 
  '#06b6d4', '#f97316', '#6366f1', '#14b8a6', '#e11d48'
];

export function NetworkGraph({ activeCase }: NetworkGraphProps) {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [colorMode, setColorMode] = useState<'type' | 'community'>('type');
  
  // Shortest Path Finder
  const [pathSource, setPathSource] = useState<string>('');
  const [pathTarget, setPathTarget] = useState<string>('');
  const [pathResult, setPathResult] = useState<ShortestPathResult | null>(null);
  const [showPathFinder, setShowPathFinder] = useState(false);

  // Zoom & Pan
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const edgesRef = useRef<SimEdge[]>([]);
  const animFrameRef = useRef<number>(0);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const dragNodeRef = useRef<string | null>(null);
  const [renderTick, setRenderTick] = useState(0);

  const fetchData = useCallback(async () => {
    if (!activeCase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [eData, rData, aData] = await Promise.all([
        api.getEntities(activeCase.id),
        api.getRelationships(activeCase.id),
        api.getAnalytics(activeCase.id).catch(() => null),
      ]);
      setEntities(eData);
      setRelationships(rData);
      setAnalytics(aData);
    } catch (e) {
      console.error('Failed to load network graph data:', e);
    } finally {
      setLoading(false);
    }
  }, [activeCase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Shortest Path Calculation
  const handleCalculatePath = async () => {
    if (!activeCase || !pathSource || !pathTarget || pathSource === pathTarget) return;
    try {
      const res = await api.getShortestPath(activeCase.id, pathSource, pathTarget);
      setPathResult(res);
    } catch (e) {
      console.error('Pathfinding failed:', e);
    }
  };

  const clearPath = () => {
    setPathSource('');
    setPathTarget('');
    setPathResult(null);
  };

  // Build degree & metric lookups
  const metricMap = new Map<string, NodeMetric>();
  if (analytics?.node_metrics) {
    for (const m of analytics.node_metrics) {
      metricMap.set(m.entity_id, m);
    }
  }

  const filteredEntities = filterType === 'all' ? entities : entities.filter((e) => e.type === filterType);
  const filteredIds = new Set(filteredEntities.map((e) => e.id));
  const filteredRels = relationships.filter(
    (r) => filteredIds.has(r.source_entity_id) && filteredIds.has(r.target_entity_id)
  );

  // Initialize Force Simulation Nodes
  useEffect(() => {
    const W = 860;
    const H = 640;
    const newNodes: SimNode[] = filteredEntities.map((e, i) => {
      const angle = (i / Math.max(filteredEntities.length, 1)) * Math.PI * 2;
      const radius = 220 + Math.random() * 60;
      const metric = metricMap.get(e.id);

      return {
        id: e.id,
        label: e.name,
        type: e.type,
        x: W / 2 + Math.cos(angle) * radius,
        y: H / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        degree: metric?.degree || 0,
        risk_score: e.risk_score,
        is_key_influencer: e.is_key_influencer,
        pagerank: metric?.pagerank || 0.0,
        betweenness: metric?.betweenness || 0.0,
        community_id: metric?.community_id || 0,
        fixed: false,
      };
    });

    const newEdges: SimEdge[] = filteredRels.map((r) => ({
      source: r.source_entity_id,
      target: r.target_entity_id,
      type: r.type,
      strength: r.strength,
    }));

    nodesRef.current = newNodes;
    edgesRef.current = newEdges;
  }, [filteredEntities, filteredRels]);

  // Force simulation loop
  useEffect(() => {
    if (nodesRef.current.length === 0) return;
    let alpha = 1.0;
    const W = 860;
    const H = 640;
    const centerX = W / 2;
    const centerY = H / 2;

    const tick = () => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      if (nodes.length === 0) return;

      alpha *= 0.992;

      // Repulsion between nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const minDist = 90;
          if (dist < minDist * 3) {
            const force = ((minDist * minDist) / (dist * dist)) * 0.45 * alpha;
            const fx = (dx / dist) * force * 18;
            const fy = (dy / dist) * force * 18;
            if (!nodes[i].fixed) { nodes[i].vx -= fx; nodes[i].vy -= fy; }
            if (!nodes[j].fixed) { nodes[j].vx += fx; nodes[j].vy += fy; }
          }
        }
      }

      // Attraction along edges
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));
      for (const edge of edges) {
        const s = nodeMap.get(edge.source);
        const t = nodeMap.get(edge.target);
        if (!s || !t) continue;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const idealDist = 130;
        const force = ((dist - idealDist) / dist) * 0.045 * alpha;
        const fx = dx * force;
        const fy = dy * force;
        if (!s.fixed) { s.vx += fx; s.vy += fy; }
        if (!t.fixed) { t.vx -= fx; t.vy += fy; }
      }

      // Center gravity
      for (const node of nodes) {
        if (node.fixed) continue;
        node.vx += (centerX - node.x) * 0.0018 * alpha;
        node.vy += (centerY - node.y) * 0.0018 * alpha;
      }

      // Apply velocity damping
      for (const node of nodes) {
        if (node.fixed) continue;
        node.vx *= 0.85;
        node.vy *= 0.85;
        node.x += Math.max(-25, Math.min(25, node.vx));
        node.y += Math.max(-25, Math.min(25, node.vy));
        node.x = Math.max(40, Math.min(W - 40, node.x));
        node.y = Math.max(40, Math.min(H - 40, node.y));
      }

      setRenderTick((t) => t + 1);

      if (alpha > 0.005) {
        animFrameRef.current = requestAnimationFrame(tick);
      }
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [filteredEntities, filteredRels]);

  const selectedEntity = selectedNode ? entities.find((e) => e.id === selectedNode) : null;
  const selectedMetric = selectedNode ? metricMap.get(selectedNode) : null;
  const connectedRels = selectedNode
    ? relationships.filter((r) => r.source_entity_id === selectedNode || r.target_entity_id === selectedNode)
    : [];
  const connectedEntities = selectedNode
    ? connectedRels.map((r) => {
        const otherId = r.source_entity_id === selectedNode ? r.target_entity_id : r.source_entity_id;
        return { entity: entities.find((e) => e.id === otherId), rel: r };
      }).filter((x) => x.entity)
    : [];

  // Shortest Path Node / Edge Highlighting Sets
  const pathNodeSet = new Set(pathResult?.path || []);
  const pathEdgeSet = new Set<string>();
  if (pathResult?.path && pathResult.path.length > 1) {
    for (let i = 0; i < pathResult.path.length - 1; i++) {
      pathEdgeSet.add(`${pathResult.path[i]}|${pathResult.path[i+1]}`);
      pathEdgeSet.add(`${pathResult.path[i+1]}|${pathResult.path[i]}`);
    }
  }

  // Mouse pan & drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === svgRef.current) {
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanningRef.current) {
      setPan({
        x: panStartRef.current.panX + (e.clientX - panStartRef.current.x),
        y: panStartRef.current.panY + (e.clientY - panStartRef.current.y),
      });
    }
    if (dragNodeRef.current) {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = (e.clientX - rect.left - pan.x) / zoom;
      const y = (e.clientY - rect.top - pan.y) / zoom;
      const node = nodesRef.current.find((n) => n.id === dragNodeRef.current);
      if (node) {
        node.x = x;
        node.y = y;
        node.fixed = true;
        node.vx = 0;
        node.vy = 0;
        setRenderTick((t) => t + 1);
      }
    }
  };

  const handleMouseUp = () => {
    isPanningRef.current = false;
    dragNodeRef.current = null;
  };

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    dragNodeRef.current = nodeId;
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    for (const node of nodesRef.current) {
      node.fixed = false;
    }
  };

  if (!activeCase) {
    return (
      <div className="p-8 flex flex-col items-center justify-center py-24">
        <Share2 className="w-12 h-12 text-slate-700 mb-4" />
        <p className="text-slate-500">Select a case to view its network graph.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Network Graph Explorer</h1>
          <p className="text-slate-400 text-sm mt-1">
            {activeCase.name} — Interactive Network Graph with Betweenness Sizing & Louvain Clusters
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Path Finder Toggle */}
          <button
            onClick={() => setShowPathFinder(!showPathFinder)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
              showPathFinder
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Route className="w-3.5 h-3.5" /> Shortest Path
          </button>

          {/* Color Mode Toggle */}
          <button
            onClick={() => setColorMode(colorMode === 'type' ? 'community' : 'type')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            <Layers className="w-3.5 h-3.5" />
            Color: {colorMode === 'type' ? 'Entity Type' : 'Louvain Community'}
          </button>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Types</option>
            <option value="person">Persons</option>
            <option value="organization">Organizations</option>
            <option value="location">Locations</option>
            <option value="vehicle">Vehicles</option>
            <option value="phone">Phones</option>
            <option value="email">Emails</option>
            <option value="bank_account">Bank Accounts</option>
          </select>

          <button onClick={() => setZoom((z) => Math.min(z * 1.2, 3))} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={() => setZoom((z) => Math.max(z / 1.2, 0.3))} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={resetView} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300">
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Shortest Path Bar */}
      {showPathFinder && (
        <div className="mb-4 p-3 bg-slate-900 border border-blue-500/40 rounded-xl flex items-center gap-3">
          <Route className="w-5 h-5 text-blue-400 flex-shrink-0" />
          <div className="flex items-center gap-2 flex-1">
            <select
              value={pathSource}
              onChange={(e) => setPathSource(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500 flex-1"
            >
              <option value="">Select Origin Node...</option>
              {entities.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.type})</option>)}
            </select>
            <span className="text-slate-400 text-xs font-bold">➔</span>
            <select
              value={pathTarget}
              onChange={(e) => setPathTarget(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500 flex-1"
            >
              <option value="">Select Destination Node...</option>
              {entities.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.type})</option>)}
            </select>
            <button
              onClick={handleCalculatePath}
              disabled={!pathSource || !pathTarget || pathSource === pathTarget}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
            >
              Find Path
            </button>
            {pathResult && (
              <button onClick={clearPath} className="px-2 py-1.5 text-xs text-slate-400 hover:text-white">
                Clear
              </button>
            )}
          </div>
          {pathResult && (
            <div className="text-xs">
              {pathResult.found ? (
                <span className="text-emerald-400 font-medium">
                  Path Found: {pathResult.length} hops ({pathResult.path_names.join(' ➔ ')})
                </span>
              ) : (
                <span className="text-red-400">No connected relational path found.</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Canvas + Inspector */}
      <div className="flex gap-6">
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden relative" style={{ height: '640px' }}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Activity className="w-8 h-8 text-blue-500 animate-pulse" />
            </div>
          ) : filteredEntities.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <Share2 className="w-12 h-12 text-slate-700 mb-4" />
              <p className="text-slate-500">No entities to display. Ingest data from the Data Ingestion tab.</p>
            </div>
          ) : (
            <>
              <svg
                ref={svgRef}
                className="w-full h-full cursor-grab"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{ cursor: isPanningRef.current ? 'grabbing' : 'grab' }}
              >
                <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                  {/* Edges */}
                  {edgesRef.current.map((edge, i) => {
                    const s = nodesRef.current.find((n) => n.id === edge.source);
                    const t = nodesRef.current.find((n) => n.id === edge.target);
                    if (!s || !t) return null;

                    const isPathEdge = pathEdgeSet.has(`${edge.source}|${edge.target}`);
                    const isHighlighted = selectedNode && (edge.source === selectedNode || edge.target === selectedNode);
                    const isHovered = hoveredNode && (edge.source === hoveredNode || edge.target === hoveredNode);
                    
                    let strokeColor = '#475569';
                    let strokeWidth = Math.max(1, edge.strength / 3);
                    let opacity = 0.3;

                    if (isPathEdge) {
                      strokeColor = '#38bdf8';
                      strokeWidth = 3.5;
                      opacity = 1.0;
                    } else if (selectedNode) {
                      strokeColor = isHighlighted ? '#3b82f6' : '#334155';
                      opacity = isHighlighted ? 0.9 : 0.08;
                    } else if (isHovered) {
                      strokeColor = '#60a5fa';
                      opacity = 0.8;
                    }

                    return (
                      <line
                        key={i}
                        x1={s.x}
                        y1={s.y}
                        x2={t.x}
                        y2={t.y}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        opacity={opacity}
                        strokeDasharray={
                          edge.type === 'financial' ? '5,3' : edge.type === 'communication' ? '2,2' : 'none'
                        }
                      />
                    );
                  })}

                  {/* Nodes */}
                  {nodesRef.current.map((node) => {
                    // Radius dynamic to betweenness and degree
                    const baseRadius = 10;
                    const radius = Math.min(28, Math.max(baseRadius, baseRadius + node.degree * 2 + node.betweenness * 18));
                    
                    const isSelected = node.id === selectedNode;
                    const isHovered = node.id === hoveredNode;
                    const isPathNode = pathNodeSet.has(node.id);
                    
                    const dimmed = (selectedNode && !isSelected && !connectedRels.some(
                      (r) => r.source_entity_id === node.id || r.target_entity_id === node.id
                    )) || (pathResult?.found && !isPathNode);

                    // Node color based on active color mode
                    let color = ENTITY_TYPE_COLORS[node.type] || '#64748b';
                    if (colorMode === 'community') {
                      color = COMMUNITY_PALETTE[node.community_id % COMMUNITY_PALETTE.length];
                    }

                    return (
                      <g
                        key={node.id}
                        transform={`translate(${node.x}, ${node.y})`}
                        style={{ cursor: 'pointer', opacity: dimmed ? 0.15 : 1 }}
                        onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNode(selectedNode === node.id ? null : node.id);
                        }}
                        onMouseEnter={() => setHoveredNode(node.id)}
                        onMouseLeave={() => setHoveredNode(null)}
                      >
                        {/* Key Influencer / Path Highlight Rings */}
                        {isPathNode && (
                          <circle r={radius + 8} fill="none" stroke="#38bdf8" strokeWidth={2.5} opacity={0.9} strokeDasharray="4,2" />
                        )}
                        {node.is_key_influencer && !isPathNode && (
                          <circle r={radius + 6} fill="none" stroke="#f59e0b" strokeWidth={2} opacity={0.6} strokeDasharray="3,2" />
                        )}
                        {isSelected && (
                          <circle r={radius + 4} fill="none" stroke="#ffffff" strokeWidth={2.5} />
                        )}

                        <circle
                          r={radius}
                          fill={color}
                          opacity={isHovered ? 1.0 : 0.85}
                          stroke={isSelected ? '#fff' : color}
                          strokeWidth={isSelected ? 2 : 1}
                        />

                        <text
                          y={radius + 13}
                          textAnchor="middle"
                          fill="#cbd5e1"
                          fontSize={10.5}
                          fontWeight={isSelected || isPathNode ? 700 : 400}
                          className="pointer-events-none select-none"
                        >
                          {node.label.length > 18 ? node.label.slice(0, 16) + '…' : node.label}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>

              {/* Legend */}
              <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur-md rounded-lg p-3 border border-slate-800 text-xs shadow-xl">
                <p className="text-slate-400 font-semibold mb-2">
                  {colorMode === 'type' ? 'Entity Types' : 'Louvain Communities'}
                </p>
                {colorMode === 'type' ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {Object.entries(ENTITY_TYPE_COLORS).map(([type, color]) => (
                      <div key={type} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-slate-300">{ENTITY_TYPE_LABELS[type] || type}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {analytics?.communities.slice(0, 6).map((c) => (
                      <div key={c.community_id} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COMMUNITY_PALETTE[c.community_id % COMMUNITY_PALETTE.length] }} />
                        <span className="text-slate-300">Cluster #{c.community_id + 1}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Selected Entity Inspector */}
        {selectedEntity && (
          <div className="w-80 bg-slate-900 border border-slate-800 rounded-xl p-5 overflow-y-auto" style={{ maxHeight: '640px' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-sm">Entity Inspector</h3>
              <button onClick={() => setSelectedNode(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: (ENTITY_TYPE_COLORS[selectedEntity.type] || '#64748b') + '20' }}
              >
                <span className="text-lg font-bold" style={{ color: ENTITY_TYPE_COLORS[selectedEntity.type] || '#64748b' }}>
                  {selectedEntity.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-white font-semibold text-sm truncate">{selectedEntity.name}</p>
                <p className="text-slate-500 text-xs">{ENTITY_TYPE_LABELS[selectedEntity.type] || selectedEntity.type}</p>
              </div>
            </div>

            {/* NetworkX Computed Graph Metrics */}
            {selectedMetric && (
              <div className="bg-slate-800/60 rounded-xl p-3 mb-4 border border-slate-700/50">
                <p className="text-amber-400 font-semibold text-xs flex items-center gap-1 mb-2">
                  <Zap className="w-3.5 h-3.5" /> Graph Centrality & Influence
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-slate-900/60 p-2 rounded">
                    <p className="text-slate-500 text-[10px]">PAGERANK</p>
                    <p className="text-white font-bold">{selectedMetric.pagerank}</p>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded">
                    <p className="text-slate-500 text-[10px]">BETWEENNESS</p>
                    <p className="text-white font-bold">{selectedMetric.betweenness}</p>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded">
                    <p className="text-slate-500 text-[10px]">DEGREE LINKS</p>
                    <p className="text-white font-bold">{selectedMetric.degree}</p>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded">
                    <p className="text-slate-500 text-[10px]">COMMUNITY ID</p>
                    <p className="text-purple-400 font-bold">Cell #{selectedMetric.community_id + 1}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Connected Entities List */}
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                Connected Nodes ({connectedEntities.length})
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {connectedEntities.map(({ entity, rel }) => (
                  <div
                    key={entity!.id}
                    onClick={() => setSelectedNode(entity!.id)}
                    className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ENTITY_TYPE_COLORS[entity!.type] }} />
                    <span className="text-slate-300 text-xs flex-1 truncate">{entity!.name}</span>
                    <span className="text-slate-500 text-[11px] capitalize">{RELATIONSHIP_TYPE_LABELS[rel.type] || rel.type}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
