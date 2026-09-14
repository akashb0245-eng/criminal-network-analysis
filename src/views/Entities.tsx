import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Case, Entity, EntityType, Relationship } from '@/lib/types';
import { ENTITY_TYPE_COLORS, ENTITY_TYPE_LABELS, RELATIONSHIP_TYPE_LABELS } from '@/lib/analysis';
import { Users, Plus, X, Search, Activity, Link2, AlertCircle } from 'lucide-react';

interface EntitiesProps {
  activeCase: Case | null;
}

export function Entities({ activeCase }: EntitiesProps) {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  const [showLink, setShowLink] = useState(false);

  const fetchData = useCallback(async () => {
    if (!activeCase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [eRes, rRes] = await Promise.all([
      supabase.from('entities').select('*').eq('case_id', activeCase.id).order('created_at', { ascending: false }),
      supabase.from('relationships').select('*').eq('case_id', activeCase.id),
    ]);
    setEntities(eRes.data || []);
    setRelationships(rRes.data || []);
    setLoading(false);
  }, [activeCase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = entities.filter((e) => {
    const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase()) || (e.subtype?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesType = typeFilter === 'all' || e.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const getConnectionCount = (entityId: string) =>
    relationships.filter((r) => r.source_entity_id === entityId || r.target_entity_id === entityId).length;

  const handleDelete = async (id: string) => {
    await supabase.from('entities').delete().eq('id', id);
    fetchData();
  };

  const handleSave = async (data: Partial<Entity>) => {
    if (editingEntity) {
      await supabase.from('entities').update(data).eq('id', editingEntity.id);
    } else {
      await supabase.from('entities').insert({ ...data, case_id: activeCase!.id });
    }
    setEditingEntity(null);
    setShowAdd(false);
    fetchData();
  };

  if (!activeCase) {
    return (
      <div className="p-8 flex flex-col items-center justify-center py-24">
        <Users className="w-12 h-12 text-slate-700 mb-4" />
        <p className="text-slate-500">Select a case to manage entities.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Entities</h1>
          <p className="text-slate-400 text-sm mt-1">{activeCase.name} — {entities.length} entities tracked</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowLink(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors">
            <Link2 className="w-4 h-4" /> Add Relationship
          </button>
          <button onClick={() => { setEditingEntity(null); setShowAdd(true); }} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Add Entity
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search entities..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-white text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Types</option>
          {Object.entries(ENTITY_TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Activity className="w-8 h-8 text-blue-500 animate-pulse" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Users className="w-12 h-12 text-slate-700 mb-4" />
          <p className="text-slate-500 mb-4">{entities.length === 0 ? 'No entities yet. Add your first entity to start building the network.' : 'No entities match your filters.'}</p>
          {entities.length === 0 && (
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" /> Add First Entity
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {filtered.map((entity) => {
            const connections = getConnectionCount(entity.id);
            return (
              <div
                key={entity.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: ENTITY_TYPE_COLORS[entity.type] + '20' }}>
                      <span className="text-base font-bold" style={{ color: ENTITY_TYPE_COLORS[entity.type] }}>
                        {entity.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-medium truncate">{entity.name}</p>
                      <p className="text-slate-500 text-xs">{ENTITY_TYPE_LABELS[entity.type]}{entity.subtype ? ` · ${entity.subtype}` : ''}</p>
                    </div>
                  </div>
                  {entity.is_key_influencer && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-xs flex-shrink-0">
                      <AlertCircle className="w-3 h-3" /> Key
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-slate-400 text-xs">{connections} connections</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-12 h-1 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${entity.risk_score}%`, backgroundColor: entity.risk_score >= 70 ? '#ef4444' : entity.risk_score >= 40 ? '#f59e0b' : '#10b981' }} />
                    </div>
                    <span className="text-slate-400 text-xs">Risk {entity.risk_score}</span>
                  </div>
                </div>

                {Object.keys(entity.metadata).length > 0 && (
                  <div className="bg-slate-800/50 rounded-lg p-2.5 mb-3">
                    {Object.entries(entity.metadata).slice(0, 3).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between py-0.5">
                        <span className="text-slate-500 text-xs capitalize">{k}</span>
                        <span className="text-slate-300 text-xs truncate ml-2">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditingEntity(entity); setShowAdd(true); }} className="flex-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors">Edit</button>
                  <button onClick={() => handleDelete(entity.id)} className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition-colors">Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <EntityModal
          entity={editingEntity}
          onClose={() => { setShowAdd(false); setEditingEntity(null); }}
          onSave={handleSave}
        />
      )}
      {showLink && (
        <RelationshipModal
          entities={entities}
          onClose={() => setShowLink(false)}
          onSave={async (data) => {
            await supabase.from('relationships').insert({ ...data, case_id: activeCase.id });
            setShowLink(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

function EntityModal({ entity, onClose, onSave }: { entity: Entity | null; onClose: () => void; onSave: (data: Partial<Entity>) => void }) {
  const [name, setName] = useState(entity?.name ?? '');
  const [type, setType] = useState<EntityType>(entity?.type ?? 'person');
  const [subtype, setSubtype] = useState(entity?.subtype ?? '');
  const [riskScore, setRiskScore] = useState(entity?.risk_score ?? 0);
  const [isKeyInfluencer, setIsKeyInfluencer] = useState(entity?.is_key_influencer ?? false);
  const [notes, setNotes] = useState(entity?.notes ?? '');
  const [metadataText, setMetadataText] = useState(entity ? JSON.stringify(entity.metadata, null, 2) : '{}');

  const handleSave = () => {
    let metadata: Record<string, unknown> = {};
    try { metadata = JSON.parse(metadataText || '{}'); } catch { /* keep empty */ }
    onSave({
      name: name.trim(),
      type,
      subtype: subtype.trim() || null,
      risk_score: riskScore,
      is_key_influencer: isKeyInfluencer,
      notes: notes.trim() || null,
      metadata,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold text-lg">{entity ? 'Edit Entity' : 'Add Entity'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-slate-400 text-sm block mb-1.5">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rajesh Kumar" className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-sm block mb-1.5">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as EntityType)} className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500">
                {Object.entries(ENTITY_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-sm block mb-1.5">Subtype</label>
              <input value={subtype} onChange={(e) => setSubtype(e.target.value)} placeholder="e.g. suspect, witness" className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1.5">Risk Score: {riskScore}</label>
            <input type="range" min={0} max={100} value={riskScore} onChange={(e) => setRiskScore(Number(e.target.value))} className="w-full accent-blue-500" />
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1.5">Metadata (JSON)</label>
            <textarea value={metadataText} onChange={(e) => setMetadataText(e.target.value)} rows={3} className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:border-blue-500 resize-none" />
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1.5">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500 resize-none" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isKeyInfluencer} onChange={(e) => setIsKeyInfluencer(e.target.checked)} className="accent-blue-500" />
            <span className="text-slate-300 text-sm">Mark as Key Influencer</span>
          </label>
          <button onClick={handleSave} disabled={!name.trim()} className="w-full px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
            {entity ? 'Update Entity' : 'Add Entity'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RelationshipModal({ entities, onClose, onSave }: { entities: Entity[]; onClose: () => void; onSave: (data: Partial<Relationship>) => void }) {
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [type, setType] = useState<Relationship['type']>('associate');
  const [strength, setStrength] = useState(5);
  const [description, setDescription] = useState('');

  const handleSave = () => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    onSave({
      source_entity_id: sourceId,
      target_entity_id: targetId,
      type,
      strength,
      description: description.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold text-lg">Add Relationship</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-slate-400 text-sm block mb-1.5">Source Entity</label>
            <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500">
              <option value="">Select entity...</option>
              {entities.map((e) => <option key={e.id} value={e.id}>{e.name} ({ENTITY_TYPE_LABELS[e.type]})</option>)}
            </select>
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1.5">Target Entity</label>
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500">
              <option value="">Select entity...</option>
              {entities.map((e) => <option key={e.id} value={e.id}>{e.name} ({ENTITY_TYPE_LABELS[e.type]})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-sm block mb-1.5">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as Relationship['type'])} className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500">
                {Object.entries(RELATIONSHIP_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-sm block mb-1.5">Strength: {strength}</label>
              <input type="range" min={1} max={10} value={strength} onChange={(e) => setStrength(Number(e.target.value))} className="w-full accent-blue-500 mt-3" />
            </div>
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1.5">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Brief description of the relationship..." className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500 resize-none" />
          </div>
          <button onClick={handleSave} disabled={!sourceId || !targetId || sourceId === targetId} className="w-full px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
            Create Relationship
          </button>
        </div>
      </div>
    </div>
  );
}
