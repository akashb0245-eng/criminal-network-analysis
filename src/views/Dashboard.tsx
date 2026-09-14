import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Case, Entity, Relationship, Alert, Evidence, CrimeEvent } from '@/lib/types';
import { ALERT_TYPE_LABELS, SEVERITY_COLORS, ENTITY_TYPE_COLORS, ENTITY_TYPE_LABELS } from '@/lib/analysis';
import { Users, Share2, AlertTriangle, FileText, TrendingUp, Activity, MapPin, Calendar, Plus, X } from 'lucide-react';
import type { ViewKey } from '@/App';

interface DashboardProps {
  activeCase: Case | null;
  onNavigate: (view: ViewKey) => void;
  onCaseCreated: (c: Case) => void;
}

export function Dashboard({ activeCase, onNavigate, onCaseCreated }: DashboardProps) {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [events, setEvents] = useState<CrimeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewCase, setShowNewCase] = useState(false);

  const fetchData = useCallback(async () => {
    if (!activeCase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [eRes, rRes, aRes, evRes, evtRes] = await Promise.all([
      supabase.from('entities').select('*').eq('case_id', activeCase.id),
      supabase.from('relationships').select('*').eq('case_id', activeCase.id),
      supabase.from('alerts').select('*').eq('case_id', activeCase.id).order('created_at', { ascending: false }),
      supabase.from('evidence').select('*').eq('case_id', activeCase.id),
      supabase.from('events').select('*').eq('case_id', activeCase.id).order('event_date', { ascending: false }),
    ]);
    setEntities(eRes.data || []);
    setRelationships(rRes.data || []);
    setAlerts(aRes.data || []);
    setEvidence(evRes.data || []);
    setEvents(evtRes.data || []);
    setLoading(false);
  }, [activeCase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const unresolvedAlerts = alerts.filter((a) => !a.is_resolved);
  const keyInfluencers = entities.filter((e) => e.is_key_influencer);
  const entityTypeCounts = entities.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const stats = [
    { label: 'Entities', value: entities.length, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Relationships', value: relationships.length, icon: Share2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Active Alerts', value: unresolvedAlerts.length, icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { label: 'Evidence Items', value: evidence.length, icon: FileText, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  ];

  if (!activeCase) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <button
            onClick={() => setShowNewCase(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> New Case
          </button>
        </div>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-slate-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-300 mb-2">No Active Case</h2>
          <p className="text-slate-500 text-sm max-w-md">Create a new investigation case to start analyzing criminal networks, entities, and relationships.</p>
          <button
            onClick={() => setShowNewCase(true)}
            className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Create First Case
          </button>
        </div>
        {showNewCase && <NewCaseModal onClose={() => setShowNewCase(false)} onCreated={onCaseCreated} />}
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{activeCase.name}</h1>
          <p className="text-slate-400 text-sm mt-1">{activeCase.description || 'No description provided'}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize ${
            activeCase.status === 'open' ? 'bg-emerald-500/10 text-emerald-400' :
            activeCase.status === 'pending' ? 'bg-orange-500/10 text-orange-400' :
            'bg-slate-500/10 text-slate-400'
          }`}>{activeCase.status}</span>
          <span className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize ${
            activeCase.priority === 'critical' ? 'bg-red-500/10 text-red-400' :
            activeCase.priority === 'high' ? 'bg-orange-500/10 text-orange-400' :
            activeCase.priority === 'medium' ? 'bg-blue-500/10 text-blue-400' :
            'bg-slate-500/10 text-slate-400'
          }`}>{activeCase.priority} priority</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Activity className="w-8 h-8 text-blue-500 animate-pulse" />
        </div>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-white">{stat.value}</p>
                  <p className="text-slate-500 text-sm mt-1">{stat.label}</p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Left: Alerts + Key Influencers */}
            <div className="col-span-2 space-y-6">
              {/* Active Alerts */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-400" />
                    Active Alerts
                  </h2>
                  <button onClick={() => onNavigate('analytics')} className="text-blue-400 hover:text-blue-300 text-sm">View all</button>
                </div>
                {unresolvedAlerts.length === 0 ? (
                  <p className="text-slate-500 text-sm py-4 text-center">No active alerts. Run pattern detection from Analytics.</p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {unresolvedAlerts.slice(0, 6).map((alert) => (
                      <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors">
                        <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: SEVERITY_COLORS[alert.severity] }} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-white text-sm font-medium truncate">{alert.title}</p>
                            <span className="text-slate-500 text-xs flex-shrink-0">{ALERT_TYPE_LABELS[alert.alert_type]}</span>
                          </div>
                          <p className="text-slate-400 text-xs mt-0.5 line-clamp-2">{alert.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Key Influencers */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h2 className="text-white font-semibold flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                  Key Influencers
                </h2>
                {keyInfluencers.length === 0 ? (
                  <p className="text-slate-500 text-sm py-4 text-center">No key influencers identified yet. Run analysis from Analytics tab.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {keyInfluencers.slice(0, 6).map((entity) => (
                      <div key={entity.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: ENTITY_TYPE_COLORS[entity.type] + '20' }}>
                          <span className="text-sm font-bold" style={{ color: ENTITY_TYPE_COLORS[entity.type] }}>
                            {entity.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-white text-sm font-medium truncate">{entity.name}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 text-xs">{ENTITY_TYPE_LABELS[entity.type]}</span>
                            <span className="text-orange-400 text-xs">Risk: {entity.risk_score}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Entity breakdown + Timeline */}
            <div className="space-y-6">
              {/* Entity breakdown */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h2 className="text-white font-semibold flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-emerald-400" />
                  Entity Breakdown
                </h2>
                <div className="space-y-3">
                  {Object.entries(entityTypeCounts).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ENTITY_TYPE_COLORS[type] }} />
                        <span className="text-slate-300 text-sm">{ENTITY_TYPE_LABELS[type]}</span>
                      </div>
                      <span className="text-white text-sm font-medium">{count}</span>
                    </div>
                  ))}
                  {Object.keys(entityTypeCounts).length === 0 && (
                    <p className="text-slate-500 text-sm text-center py-2">No entities yet</p>
                  )}
                </div>
              </div>

              {/* Recent Events */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h2 className="text-white font-semibold flex items-center gap-2 mb-4">
                  <Calendar className="w-5 h-5 text-purple-400" />
                  Recent Events
                </h2>
                {events.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-2">No events logged</p>
                ) : (
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {events.slice(0, 5).map((event) => (
                      <div key={event.id} className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: SEVERITY_COLORS[event.severity] }} />
                        <div className="min-w-0">
                          <p className="text-white text-sm font-medium truncate">{event.title}</p>
                          <div className="flex items-center gap-2 text-slate-500 text-xs mt-0.5">
                            {event.event_date && <span>{new Date(event.event_date).toLocaleDateString()}</span>}
                            {event.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />{event.location}
                              </span>
                            )}
                          </div>
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
      {showNewCase && <NewCaseModal onClose={() => setShowNewCase(false)} onCreated={onCaseCreated} />}
    </div>
  );
}

function NewCaseModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Case) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Case name is required');
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error } = await supabase
      .from('cases')
      .insert({ name: name.trim(), description: description.trim() || null, priority })
      .select()
      .single();
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onCreated(data);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold text-lg">New Investigation Case</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-slate-400 text-sm block mb-1.5">Case Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Operation Nightfall"
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the investigation..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none"
            />
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1.5">Priority</label>
            <div className="grid grid-cols-4 gap-2">
              {(['low', 'medium', 'high', 'critical'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                    priority === p
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Case'}
          </button>
        </div>
      </div>
    </div>
  );
}
