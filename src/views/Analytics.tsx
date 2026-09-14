import { useState, useEffect, useCallback } from 'react';
import type { Case, Alert } from '@/lib/types';
import { api, type AnalyticsSummary, type NodeMetric } from '@/lib/api';
import { 
  ALERT_TYPE_LABELS, SEVERITY_COLORS, ENTITY_TYPE_COLORS, ENTITY_TYPE_LABELS, RELATIONSHIP_TYPE_LABELS 
} from '@/lib/analysis';
import { 
  BarChart3, Activity, TrendingUp, AlertTriangle, Zap, RefreshCw, 
  CheckCircle2, Network, GitCommit, Layers, ShieldAlert, Info
} from 'lucide-react';

interface AnalyticsProps {
  activeCase: Case | null;
}

export function Analytics({ activeCase }: AnalyticsProps) {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedInfluencer, setSelectedInfluencer] = useState<NodeMetric | null>(null);

  const fetchData = useCallback(async () => {
    if (!activeCase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [analyticsData, alertsData] = await Promise.all([
        api.getAnalytics(activeCase.id),
        api.getAlerts(activeCase.id),
      ]);
      setAnalytics(analyticsData);
      setAlerts(alertsData);
      if (analyticsData.top_influencers.length > 0 && !selectedInfluencer) {
        setSelectedInfluencer(analyticsData.top_influencers[0]);
      }
    } catch (e) {
      console.error('Failed to fetch analytics:', e);
    } finally {
      setLoading(false);
    }
  }, [activeCase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRunAnalysis = async () => {
    if (!activeCase) return;
    setAnalyzing(true);
    try {
      const updatedAlerts = await api.runAnomalies(activeCase.id);
      setAlerts(updatedAlerts);
      const analyticsData = await api.getAnalytics(activeCase.id);
      setAnalytics(analyticsData);
    } catch (e) {
      console.error('Analysis run failed:', e);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleResolveAlert = async (id: string) => {
    try {
      await api.resolveAlert(id);
      fetchData();
    } catch (e) {
      console.error('Failed to resolve alert:', e);
    }
  };

  const unresolvedAlerts = alerts.filter((a) => !a.is_resolved);

  if (!activeCase) {
    return (
      <div className="p-8 flex flex-col items-center justify-center py-24">
        <BarChart3 className="w-12 h-12 text-slate-700 mb-4" />
        <p className="text-slate-500">Select an investigation case to view network analytics.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Graph Analytics & Anomaly Detection</h1>
          <p className="text-slate-400 text-sm mt-1">
            {activeCase.name} — NetworkX-powered Brandes Betweenness, PageRank, Louvain Communities & Cycle Detection
          </p>
        </div>
        <button
          onClick={handleRunAnalysis}
          disabled={analyzing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {analyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {analyzing ? 'Computing Graph Algorithms...' : 'Run Anomaly Detection Engine'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Activity className="w-8 h-8 text-blue-500 animate-pulse" />
        </div>
      ) : !analytics || analytics.topology.node_count === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Network className="w-12 h-12 text-slate-700 mb-4" />
          <p className="text-slate-400">No entities or relationships in this case yet.</p>
          <p className="text-slate-500 text-xs mt-1">
            Ingest intelligence data from the Data Ingestion tab to run graph analytics.
          </p>
        </div>
      ) : (
        <>
          {/* Topology Stats Banner */}
          <div className="grid grid-cols-5 gap-4 mb-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-slate-500 text-xs uppercase tracking-wider">Network Size</p>
              <p className="text-2xl font-bold text-white mt-1">{analytics.topology.node_count} nodes</p>
              <p className="text-slate-400 text-xs mt-0.5">{analytics.topology.edge_count} relationships</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-slate-500 text-xs uppercase tracking-wider">Graph Density</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{analytics.topology.density}</p>
              <p className="text-slate-400 text-xs mt-0.5">Edge connectedness</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-slate-500 text-xs uppercase tracking-wider">Communities (Cells)</p>
              <p className="text-2xl font-bold text-purple-400 mt-1">{analytics.communities.length}</p>
              <p className="text-slate-400 text-xs mt-0.5">Louvain modularity</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-slate-500 text-xs uppercase tracking-wider">Components</p>
              <p className="text-2xl font-bold text-blue-400 mt-1">{analytics.topology.connected_components}</p>
              <p className="text-slate-400 text-xs mt-0.5">{analytics.topology.is_connected ? 'Fully connected' : 'Isolated clusters'}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-slate-500 text-xs uppercase tracking-wider">Active Anomalies</p>
              <p className="text-2xl font-bold text-orange-400 mt-1">{unresolvedAlerts.length}</p>
              <p className="text-slate-400 text-xs mt-0.5">{alerts.length} total detected</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Left: Top Influencers with Explainable Factor Breakdown */}
            <div className="col-span-1 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h2 className="text-white font-semibold flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-amber-400" />
                  Key Influencer Rankings (Mathematical Composite)
                </h2>
                <div className="space-y-2">
                  {analytics.top_influencers.slice(0, 6).map((inf, i) => {
                    const isSelected = selectedInfluencer?.entity_id === inf.entity_id;
                    return (
                      <div
                        key={inf.entity_id}
                        onClick={() => setSelectedInfluencer(inf)}
                        className={`p-3 rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-slate-800 border-amber-500/50 shadow-md'
                            : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold w-5 ${i < 3 ? 'text-amber-400' : 'text-slate-500'}`}>
                              #{i + 1}
                            </span>
                            <span className="text-white text-sm font-medium truncate max-w-[130px]">{inf.name}</span>
                          </div>
                          <span className="text-amber-400 text-sm font-bold font-mono">
                            {inf.influence_score} pts
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400 font-mono mt-1">
                          <span>PR: {inf.pagerank}</span>
                          <span>Betw: {inf.betweenness}</span>
                          <span>Deg: {inf.degree}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Selected Influencer Explainability Card */}
              {selectedInfluencer && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Info className="w-4 h-4 text-blue-400" />
                    <h3 className="text-white text-sm font-semibold">Ranking Explainability: {selectedInfluencer.name}</h3>
                  </div>
                  <p className="text-slate-400 text-xs mb-3">
                    Calculated via composite weighting of PageRank (35%), Brandes Betweenness (35%), Degree Centrality (20%), and Risk Profile (10%).
                  </p>
                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="flex justify-between text-slate-300 mb-0.5">
                        <span>PageRank Contribution</span>
                        <span>{selectedInfluencer.score_breakdown.pagerank_contribution} / 35</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${(selectedInfluencer.score_breakdown.pagerank_contribution / 35) * 100}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-slate-300 mb-0.5">
                        <span>Betweenness Centrality (Broker score)</span>
                        <span>{selectedInfluencer.score_breakdown.betweenness_contribution} / 35</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500" style={{ width: `${(selectedInfluencer.score_breakdown.betweenness_contribution / 35) * 100}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-slate-300 mb-0.5">
                        <span>Degree Centrality</span>
                        <span>{selectedInfluencer.score_breakdown.degree_contribution} / 20</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${(selectedInfluencer.score_breakdown.degree_contribution / 20) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Louvain Communities / Gang Cells */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h2 className="text-white font-semibold flex items-center gap-2 mb-4">
                  <Layers className="w-5 h-5 text-purple-400" />
                  Community Sub-Networks ({analytics.communities.length})
                </h2>
                <div className="space-y-3">
                  {analytics.communities.map((comm) => (
                    <div key={comm.community_id} className="p-3 rounded-lg bg-slate-800/40 border border-slate-800">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white text-sm font-medium">{comm.label}</span>
                      </div>
                      <p className="text-slate-400 text-xs truncate">
                        Members: {comm.key_entities.join(', ')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Detected Anomalies & Risk Alerts */}
            <div className="col-span-2 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white font-semibold flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-orange-400" />
                    Detected Suspicious Patterns & Investigation Leads ({unresolvedAlerts.length})
                  </h2>
                </div>

                {unresolvedAlerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-3" />
                    <p className="text-slate-300 text-sm font-medium">No active anomalies flagged</p>
                    <p className="text-slate-500 text-xs mt-1">
                      Click "Run Anomaly Detection Engine" to scan for circular money transfers, broker hubs, and call bursts.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {unresolvedAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4 group hover:border-slate-600 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: SEVERITY_COLORS[alert.severity] || '#f59e0b' }}
                            />
                            <h3 className="text-white text-sm font-semibold">{alert.title}</h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className="px-2 py-0.5 rounded-full text-xs font-medium uppercase font-mono"
                              style={{
                                backgroundColor: (SEVERITY_COLORS[alert.severity] || '#f59e0b') + '20',
                                color: SEVERITY_COLORS[alert.severity] || '#f59e0b',
                              }}
                            >
                              {alert.severity}
                            </span>
                            <span className="text-slate-500 text-xs font-mono">
                              {ALERT_TYPE_LABELS[alert.alert_type] || alert.alert_type}
                            </span>
                          </div>
                        </div>

                        <p className="text-slate-300 text-xs leading-relaxed mb-3">
                          {alert.description}
                        </p>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-700/40">
                          <button
                            onClick={() => handleResolveAlert(alert.id)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium transition-colors"
                          >
                            Mark Resolved
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
