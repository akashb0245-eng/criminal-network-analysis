import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Case, Entity, Evidence, CrimeEvent, SourceType, Severity } from '@/lib/types';
import { SOURCE_TYPE_LABELS, SEVERITY_COLORS } from '@/lib/analysis';
import { FolderKanban, Plus, X, FileText, Calendar, MapPin, Activity, AlertCircle, ChevronRight } from 'lucide-react';

interface CasesViewProps {
  activeCase: Case | null;
  cases: Case[];
  onCaseChange: (id: string) => void;
  onCaseCreated: (c: Case) => void;
}

export function CasesView({ activeCase, cases, onCaseChange, onCaseCreated }: CasesViewProps) {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [events, setEvents] = useState<CrimeEvent[]>([]);
  const [entityCount, setEntityCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAddEvidence, setShowAddEvidence] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showNewCase, setShowNewCase] = useState(false);

  const fetchData = useCallback(async () => {
    if (!activeCase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [evRes, evtRes, eRes] = await Promise.all([
      supabase.from('evidence').select('*').eq('case_id', activeCase.id).order('created_at', { ascending: false }),
      supabase.from('events').select('*').eq('case_id', activeCase.id).order('event_date', { ascending: false }),
      supabase.from('entities').select('id', { count: 'exact', head: true }).eq('case_id', activeCase.id),
    ]);
    setEvidence(evRes.data || []);
    setEvents(evtRes.data || []);
    setEntityCount(eRes.count || 0);
    setLoading(false);
  }, [activeCase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeleteEvidence = async (id: string) => {
    await supabase.from('evidence').delete().eq('id', id);
    fetchData();
  };

  const handleDeleteEvent = async (id: string) => {
    await supabase.from('events').delete().eq('id', id);
    fetchData();
  };

  const PRIORITY_COLORS: Record<string, string> = {
    low: 'bg-slate-500/10 text-slate-400',
    medium: 'bg-blue-500/10 text-blue-400',
    high: 'bg-orange-500/10 text-orange-400',
    critical: 'bg-red-500/10 text-red-400',
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Cases & Evidence</h1>
          <p className="text-slate-400 text-sm mt-1">Manage investigation cases and intelligence data</p>
        </div>
        <button onClick={() => setShowNewCase(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> New Case
        </button>
      </div>

      {/* Case list */}
      <div className="mb-6">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {cases.map((c) => (
            <button
              key={c.id}
              onClick={() => onCaseChange(c.id)}
              className={`flex-shrink-0 px-4 py-3 rounded-xl border transition-all text-left min-w-[200px] ${
                c.id === activeCase?.id
                  ? 'bg-slate-800 border-blue-500'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <FolderKanban className="w-4 h-4 text-slate-500" />
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${PRIORITY_COLORS[c.priority]}`}>{c.priority}</span>
              </div>
              <p className="text-white text-sm font-medium truncate">{c.name}</p>
              <p className="text-slate-500 text-xs capitalize mt-0.5">{c.status} · {new Date(c.created_at).toLocaleDateString()}</p>
            </button>
          ))}
        </div>
      </div>

      {!activeCase ? (
        <div className="flex flex-col items-center justify-center py-20">
          <FolderKanban className="w-12 h-12 text-slate-700 mb-4" />
          <p className="text-slate-500">Select or create a case to manage evidence.</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <Activity className="w-8 h-8 text-blue-500 animate-pulse" />
        </div>
      ) : (
        <>
          {/* Case header */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-semibold text-lg">{activeCase.name}</h2>
              <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${PRIORITY_COLORS[activeCase.priority]}`}>{activeCase.priority} priority</span>
            </div>
            <p className="text-slate-400 text-sm mb-4">{activeCase.description || 'No description provided'}</p>
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-slate-500 text-xs">Entities</p>
                <p className="text-white text-xl font-bold mt-1">{entityCount}</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-slate-500 text-xs">Evidence</p>
                <p className="text-white text-xl font-bold mt-1">{evidence.length}</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-slate-500 text-xs">Events</p>
                <p className="text-white text-xl font-bold mt-1">{events.length}</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-slate-500 text-xs">Status</p>
                <p className="text-white text-xl font-bold mt-1 capitalize">{activeCase.status}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Evidence */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-400" />
                  Evidence ({evidence.length})
                </h3>
                <button onClick={() => setShowAddEvidence(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {evidence.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-8">No evidence collected yet.</p>
                ) : (
                  evidence.map((ev) => (
                    <div key={ev.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 group hover:border-slate-700 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ev.status === 'flagged' ? 'bg-red-500/10 text-red-400' : ev.status === 'analyzed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'}`}>
                            {ev.status}
                          </span>
                          <span className="text-slate-500 text-xs">{SOURCE_TYPE_LABELS[ev.source_type]}</span>
                        </div>
                        <button onClick={() => handleDeleteEvidence(ev.id)} className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-white text-sm font-medium mb-1">{ev.title}</p>
                      {ev.content && <p className="text-slate-400 text-xs line-clamp-3">{ev.content}</p>}
                      <p className="text-slate-600 text-xs mt-2">{new Date(ev.created_at).toLocaleDateString()}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Events */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  Events ({events.length})
                </h3>
                <button onClick={() => setShowAddEvent(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {events.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-8">No events logged yet.</p>
                ) : (
                  events.map((event) => (
                    <div key={event.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 group hover:border-slate-700 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SEVERITY_COLORS[event.severity] }} />
                          <span className="text-slate-500 text-xs capitalize">{event.severity}</span>
                        </div>
                        <button onClick={() => handleDeleteEvent(event.id)} className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-white text-sm font-medium mb-1">{event.title}</p>
                      {event.description && <p className="text-slate-400 text-xs line-clamp-2">{event.description}</p>}
                      <div className="flex items-center gap-3 text-slate-600 text-xs mt-2">
                        {event.event_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(event.event_date).toLocaleDateString()}</span>}
                        {event.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{event.location}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {showNewCase && <NewCaseModal onClose={() => setShowNewCase(false)} onCreated={onCaseCreated} />}
      {showAddEvidence && activeCase && (
        <AddEvidenceModal caseId={activeCase.id} onClose={() => setShowAddEvidence(false)} onSaved={() => { setShowAddEvidence(false); fetchData(); }} />
      )}
      {showAddEvent && activeCase && (
        <AddEventModal caseId={activeCase.id} onClose={() => setShowAddEvent(false)} onSaved={() => { setShowAddEvent(false); fetchData(); }} />
      )}
    </div>
  );
}

function NewCaseModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Case) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { data } = await supabase.from('cases').insert({ name: name.trim(), description: description.trim() || null, priority }).select().single();
    setSaving(false);
    if (data) { onCreated(data); onClose(); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold text-lg">New Investigation Case</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-slate-400 text-sm block mb-1.5">Case Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Operation Stormbreaker" className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1.5">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500 resize-none" />
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1.5">Priority</label>
            <div className="grid grid-cols-4 gap-2">
              {(['low', 'medium', 'high', 'critical'] as const).map((p) => (
                <button key={p} onClick={() => setPriority(p)} className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${priority === p ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>{p}</button>
              ))}
            </div>
          </div>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="w-full px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
            {saving ? 'Creating...' : 'Create Case'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddEvidenceModal({ caseId, onClose, onSaved }: { caseId: string; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [sourceType, setSourceType] = useState<SourceType>('fir');
  const [content, setContent] = useState('');

  const handleSave = async () => {
    if (!title.trim()) return;
    await supabase.from('evidence').insert({ case_id: caseId, title: title.trim(), source_type: sourceType, content: content.trim() || null });
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold text-lg">Add Evidence</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-slate-400 text-sm block mb-1.5">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. FIR #4471 - Theft Report" className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1.5">Source Type</label>
            <select value={sourceType} onChange={(e) => setSourceType(e.target.value as SourceType)} className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500">
              {Object.entries(SOURCE_TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1.5">Content</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} placeholder="Paste raw intelligence data, FIR text, CDR records, financial transactions..." className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500 resize-none font-mono" />
          </div>
          <button onClick={handleSave} disabled={!title.trim()} className="w-full px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50">Add Evidence</button>
        </div>
      </div>
    </div>
  );
}

function AddEventModal({ caseId, onClose, onSaved }: { caseId: string; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');
  const [severity, setSeverity] = useState<Severity>('medium');

  const handleSave = async () => {
    if (!title.trim()) return;
    await supabase.from('events').insert({
      case_id: caseId,
      title: title.trim(),
      description: description.trim() || null,
      event_date: eventDate ? new Date(eventDate).toISOString() : null,
      location: location.trim() || null,
      severity,
    });
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold text-lg">Add Event</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-slate-400 text-sm block mb-1.5">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Warehouse Raid" className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1.5">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-sm block mb-1.5">Date</label>
              <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-slate-400 text-sm block mb-1.5">Severity</label>
              <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)} className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500">
                {(['low', 'medium', 'high', 'critical'] as const).map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1.5">Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Sector 14, Delhi" className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <button onClick={handleSave} disabled={!title.trim()} className="w-full px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50">Add Event</button>
        </div>
      </div>
    </div>
  );
}
