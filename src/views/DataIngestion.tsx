import { useState } from 'react';
import type { Case, SourceType } from '@/lib/types';
import { api, type ExtractedEntityCandidate, type ExtractedRelationshipCandidate } from '@/lib/api';
import { ENTITY_TYPE_LABELS, SOURCE_TYPE_LABELS } from '@/lib/analysis';
import { 
  Upload, FileText, Sparkles, CheckCircle2, X, Activity, ArrowRight, 
  Wand2, PhoneCall, DollarSign, Database, Link, AlertCircle, Layers
} from 'lucide-react';

interface DataIngestionProps {
  activeCase: Case | null;
}

type IngestionTab = 'text' | 'cdr' | 'financial';

const SAMPLE_FIR_TEXT = `On 15th March 2025, suspect Rajesh Kumar was arrested at Sector 14, Delhi in connection with FIR #4471. The accused is a known offender with prior criminal history. Investigation revealed that Rajesh Kumar frequently contacted Mohan Sharma via phone at +91-9876543210. Call Detail Records show 47 calls between them in the last month. Financial records indicate that Rs. 5,00,000 was transferred from Mohan Sharma's account to Priya Singh, who is the wife of Rajesh Kumar. Priya Singh was found at Green Park Colony, Delhi. Surveillance reports show Rajesh Kumar and Mohan Sharma met at Connaught Place on multiple occasions. The duo is believed to be part of the North Delhi Gang. Vehicle registration DL-01-AB-1234 was spotted near the crime scene. Another associate, Vikram Patel, was identified through social media intelligence. Vikram Patel works for Sharma Enterprises and has received Rs. 2,00,000 from Mohan Sharma. The group operates from Karol Bagh Area, Delhi.`;

const SAMPLE_CDR_CSV = `caller_phone,receiver_phone,timestamp,duration_sec,call_type,cell_tower
+91-9876543210,+91-9123456780,2025-03-10T14:32:00Z,185,voice,Tower_Sector14_Delhi
+91-9876543210,+91-9123456780,2025-03-11T09:15:00Z,420,voice,Tower_Sector14_Delhi
+91-9123456780,+91-9988776655,2025-03-12T18:40:00Z,95,voice,Tower_CP_Delhi
+91-9988776655,+91-9876543210,2025-03-13T22:10:00Z,310,voice,Tower_KarolBagh_Delhi
+91-9123456780,+91-9444332211,2025-03-14T11:05:00Z,60,voice,Tower_CP_Delhi
+91-9444332211,+91-9876543210,2025-03-15T01:30:00Z,540,voice,Tower_GreenPark_Delhi`;

const SAMPLE_FINANCIAL_CSV = `source_account,target_account,source_holder,target_holder,amount,currency,timestamp,notes
ACC_9001,ACC_9002,Mohan Sharma,Priya Singh,500000,INR,2025-03-01T10:00:00Z,Family Hawala Transfer
ACC_9002,ACC_9003,Priya Singh,Vikram Patel,200000,INR,2025-03-03T14:30:00Z,Logistics advance
ACC_9003,ACC_9001,Vikram Patel,Mohan Sharma,150000,INR,2025-03-07T16:00:00Z,Refund structuring (Circular)
ACC_9001,ACC_9004,Mohan Sharma,Sharma Enterprises,1200000,INR,2025-03-08T11:15:00Z,Commercial pass-through
ACC_9004,ACC_9005,Sharma Enterprises,North Delhi Front,850000,INR,2025-03-09T17:45:00Z,Cash payout`;

