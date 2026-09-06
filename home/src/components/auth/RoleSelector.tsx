/**
 * GOATEST Role Selector Component
 */

import React from 'react';
import type { UserRole } from '../../types';

export interface RoleSelectorProps {
  value: UserRole;
  onChange: (role: UserRole) => void;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({ value, onChange }) => {
  return (
    <div className="w-full flex flex-col gap-2 text-left">
      <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
        I use GOATEST as
      </label>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange('USER')}
          className={`min-h-11 flex-1 rounded-full border-2 px-4 text-xs font-bold uppercase tracking-wider transition-all ${
            value === 'USER'
              ? 'border-[var(--color-accent)] bg-[#111111] text-white shadow-xs'
              : 'border-[#3f464b] bg-[#111111] text-slate-300 hover:border-slate-200'
          }`}
        >
          USER
        </button>

        <button
          type="button"
          onClick={() => onChange('CARETAKER')}
          className={`min-h-11 flex-1 rounded-full border-2 px-4 text-xs font-bold uppercase tracking-wider transition-all ${
            value === 'CARETAKER'
              ? 'border-[var(--color-accent)] bg-[#111111] text-white shadow-xs'
              : 'border-[#3f464b] bg-[#111111] text-slate-300 hover:border-slate-200'
          }`}
        >
          CARETAKER
        </button>
      </div>
    </div>
  );
};
