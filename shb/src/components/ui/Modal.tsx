import React, { ReactNode } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  const { mode } = useTheme();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`w-full max-w-sm rounded-2xl p-5 shadow-2xl transition-all border ${
          mode === 'WHITE'
            ? 'bg-white text-slate-900 border-slate-200'
            : mode === 'DARK'
            ? 'bg-zinc-900 text-zinc-100 border-zinc-800'
            : 'bg-zinc-850 text-zinc-100 border-zinc-700/80'
        }`}
      >
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-700/40">
          <h3 className="text-base font-bold tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/40 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
};
