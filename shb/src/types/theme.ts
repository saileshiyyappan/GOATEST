export type ThemeMode = 'DEFAULT' | 'WHITE' | 'DARK';

export interface ThemeAccent {
  id: string;
  name: string;
  primary: string;       // Tailwind-compatible hex or class
  primaryHover: string;
  textOnPrimary: string;
  ring: string;
  bgLight: string;
}

export interface ThemeState {
  mode: ThemeMode;
  accent: ThemeAccent;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: ThemeAccent) => void;
}
