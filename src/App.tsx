import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Case } from '@/lib/types';
import { Sidebar } from '@/components/Sidebar';
import { Dashboard } from '@/views/Dashboard';
import { NetworkGraph } from '@/views/NetworkGraph';
import { Entities } from '@/views/Entities';
import { CasesView } from '@/views/CasesView';
import { Analytics } from '@/views/Analytics';
import { DataIngestion } from '@/views/DataIngestion';
import { Shield } from 'lucide-react';

export type ViewKey = 'dashboard' | 'network' | 'entities' | 'cases' | 'analytics' | 'ingestion';

export default function App() {
  const [activeView, setActiveView] = useState<ViewKey>('dashboard');
  const [cases, setCases] = useState<Case[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCases = useCallback(async () => {
    const { data, error } = await supabase
      .from('cases')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Failed to load cases:', error.message);
      return;
    }
    setCases(data || []);
    if (data && data.length > 0 && !activeCaseId) {
      setActiveCaseId(data[0].id);
    }
  }, [activeCaseId]);

  useEffect(() => {
    fetchCases().finally(() => setLoading(false));
  }, [fetchCases]);

  const activeCase = cases.find((c) => c.id === activeCaseId) || null;

  const handleCaseCreated = (newCase: Case) => {
    setCases((prev) => [newCase, ...prev]);
    setActiveCaseId(newCase.id);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Shield className="w-12 h-12 text-blue-500 animate-pulse" />
          <p className="text-slate-400 text-sm">Initializing Analysis System...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        cases={cases}
        activeCaseId={activeCaseId}
        onCaseChange={setActiveCaseId}
      />
      <main className="flex-1 overflow-auto">
        {activeView === 'dashboard' && (
          <Dashboard activeCase={activeCase} onNavigate={setActiveView} onCaseCreated={handleCaseCreated} />
        )}
        {activeView === 'network' && <NetworkGraph activeCase={activeCase} />}
        {activeView === 'entities' && <Entities activeCase={activeCase} />}
        {activeView === 'cases' && (
          <CasesView activeCase={activeCase} cases={cases} onCaseChange={setActiveCaseId} onCaseCreated={handleCaseCreated} />
        )}
        {activeView === 'analytics' && <Analytics activeCase={activeCase} />}
        {activeView === 'ingestion' && <DataIngestion activeCase={activeCase} />}
      </main>
    </div>
  );
}
