/**
 * GOATEST Caretaker User Linking Component
 * 
 * PMT: Enable entering User Name and Unique ID together,
 * displaying linked users as `User: {name} — {uniqueId}`.
 */

import React, { useState } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Plus, X, UserCheck } from 'lucide-react';
import type { MonitoredUser } from '../../types';

export interface CaretakerLinkingProps {
  linkedUsers?: MonitoredUser[];
  linkedUserIds?: string[];
  onAddUser?: (name: string, uniqueId: string) => void | Promise<void>;
  onAddUserId?: (id: string) => void;
  onRemoveUser?: (identifier: string) => void | Promise<void>;
  onRemoveUserId?: (id: string) => void;
  onSkip?: () => void;
  showSkipButton?: boolean;
}

export const CaretakerLinking: React.FC<CaretakerLinkingProps> = ({
  linkedUsers = [],
  linkedUserIds = [],
  onAddUser,
  onAddUserId,
  onRemoveUser,
  onRemoveUserId,
  onSkip,
  showSkipButton = true,
}) => {
  const [userName, setUserName] = useState<string>('');
  const [uniqueId, setUniqueId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleAdd = async () => {
    const cleanId = uniqueId.trim().toUpperCase();
    const cleanName = userName.trim();
    if (!cleanId) return;

    setIsSubmitting(true);
    try {
      if (onAddUser) {
        await onAddUser(cleanName || 'User', cleanId);
      } else if (onAddUserId) {
        onAddUserId(cleanId);
      }
      setUserName('');
      setUniqueId('');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Build unified display list
  const displayItems: Array<{ key: string; name: string; uniqueId: string; identifier: string }> = [];

  if (linkedUsers && linkedUsers.length > 0) {
    linkedUsers.forEach((u) => {
      displayItems.push({
        key: u.firebaseUid || u.uniqueId,
        name: u.name || 'User',
        uniqueId: u.uniqueId,
        identifier: u.firebaseUid || u.uniqueId,
      });
    });
  } else if (linkedUserIds && linkedUserIds.length > 0) {
    linkedUserIds.forEach((id) => {
      displayItems.push({
        key: id,
        name: 'User',
        uniqueId: id,
        identifier: id,
      });
    });
  }

  const handleRemove = async (identifier: string) => {
    if (onRemoveUser) {
      await onRemoveUser(identifier);
    } else if (onRemoveUserId) {
      onRemoveUserId(identifier);
    }
  };

  return (
    <div className="w-full flex flex-col gap-3 text-left p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          Add User to Monitor
        </label>
        <span className="text-[10px] text-slate-400 font-medium">Caretaker Console</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1 block">
            User Name
          </label>
          <Input
            placeholder="e.g. Sailesh"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className="text-xs"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1 block">
            Unique ID
          </label>
          <Input
            placeholder="e.g. BUN5Y9"
            value={uniqueId}
            onChange={(e) => setUniqueId(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
            className="text-xs uppercase"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleAdd}
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          disabled={!uniqueId.trim() || isSubmitting}
          isLoading={isSubmitting}
        >
          Add User
        </Button>
      </div>

      {/* Linked Users List */}
      {displayItems.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-1 border-t border-slate-200 dark:border-slate-800 pt-2.5">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Monitored Users ({displayItems.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {displayItems.map((item) => (
              <span
                key={item.key}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 shadow-xs"
              >
                <UserCheck className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                <span>
                  User: {item.name} — <span className="font-bold">{item.uniqueId}</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(item.identifier)}
                  className="ml-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                  title="Remove user"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {showSkipButton && onSkip && displayItems.length === 0 && (
        <div className="pt-1 flex justify-end">
          <button
            type="button"
            onClick={onSkip}
            className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 underline cursor-pointer"
          >
            Skip for now (configure later in Settings)
          </button>
        </div>
      )}
    </div>
  );
};