export function DataIngestion({ activeCase }: DataIngestionProps) {
  const [activeTab, setActiveTab] = useState<IngestionTab>('text');
  
  // Text Ingestion State
  const [sourceType, setSourceType] = useState<SourceType>('fir');
  const [title, setTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [extractedEntities, setExtractedEntities] = useState<ExtractedEntityCandidate[]>([]);
  const [extractedRelationships, setExtractedRelationships] = useState<ExtractedRelationshipCandidate[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  
  // CDR Ingestion State
  const [cdrTitle, setCdrTitle] = useState('CDR Batch #401 - Delhi Surveillance');
  const [cdrCsv, setCdrCsv] = useState('');
  
  // Financial Ingestion State
  const [finTitle, setFinTitle] = useState('Bank Ledger #2025 - Financial Flow Investigation');
  const [finCsv, setFinCsv] = useState('');

  // Status & Progress
  const [loadingExtract, setLoadingExtract] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // --- Text Extraction Handler ---
  const handleExtractText = async () => {
    if (!activeCase || !textContent.trim()) return;
    setLoadingExtract(true);
    setErrorMessage(null);
    setResultMessage(null);
    try {
      const res = await api.extractText(
        activeCase.id,
        title || 'Intelligence Report',
        textContent,
        sourceType
      );
      setExtractedEntities(res.entities.map(e => ({ ...e, selected: true })));
      setExtractedRelationships(res.relationships.map(r => ({ ...r, selected: true })));
      setKeywords(res.keywords || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Extraction failed');
    } finally {
      setLoadingExtract(false);
    }
  };

  const handleCommitText = async () => {
    if (!activeCase || extractedEntities.length === 0) return;
    setIngesting(true);
    setErrorMessage(null);
    try {
      const selectedEnts = extractedEntities.filter(e => e.selected);
      const selectedRels = extractedRelationships.filter(r => r.selected);
      const res = await api.commitTextIngestion({
        case_id: activeCase.id,
        title: title || 'Intelligence Report',
        source_type: sourceType,
        content: textContent,
        entities: selectedEnts,
        relationships: selectedRels
      });
      setResultMessage(`Successfully ingested: ${res.entities_created} new entities created, ${res.entities_linked} linked via entity resolution, and ${res.relationships_created} graph edges.`);
      setTextContent('');
      setExtractedEntities([]);
      setExtractedRelationships([]);
    } catch (err: any) {
      setErrorMessage(err.message || 'Commit failed');
    } finally {
      setIngesting(false);
    }
  };

  // --- CDR Ingestion Handler ---
  const handleIngestCDR = async () => {
    if (!activeCase || !cdrCsv.trim()) return;
    setIngesting(true);
    setErrorMessage(null);
    try {
      const lines = cdrCsv.trim().split('\n');
      const records = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map(s => s.trim());
        if (parts.length >= 4) {
          records.push({
            caller_phone: parts[0],
            receiver_phone: parts[1],
            timestamp: parts[2],
            duration_sec: parseInt(parts[3]) || 60,
            call_type: parts[4] || 'voice',
            cell_tower: parts[5] || null
          });
        }
      }
      const res = await api.ingestCDR({
        case_id: activeCase.id,
        title: cdrTitle,
        records
      });
      setResultMessage(`CDR Ingestion Complete: ${records.length} records processed, ${res.entities_created} phone nodes created, ${res.entities_linked} matched existing entities, and ${res.relationships_created} communication edges established.`);
      setCdrCsv('');
    } catch (err: any) {
      setErrorMessage(err.message || 'CDR Ingestion failed');
    } finally {
      setIngesting(false);
    }
  };

  // --- Financial Ingestion Handler ---
  const handleIngestFinancial = async () => {
    if (!activeCase || !finCsv.trim()) return;
    setIngesting(true);
    setErrorMessage(null);
    try {
      const lines = finCsv.trim().split('\n');
      const records = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map(s => s.trim());
        if (parts.length >= 5) {
          records.push({
            source_account: parts[0],
            target_account: parts[1],
            source_holder: parts[2] || null,
            target_holder: parts[3] || null,
            amount: parseFloat(parts[4]) || 0.0,
            currency: parts[5] || 'INR',
            timestamp: parts[6] || new Date().toISOString(),
            notes: parts[7] || null
          });
        }
      }
      const res = await api.ingestFinancial({
        case_id: activeCase.id,
        title: finTitle,
        records
      });
      setResultMessage(`Financial Ledger Ingestion Complete: ${records.length} transactions processed, ${res.entities_created} account/holder nodes created, ${res.relationships_created} financial edges established.`);
      setFinCsv('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Financial Ingestion failed');
    } finally {
      setIngesting(false);
    }
  };

  if (!activeCase) {
    return (
      <div className="p-8 flex flex-col items-center justify-center py-24">
        <Upload className="w-12 h-12 text-slate-700 mb-4" />
        <p className="text-slate-500">Select an investigation case to ingest intelligence data.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Heterogeneous Data Ingestion</h1>
          <p className="text-slate-400 text-sm mt-1">
            {activeCase.name} — Real-time NLP entity extraction, Entity Resolution & Multi-format parser
          </p>
        </div>
      </div>

      {/* Ingestion Tabs */}
      <div className="flex border-b border-slate-800 mb-6 gap-2">
        <button
          onClick={() => setActiveTab('text')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'text'
              ? 'border-blue-500 text-blue-400 bg-blue-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          Unstructured Text & FIRs
        </button>
        <button
          onClick={() => setActiveTab('cdr')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'cdr'
              ? 'border-blue-500 text-blue-400 bg-blue-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <PhoneCall className="w-4 h-4" />
          Call Detail Records (CDR CSV)
        </button>
        <button
          onClick={() => setActiveTab('financial')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'financial'
              ? 'border-blue-500 text-blue-400 bg-blue-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Financial Transaction Ledgers (CSV)
        </button>
      </div>

      {/* Result Notification */}
      {resultMessage && (
        <div className="mb-6 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
          <p className="text-emerald-300 text-sm flex-1">{resultMessage}</p>
          <button onClick={() => setResultMessage(null)} className="text-emerald-400 hover:text-emerald-300">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
          <p className="text-red-300 text-sm flex-1">{errorMessage}</p>
          <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-300">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* TAB 1: TEXT & FIR EXTRACTION */}
      {activeTab === 'text' && (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                Intelligence Text Input
              </h2>
              <button
                onClick={() => {
                  setTextContent(SAMPLE_FIR_TEXT);
                  setTitle('FIR #4471 - Multi-Gang Syndicate Report');
                  setSourceType('fir');
                }}
                className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium px-2.5 py-1 rounded bg-blue-500/10 border border-blue-500/20"
              >
                <Wand2 className="w-3.5 h-3.5" /> Load FIR Sample
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-slate-400 text-sm block mb-1.5">Document / FIR Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. FIR #4471 - Crime Branch Intelligence"
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-400 text-sm block mb-1.5">Intelligence Source Type</label>
                <select
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value as SourceType)}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  {Object.entries(SOURCE_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 text-sm block mb-1.5">Raw Intelligence Text</label>
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  rows={10}
                  placeholder="Paste FIR narrative, interrogation transcripts, police logs..."
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <button
                onClick={handleExtractText}
                disabled={loadingExtract || !textContent.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loadingExtract ? <Activity className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {loadingExtract ? 'Extracting via Backend NLP...' : 'Run NLP Entity & Relation Extraction'}
              </button>
            </div>
          </div>

          {/* Extraction Review Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-white font-semibold flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Extraction & Entity Resolution Results
            </h2>

            {extractedEntities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Database className="w-10 h-10 text-slate-700 mb-3" />
                <p className="text-slate-400 text-sm">No extracted items yet.</p>
                <p className="text-slate-500 text-xs mt-1 max-w-xs">
                  Paste or load sample text and click "Run NLP Entity & Relation Extraction" to test the pipeline.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Entities List */}
                <div>
                  <h3 className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">
                    Extracted Entities ({extractedEntities.filter(e => e.selected).length}/{extractedEntities.length})
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {extractedEntities.map((ent, i) => (
                      <div
                        key={i}
                        className={`p-2.5 rounded-lg border text-left transition-colors flex items-start gap-3 ${
                          ent.selected ? 'bg-slate-800 border-slate-700' : 'bg-slate-800/30 border-slate-800 opacity-40'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={ent.selected}
                          onChange={() => {
                            const updated = [...extractedEntities];
                            updated[i].selected = !updated[i].selected;
                            setExtractedEntities(updated);
                          }}
                          className="mt-1 accent-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white text-sm font-medium truncate">{ent.name}</span>
                            <span className="text-slate-500 text-xs">{ENTITY_TYPE_LABELS[ent.type] || ent.type}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono">
                              {Math.round(ent.confidence * 100)}% conf
                            </span>
                          </div>
                          {ent.resolved_reason && (
                            <p className="text-amber-400/90 text-xs mt-1 flex items-center gap-1">
                              <Link className="w-3 h-3 flex-shrink-0" />
                              {ent.resolved_reason}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Relationships List */}
                <div>
                  <h3 className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">
                    Extracted Graph Edges ({extractedRelationships.filter(r => r.selected).length}/{extractedRelationships.length})
                  </h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {extractedRelationships.map((rel, i) => (
                      <div
                        key={i}
                        className={`p-2.5 rounded-lg border text-left flex items-start gap-3 ${
                          rel.selected ? 'bg-slate-800 border-slate-700' : 'bg-slate-800/30 border-slate-800 opacity-40'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={rel.selected}
                          onChange={() => {
                            const updated = [...extractedRelationships];
                            updated[i].selected = !updated[i].selected;
                            setExtractedRelationships(updated);
                          }}
                          className="mt-1 accent-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-blue-400 font-medium">{rel.source}</span>
                            <ArrowRight className="w-3 h-3 text-slate-500" />
                            <span className="text-emerald-400 font-medium">{rel.target}</span>
                            <span className="text-slate-500 capitalize ml-2">({rel.type})</span>
                          </div>
                          <p className="text-slate-400 text-xs mt-0.5 truncate">{rel.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ingest Commit Button */}
                <button
                  onClick={handleCommitText}
                  disabled={ingesting || extractedEntities.filter(e => e.selected).length === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {ingesting ? <Activity className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {ingesting ? 'Committing to Case Graph...' : `Commit ${extractedEntities.filter(e => e.selected).length} Entities & ${extractedRelationships.filter(r => r.selected).length} Edges`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CDR CSV INGESTION */}
      {activeTab === 'cdr' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <PhoneCall className="w-5 h-5 text-cyan-400" />
              Call Detail Records (CDR) Structured Parser
            </h2>
            <button
              onClick={() => setCdrCsv(SAMPLE_CDR_CSV)}
              className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium px-2.5 py-1 rounded bg-cyan-500/10 border border-cyan-500/20"
            >
              <Wand2 className="w-3.5 h-3.5" /> Load Sample CDR Dataset
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-slate-400 text-sm block mb-1.5">Batch Title / Surveillance Operation</label>
              <input
                value={cdrTitle}
                onChange={(e) => setCdrTitle(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-slate-400 text-sm block mb-1.5">
                Paste CDR CSV Data (Format: <code className="text-slate-300">caller_phone,receiver_phone,timestamp,duration_sec,call_type,cell_tower</code>)
              </label>
              <textarea
                value={cdrCsv}
                onChange={(e) => setCdrCsv(e.target.value)}
                rows={10}
                placeholder="caller_phone,receiver_phone,timestamp,duration_sec,call_type,cell_tower..."
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            <button
              onClick={handleIngestCDR}
              disabled={ingesting || !cdrCsv.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {ingesting ? <Activity className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
              {ingesting ? 'Processing CDR Logs...' : 'Parse & Generate Communication Network'}
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: FINANCIAL LEDGER CSV INGESTION */}
      {activeTab === 'financial' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              Financial Transaction Ledger (Bank Accounts & Hawala)
            </h2>
            <button
              onClick={() => setFinCsv(SAMPLE_FINANCIAL_CSV)}
              className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-medium px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20"
            >
              <Wand2 className="w-3.5 h-3.5" /> Load Sample Financial Dataset
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-slate-400 text-sm block mb-1.5">Ledger Title</label>
              <input
                value={finTitle}
                onChange={(e) => setFinTitle(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-slate-400 text-sm block mb-1.5">
                Paste Bank / Hawala CSV (Format: <code className="text-slate-300">source_account,target_account,source_holder,target_holder,amount,currency,timestamp,notes</code>)
              </label>
              <textarea
                value={finCsv}
                onChange={(e) => setFinCsv(e.target.value)}
                rows={10}
                placeholder="source_account,target_account,source_holder,target_holder,amount,currency,timestamp,notes..."
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            <button
              onClick={handleIngestFinancial}
              disabled={ingesting || !finCsv.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {ingesting ? <Activity className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
              {ingesting ? 'Processing Bank Ledger...' : 'Parse & Construct Financial Flow Graph'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
