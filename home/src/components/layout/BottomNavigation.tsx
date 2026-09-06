/**
 * GOATEST Universal Bottom Navigation
 * 
 * Fixed 7-slot bottom navigation layout:
 * HOME | TEST | MEDIC |  +  | REPORTS | AI | SETTINGS
 * Physical centering guaranteed via 7-column grid.
 * Floating red emergency '+' button in slot 4.
 */

import React from 'react';
import { Home, Activity, Brain, FileText, Bot, Settings, Plus } from 'lucide-react';
import type { NavigationTab } from '../../types';

export interface BottomNavigationProps {
  activeTab: NavigationTab;
  onNavigate: (tab: NavigationTab) => void;
  onEmergencyClick: () => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onNavigate,
  onEmergencyClick,
}) => {
  return (
    <nav className="shrink-0 min-h-16 h-16 pb-[env(safe-area-inset-bottom)] box-content bg-[#1d2022] border-t border-[var(--color-border)] grid grid-cols-7 items-center px-1 relative z-30 select-none transition-colors">
      {/* 1. HOME */}
      <button
        type="button"
        onClick={() => onNavigate('home')}
        className={`flex flex-col items-center justify-center h-full transition-colors ${
          activeTab === 'home'
            ? 'text-[var(--color-accent)] font-bold'
            : 'text-[#cfd8dc] hover:text-white'
        }`}
        title="Home"
      >
        <div className="relative">
          <Home className="w-5 h-5" />
          {activeTab === 'home' && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--color-accent)]" />
          )}
        </div>
        <span className="text-[9px] tracking-tight mt-1 leading-none">Home</span>
      </button>

      {/* 2. TEST */}
      <button
        type="button"
        onClick={() => onNavigate('test')}
        className={`flex flex-col items-center justify-center h-full transition-colors ${
          activeTab === 'test'
            ? 'text-[var(--color-accent)] font-bold'
            : 'text-[#cfd8dc] hover:text-white'
        }`}
        title="Test"
      >
        <div className="relative">
          <Activity className="w-5 h-5" />
          {activeTab === 'test' && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--color-accent)]" />
          )}
        </div>
        <span className="text-[9px] tracking-tight mt-1 leading-none">Test</span>
      </button>

      {/* 3. MEDIC (Brain Icon) */}
      <button
        type="button"
        onClick={() => onNavigate('medic')}
        className={`flex flex-col items-center justify-center h-full transition-colors ${
          activeTab === 'medic'
            ? 'text-[var(--color-accent)] font-bold'
            : 'text-[#cfd8dc] hover:text-white'
        }`}
        title="Medic"
      >
        <div className="relative">
          <Brain className="w-5 h-5" />
          {activeTab === 'medic' && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--color-accent)]" />
          )}
        </div>
        <span className="text-[9px] tracking-tight mt-1 leading-none">Medic</span>
      </button>

      {/* 4. CENTER RED '+' EMERGENCY BUTTON */}
      <div className="flex items-center justify-center -mt-[21px] -mb-[2px] mx-0 pb-0">
        <button
          type="button"
          onClick={onEmergencyClick}
          title="Emergency"
          className="w-12 h-12 py-0 my-0 mx-0 mt-[14px] rounded-full bg-[var(--color-emergency)] text-[var(--color-emergency-foreground)] flex items-center justify-center shadow-lg shadow-red-950/70 active:scale-95 transition-transform border-4 border-[var(--color-bottombar-bg)] cursor-pointer"
        >
          <Plus className="w-6 h-6 stroke-[3]" />
        </button>
      </div>

      {/* 5. REPORTS */}
      <button
        type="button"
        onClick={() => onNavigate('reports')}
        className={`flex flex-col items-center justify-center h-full transition-colors ${
          activeTab === 'reports'
            ? 'text-[var(--color-accent)] font-bold'
            : 'text-[#cfd8dc] hover:text-white'
        }`}
        title="Reports"
      >
        <div className="relative">
          <FileText className="w-5 h-5" />
          {activeTab === 'reports' && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--color-accent)]" />
          )}
        </div>
        <span className="text-[9px] tracking-tight mt-1 leading-none">Reports</span>
      </button>

      {/* 6. AI */}
      <button
        type="button"
        onClick={() => onNavigate('ai')}
        className={`flex flex-col items-center justify-center h-full transition-colors ${
          activeTab === 'ai'
            ? 'text-[var(--color-accent)] font-bold'
            : 'text-[#cfd8dc] hover:text-white'
        }`}
        title="AI"
      >
        <div className="relative">
          <Bot className="w-5 h-5" />
          {activeTab === 'ai' && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--color-accent)]" />
          )}
        </div>
        <span className="text-[9px] tracking-tight mt-1 leading-none">AI</span>
      </button>

      {/* 7. SETTINGS */}
      <button
        type="button"
        onClick={() => onNavigate('settings')}
        className={`flex flex-col items-center justify-center h-full transition-colors ${
          activeTab === 'settings'
            ? 'text-[var(--color-accent)] font-bold'
            : 'text-[#cfd8dc] hover:text-white'
        }`}
        title="Settings"
      >
        <div className="relative">
          <Settings className="w-5 h-5" />
          {activeTab === 'settings' && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--color-accent)]" />
          )}
        </div>
        <span className="text-[9px] tracking-tight mt-1 leading-none">Settings</span>
      </button>
    </nav>
  );
};
