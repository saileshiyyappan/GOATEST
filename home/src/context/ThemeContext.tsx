/**
 * GOATEST Default Design Tokens & global custom color palette context.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';

export interface AccentColorPreset {
  id: string;
  name: string;
  primary: string;
  accent: string;
}

export const DEFAULT_ACCENT_COLOR = '#FF6F00';

export const ACCENT_PRESETS: AccentColorPreset[] = [
  { id: 'orange', name: 'GOATEST Orange', primary: '#334155', accent: DEFAULT_ACCENT_COLOR },
  { id: 'sapphire', name: 'Sapphire Blue', primary: '#1d4ed8', accent: '#3b82f6' },
  { id: 'teal', name: 'Medical Teal', primary: '#0f766e', accent: '#14b8a6' },
  { id: 'emerald', name: 'Bio Emerald', primary: '#047857', accent: '#10b981' },
  { id: 'indigo', name: 'Deep Indigo', primary: '#4338ca', accent: '#6366f1' },
  { id: 'violet', name: 'Quiet Violet', primary: '#6d28d9', accent: '#8b5cf6' },
  { id: 'charcoal', name: 'Pure Charcoal', primary: '#18181b', accent: '#71717a' },
];

/**
 * Calculates accessible foreground color (black or white) based on background hex luminance.
 */
export function getAccessibleTextColor(hexColor: string): '#ffffff' | '#0f172a' {
  const cleanHex = hexColor.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  
  // Standard relative luminance formula
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? '#0f172a' : '#ffffff';
}

interface ThemeContextType {
  accentColor: string;
  setAccentColor: (hex: string) => void;
  primaryColor: string;
  setPrimaryColor: (hex: string) => void;
  resetToDefaults: () => void;
}

const STORAGE_KEY_ACCENT = 'goatest_accent_color';
const STORAGE_KEY_PRIMARY = 'goatest_primary_color';

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accentColor, setAccentColorState] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_ACCENT) || DEFAULT_ACCENT_COLOR;
  });

  const [primaryColor, setPrimaryColorState] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_PRIMARY) || '#1e293b';
  });

  const setAccentColor = (hex: string) => {
    setAccentColorState(hex);
    localStorage.setItem(STORAGE_KEY_ACCENT, hex);
  };

  const setPrimaryColor = (hex: string) => {
    setPrimaryColorState(hex);
    localStorage.setItem(STORAGE_KEY_PRIMARY, hex);
  };

  const resetToDefaults = () => {
    setAccentColor(DEFAULT_ACCENT_COLOR);
    setPrimaryColor('#1e293b');
  };

  // Synchronize CSS variables and classes with DOM
  useEffect(() => {
    const root = document.documentElement;

    // Remove old theme classes
    root.classList.remove('theme-white', 'theme-default', 'theme-dark', 'dark');

    // DEFAULT (PMT-11 Blue-Grey 700 / 300 / 900 Design System)
    root.classList.add('theme-default', 'dark');
      root.style.setProperty('--color-bg-app', '#455a64');
      root.style.setProperty('--color-surface', '#90a4ae');
      root.style.setProperty('--color-surface-card', '#90a4ae');
      root.style.setProperty('--color-card-text', '#263238');
      root.style.setProperty('--color-card-text-muted', '#37474f');
      root.style.setProperty('--color-card-border', '#263238');
      root.style.setProperty('--color-surface-hover', '#78909c');
      root.style.setProperty('--color-border', '#263238');
      root.style.setProperty('--color-outline', '#263238');
      root.style.setProperty('--color-text-main', '#ffffff');
      root.style.setProperty('--color-text-sub', '#cfd8dc');
      root.style.setProperty('--color-text-dark', '#263238');
      root.style.setProperty('--color-topbar-bg', '#455a64');
      root.style.setProperty('--color-bottombar-bg', '#455a64');
      root.style.setProperty('--color-button-primary-bg', '#263238');
      root.style.setProperty('--color-button-primary-fg', '#ffffff');

    // PMT-11 Home Aliases
    root.style.setProperty('--home-bg', '#455a64');
    root.style.setProperty('--home-surface', '#90a4ae');
    root.style.setProperty('--home-outline', '#263238');
    root.style.setProperty('--home-text', '#263238');
    root.style.setProperty('--home-text-secondary', '#37474f');
    root.style.setProperty('--home-icon', '#263238');

    // Dynamic accent & primary tokens
    const primaryFg = getAccessibleTextColor(primaryColor);
    const accentFg = getAccessibleTextColor(accentColor);

    root.style.setProperty('--color-primary', primaryColor);
    root.style.setProperty('--color-primary-foreground', primaryFg);
    root.style.setProperty('--color-accent', accentColor);
    root.style.setProperty('--color-accent-foreground', accentFg);
    
    // Emergency token (reserved exclusively for CRIB)
    root.style.setProperty('--color-emergency', '#ef4444');
    root.style.setProperty('--color-emergency-foreground', '#ffffff');
  }, [primaryColor, accentColor]);

  return (
    <ThemeContext.Provider
      value={{
        accentColor,
        setAccentColor,
        primaryColor,
        setPrimaryColor,
        resetToDefaults,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
