import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ThemeMode, ThemeAccent, ThemeState } from '../types/theme';

export const ACCENT_PALETTES: ThemeAccent[] = [
  {
    id: 'cyan',
    name: 'Clinical Cyan',
    primary: '#06b6d4',
    primaryHover: '#0891b2',
    textOnPrimary: '#ffffff',
    ring: 'rgba(6, 182, 212, 0.4)',
    bgLight: 'rgba(6, 182, 212, 0.1)',
  },
  {
    id: 'emerald',
    name: 'Vital Emerald',
    primary: '#10b981',
    primaryHover: '#059669',
    textOnPrimary: '#ffffff',
    ring: 'rgba(16, 185, 129, 0.4)',
    bgLight: 'rgba(16, 185, 129, 0.1)',
  },
  {
    id: 'indigo',
    name: 'Precision Blue',
    primary: '#3b82f6',
    primaryHover: '#2563eb',
    textOnPrimary: '#ffffff',
    ring: 'rgba(59, 130, 246, 0.4)',
    bgLight: 'rgba(59, 130, 246, 0.1)',
  },
  {
    id: 'violet',
    name: 'Diagnostic Violet',
    primary: '#8b5cf6',
    primaryHover: '#7c3aed',
    textOnPrimary: '#ffffff',
    ring: 'rgba(139, 92, 246, 0.4)',
    bgLight: 'rgba(139, 92, 246, 0.1)',
  },
  {
    id: 'amber',
    name: 'Amber Glow',
    primary: '#f59e0b',
    primaryHover: '#d97706',
    textOnPrimary: '#000000',
    ring: 'rgba(245, 158, 11, 0.4)',
    bgLight: 'rgba(245, 158, 11, 0.1)',
  },
];

const ThemeContext = createContext<ThemeState | undefined>(undefined);

const THEME_STORAGE_KEY = 'goatest_theme_mode';
const ACCENT_STORAGE_KEY = 'goatest_theme_accent';

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'WHITE' || saved === 'DARK' || saved === 'DEFAULT') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'DEFAULT';
  });

  const [accent, setAccentState] = useState<ThemeAccent>(() => {
    try {
      const saved = localStorage.getItem(ACCENT_STORAGE_KEY);
      if (saved) {
        const found = ACCENT_PALETTES.find((a) => a.id === saved);
        if (found) return found;
      }
    } catch {
      // ignore
    }
    return ACCENT_PALETTES[0]; // Default to Cyan
  });

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newMode);
    } catch {
      // ignore
    }
  };

  const setAccent = (newAccent: ThemeAccent) => {
    setAccentState(newAccent);
    try {
      localStorage.setItem(ACCENT_STORAGE_KEY, newAccent.id);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    document.documentElement.style.setProperty('--goatest-accent', accent.primary);
    document.documentElement.style.setProperty('--goatest-accent-hover', accent.primaryHover);
    document.documentElement.style.setProperty('--goatest-accent-ring', accent.ring);
    document.documentElement.style.setProperty('--goatest-accent-bg-light', accent.bgLight);
  }, [accent]);

  return (
    <ThemeContext.Provider value={{ mode, accent, setMode, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeState => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
