import { useTheme } from '../context/ThemeContext';
import { ThemeMode, ThemeAccent } from '../types/theme';

export interface ShbColorTokens {
  // Page level surfaces
  background: string;
  backgroundClass: string;
  
  // Card & Panel surfaces (light gray / elevated)
  card: string;
  cardClass: string;
  cardBorder: string;
  cardBorderClass: string;
  
  // Panels / nested surface
  panel: string;
  panelClass: string;
  panelBorder: string;
  panelBorderClass: string;

  // Buttons
  primaryButton: string;
  primaryButtonText: string;
  primaryButtonClass: string;
  
  secondaryButton: string;
  secondaryButtonText: string;
  secondaryButtonClass: string;

  // Typography
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  
  // Accent & Interactive
  accent: string;
  accentHover: string;
  accentBgLight: string;
  accentRing: string;

  // Status colors
  statusConnected: string;
  statusDisconnected: string;
  statusWarning: string;
  statusDanger: string;
}

/**
 * Universal centralized SHB color resolver.
 * Consumes the global GOATEST Theme state and provides consistent,
 * dark-gray default palette and theme tokens to all SHB components.
 */
export function getShbColors(mode: ThemeMode, accent: ThemeAccent): ShbColorTokens {
  if (mode === 'WHITE') {
    return {
      background: '#f8fafc',
      backgroundClass: 'bg-slate-50 text-slate-900',
      card: '#ffffff',
      cardClass: 'bg-white text-slate-900',
      cardBorder: '#e2e8f0',
      cardBorderClass: 'border-slate-200',
      panel: '#f1f5f9',
      panelClass: 'bg-slate-100 text-slate-800',
      panelBorder: '#cbd5e1',
      panelBorderClass: 'border-slate-300',
      primaryButton: '#0f172a',
      primaryButtonText: '#ffffff',
      primaryButtonClass: 'bg-slate-900 text-white hover:bg-slate-800',
      secondaryButton: '#e2e8f0',
      secondaryButtonText: '#0f172a',
      secondaryButtonClass: 'bg-slate-200 text-slate-900 hover:bg-slate-300',
      textPrimary: '#0f172a',
      textSecondary: '#475569',
      textMuted: '#94a3b8',
      accent: accent.primary,
      accentHover: accent.primaryHover,
      accentBgLight: accent.bgLight,
      accentRing: accent.ring,
      statusConnected: '#10b981',
      statusDisconnected: '#94a3b8',
      statusWarning: '#f59e0b',
      statusDanger: '#ef4444',
    };
  }

  if (mode === 'DARK') {
    return {
      background: '#121214',
      backgroundClass: 'bg-[#121214] text-zinc-100',
      card: '#1c1c20',
      cardClass: 'bg-[#1c1c20] text-zinc-100',
      cardBorder: '#2e2e36',
      cardBorderClass: 'border-[#2e2e36]',
      panel: '#151518',
      panelClass: 'bg-[#151518] text-zinc-200',
      panelBorder: '#282830',
      panelBorderClass: 'border-[#282830]',
      primaryButton: '#f4f4f5',
      primaryButtonText: '#09090b',
      primaryButtonClass: 'bg-zinc-100 text-zinc-950 hover:bg-white',
      secondaryButton: '#27272a',
      secondaryButtonText: '#f4f4f5',
      secondaryButtonClass: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700',
      textPrimary: '#f4f4f5',
      textSecondary: '#a1a1aa',
      textMuted: '#71717a',
      accent: accent.primary,
      accentHover: accent.primaryHover,
      accentBgLight: accent.bgLight,
      accentRing: accent.ring,
      statusConnected: '#10b981',
      statusDisconnected: '#71717a',
      statusWarning: '#f59e0b',
      statusDanger: '#f43f5e',
    };
  }

  // DEFAULT GOATEST Theme: Dark Gray / Gray (NOT PURE BLACK)
  return {
    background: '#1e2025',
    backgroundClass: 'bg-[#1e2025] text-zinc-100',
    card: '#292c35',
    cardClass: 'bg-[#292c35] text-zinc-100',
    cardBorder: '#383d49',
    cardBorderClass: 'border-[#383d49]',
    panel: '#22252d',
    panelClass: 'bg-[#22252d] text-zinc-200',
    panelBorder: '#323642',
    panelBorderClass: 'border-[#323642]',
    primaryButton: '#ffffff',
    primaryButtonText: '#09090b',
    primaryButtonClass: 'bg-white text-zinc-950 hover:bg-zinc-100',
    secondaryButton: '#343844',
    secondaryButtonText: '#f4f4f5',
    secondaryButtonClass: 'bg-[#343844] text-zinc-100 hover:bg-[#3e4352]',
    textPrimary: '#f4f4f5',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    accent: accent.primary,
    accentHover: accent.primaryHover,
    accentBgLight: accent.bgLight,
    accentRing: accent.ring,
    statusConnected: '#10b981',
    statusDisconnected: '#71717a',
    statusWarning: '#f59e0b',
    statusDanger: '#f43f5e',
  };
}

/**
 * Hook for SHB components to access the unified shb_color token system.
 */
export function useShbTheme(): { shb_color: ShbColorTokens; mode: ThemeMode; accent: ThemeAccent } {
  const { mode, accent } = useTheme();
  const shb_color = getShbColors(mode, accent);
  return { shb_color, mode, accent };
}
