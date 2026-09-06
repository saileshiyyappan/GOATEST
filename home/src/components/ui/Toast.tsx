/**
 * GOATEST Toast Overlay Renderer
 */

import React from 'react';
import { useToast } from '../../context/ToastContext';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 inset-x-0 z-50 flex flex-col items-center gap-2 pointer-events-none px-4 max-w-sm mx-auto">
      {toasts.map((toast) => {
        const iconConfig = {
          success: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />,
          error: <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />,
          warning: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />,
          info: <Info className="w-4 h-4 text-sky-500 shrink-0" />,
        };

        return (
          <div
            key={toast.id}
            className="w-full pointer-events-auto bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md text-white border border-slate-700/80 shadow-lg rounded-xl p-3 flex items-start gap-2.5 animate-in slide-in-from-top-2 duration-200"
          >
            <div className="mt-0.5">{iconConfig[toast.type]}</div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-xs font-semibold text-white tracking-wide">
                {toast.title}
              </p>
              {toast.description && (
                <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                  {toast.description}
                </p>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
