import React from 'react';
import { Home, Activity, FileText, Settings } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export type NavTab = 'home' | 'test' | 'reports' | 'settings';

export interface BottomNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onSelectTab }) => {
  const { mode, accent } = useTheme();

  const tabs: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Home', icon: <Home className="w-5 h-5" /> },
    { id: 'test', label: 'Assessment', icon: <Activity className="w-5 h-5" /> },
    { id: 'reports', label: 'Reports', icon: <FileText className="w-5 h-5" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 max-w-md mx-auto z-40 px-3 py-2 border-t backdrop-blur-lg flex items-center justify-around transition-colors ${
        mode === 'WHITE'
          ? 'bg-white/95 border-slate-200 text-slate-600'
          : mode === 'DARK'
          ? 'bg-zinc-950/95 border-zinc-800 text-zinc-400'
          : 'bg-zinc-900/95 border-zinc-800 text-zinc-400'
      }`}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-150 relative ${
              isActive
                ? 'font-bold'
                : 'hover:text-zinc-200 opacity-70 hover:opacity-100'
            }`}
            style={{ color: isActive ? accent.primary : undefined }}
          >
            <div className="mb-0.5">{tab.icon}</div>
            <span className="text-[10px] tracking-tight">{tab.label}</span>
            {isActive && (
              <span
                className="absolute -bottom-1 w-1 h-1 rounded-full"
                style={{ backgroundColor: accent.primary }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
};
