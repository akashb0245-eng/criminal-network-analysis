import { Shield, LayoutDashboard, Share2, Users, FolderKanban, BarChart3, Upload, ChevronDown } from 'lucide-react';
import type { Case } from '@/lib/types';
import type { ViewKey } from '@/App';
import { useState } from 'react';

interface SidebarProps {
  activeView: ViewKey;
  onViewChange: (view: ViewKey) => void;
  cases: Case[];
  activeCaseId: string | null;
  onCaseChange: (id: string) => void;
}

const NAV_ITEMS: { key: ViewKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'network', label: 'Network Graph', icon: Share2 },
  { key: 'entities', label: 'Entities', icon: Users },
  { key: 'cases', label: 'Cases & Evidence', icon: FolderKanban },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'ingestion', label: 'Data Ingestion', icon: Upload },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-500',
  medium: 'bg-blue-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

export function Sidebar({ activeView, onViewChange, cases, activeCaseId, onCaseChange }: SidebarProps) {
  const [caseDropdownOpen, setCaseDropdownOpen] = useState(false);
  const activeCase = cases.find((c) => c.id === activeCaseId);

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0">
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-sm leading-tight">SENTINEL</h1>
            <p className="text-slate-500 text-xs">Network Analysis</p>
          </div>
        </div>
      </div>

      {/* Case selector */}
      <div className="px-3 py-3 border-b border-slate-800 relative">
        <button
          onClick={() => setCaseDropdownOpen(!caseDropdownOpen)}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-left"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${activeCase ? PRIORITY_COLORS[activeCase.priority] : 'bg-slate-600'}`} />
            <div className="min-w-0">
              <p className="text-slate-400 text-xs">Active Case</p>
              <p className="text-white text-sm font-medium truncate">{activeCase?.name ?? 'Select case'}</p>
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${caseDropdownOpen ? 'rotate-180' : ''}`} />
        </button>
        {caseDropdownOpen && (
          <div className="absolute left-3 right-3 top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
            {cases.length === 0 ? (
              <p className="px-3 py-3 text-slate-500 text-sm">No cases yet</p>
            ) : (
              cases.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    onCaseChange(c.id);
                    setCaseDropdownOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-700 transition-colors text-left first:rounded-t-lg last:rounded-b-lg ${
                    c.id === activeCaseId ? 'bg-slate-700' : ''
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_COLORS[c.priority]}`} />
                  <div className="min-w-0">
                    <p className="text-white text-sm truncate">{c.name}</p>
                    <p className="text-slate-500 text-xs capitalize">{c.status} · {c.priority}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onViewChange(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-slate-800">
        <p className="text-slate-600 text-xs">SENTINEL v1.0</p>
        <p className="text-slate-700 text-xs mt-1">AI-Powered Criminal Network Analysis</p>
      </div>
    </aside>
  );
}
