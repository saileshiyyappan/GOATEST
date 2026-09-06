import React from 'react';
import { useTheme, ACCENT_PALETTES } from '../../context/ThemeContext';
import { ThemeMode } from '../../types/theme';
import { Modal } from '../ui/Modal';
import { Check } from 'lucide-react';

export interface ThemeCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ThemeCustomizerModal: React.FC<ThemeCustomizerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { mode, accent, setMode, setAccent } = useTheme();

  const themes: { id: ThemeMode; label: string; desc: string }[] = [
    { id: 'DEFAULT', label: 'Default Theme', desc: 'Dark gray backdrop with high-contrast UI' },
    { id: 'WHITE', label: 'Clean White', desc: 'Bright white clinical presentation' },
    { id: 'DARK', label: 'Dark Mode', desc: 'Ultra-dark contrast surfaces' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Appearance & Themes">
      <div className="space-y-4">
        {/* Theme Mode Selector */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-2">
            Base Interface Mode
          </label>
          <div className="space-y-1.5">
            {themes.map((t) => {
              const active = mode === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setMode(t.id)}
                  className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between transition-colors ${
                    active
                      ? 'bg-zinc-800 border-cyan-500/80 text-zinc-100'
                      : 'bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:bg-zinc-800/40'
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold">{t.label}</div>
                    <div className="text-[11px] text-zinc-400">{t.desc}</div>
                  </div>
                  {active && <Check className="w-4 h-4 text-cyan-400" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Accent Color Palette */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-2">
            Accent Palette
          </label>
          <div className="grid grid-cols-5 gap-2">
            {ACCENT_PALETTES.map((pal) => {
              const active = accent.id === pal.id;
              return (
                <button
                  key={pal.id}
                  onClick={() => setAccent(pal)}
                  className={`h-10 rounded-xl flex items-center justify-center transition-all ${
                    active ? 'ring-2 ring-white scale-105' : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: pal.primary }}
                  title={pal.name}
                >
                  {active && <Check className="w-4 h-4 text-white drop-shadow" />}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-zinc-400 text-center mt-2">
            Selected: <span className="font-semibold text-zinc-200">{accent.name}</span>
          </p>
        </div>
      </div>
    </Modal>
  );
};
