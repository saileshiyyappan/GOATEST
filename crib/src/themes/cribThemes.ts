import { CribMode } from '../types/crib';

export interface CribThemeConfig {
  mode: CribMode;
  modeLabel: string;
  modeDescription: string;
  bgClass: string;
  headerBg: string;
  panelBg: string;
  panelBorder: string;
  accentColor: string;
  textPrimary: string;
  textSecondary: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  glowClass: string;
  buttonPrimary: string;
  overrideBtnBg: string;
}

export const CRIB_THEMES: Record<CribMode, CribThemeConfig> = {
  SDCU: {
    mode: 'SDCU',
    modeLabel: 'SDCU EMERGENCY',
    modeDescription: 'Systemic Distress & Critical Urgency Mode',
    bgClass: 'bg-neutral-950 text-neutral-100',
    headerBg: 'bg-red-950/80 border-b border-red-800/80 backdrop-blur-md',
    panelBg: 'bg-red-950/30 backdrop-blur-sm',
    panelBorder: 'border-red-800/60 hover:border-red-600/80',
    accentColor: 'text-red-400',
    textPrimary: 'text-red-50',
    textSecondary: 'text-red-200/70',
    badgeBg: 'bg-red-900/60',
    badgeText: 'text-red-100',
    badgeBorder: 'border-red-600',
    glowClass: 'shadow-[0_0_25px_rgba(220,38,38,0.25)]',
    buttonPrimary: 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/40',
    overrideBtnBg: 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_30px_rgba(220,38,38,0.4)] border-red-400',
  },
  SSB: {
    mode: 'SSB',
    modeLabel: 'SSB UNCONSCIOUS STATE',
    modeDescription: 'Somatic Syncope / Unconscious State Bio-Monitoring',
    bgClass: 'bg-stone-950 text-stone-100',
    headerBg: 'bg-purple-950/80 border-b border-amber-800/70 backdrop-blur-md',
    panelBg: 'bg-purple-950/25 backdrop-blur-sm',
    panelBorder: 'border-purple-800/60 hover:border-amber-600/70',
    accentColor: 'text-amber-400',
    textPrimary: 'text-stone-50',
    textSecondary: 'text-purple-200/70',
    badgeBg: 'bg-purple-900/60',
    badgeText: 'text-amber-200',
    badgeBorder: 'border-amber-500/80',
    glowClass: 'shadow-[0_0_25px_rgba(168,85,247,0.2)]',
    buttonPrimary: 'bg-purple-700 hover:bg-purple-600 text-white shadow-purple-950/40',
    overrideBtnBg: 'bg-purple-800 hover:bg-purple-700 text-amber-200 shadow-[0_0_30px_rgba(168,85,247,0.35)] border-amber-400/80',
  },
  DIAG: {
    mode: 'DIAG',
    modeLabel: 'DIAG DIAGNOSTIC CONSOLE',
    modeDescription: 'Clinical Diagnostic Telemetry & State Analysis',
    bgClass: 'bg-slate-950 text-slate-100',
    headerBg: 'bg-blue-950/80 border-b border-blue-800/80 backdrop-blur-md',
    panelBg: 'bg-blue-950/30 backdrop-blur-sm',
    panelBorder: 'border-blue-800/60 hover:border-cyan-600/80',
    accentColor: 'text-cyan-400',
    textPrimary: 'text-blue-50',
    textSecondary: 'text-blue-200/70',
    badgeBg: 'bg-blue-900/60',
    badgeText: 'text-blue-100',
    badgeBorder: 'border-cyan-500',
    glowClass: 'shadow-[0_0_25px_rgba(37,99,235,0.25)]',
    buttonPrimary: 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40',
    overrideBtnBg: 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_30px_rgba(37,99,235,0.4)] border-cyan-400',
  },
};
