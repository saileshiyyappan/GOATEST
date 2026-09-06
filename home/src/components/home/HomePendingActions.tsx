/**
 * GOATEST Pending Actions Component
 * 
 * Shows real state-backed pending tasks.
 * ZERO fabricated tasks.
 * Full universal theme contrast adaptation.
 */

import React from 'react';
import { Card } from '../ui/Card';
import { SectionHeader } from '../ui/PageHeader';
import { Bluetooth, Calendar, FileSpreadsheet, Users, ChevronRight } from 'lucide-react';
import type { PendingActionItem } from '../../types';

export interface HomePendingActionsProps {
  pendingActions: PendingActionItem[];
  onActionClick: (action: PendingActionItem) => void;
}

export const HomePendingActions: React.FC<HomePendingActionsProps> = ({
  pendingActions,
  onActionClick,
}) => {
  if (pendingActions.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5 text-left">
      <SectionHeader
        title="Pending Actions"
        subtitle="System tasks & configuration"
      />

      <div className="flex flex-col gap-2">
        {pendingActions.map((action) => {
          const isHigh = action.priority === 'high';
          return (
            <Card
              key={action.id}
              padding="sm"
              variant="interactive"
              onClick={() => onActionClick(action)}
              className="flex items-center justify-between shadow-xs bg-[#90a4ae] text-[#263238] border border-[#263238]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-[#263238] ${
                    isHigh
                      ? 'bg-amber-800 text-amber-100'
                      : 'bg-[#78909c] text-[#263238]'
                  }`}
                >
                  {action.actionType === 'CONNECT_DEVICE' ? (
                    <Bluetooth className="w-4 h-4 text-[#263238]" />
                  ) : action.actionType === 'SCHEDULE_TEST' ? (
                    <Calendar className="w-4 h-4 text-[#263238]" />
                  ) : action.actionType === 'CONFIGURE_PHB' ? (
                    <FileSpreadsheet className="w-4 h-4 text-[#263238]" />
                  ) : (
                    <Users className="w-4 h-4 text-[#263238]" />
                  )}
                </div>

                <div className="min-w-0 text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[#263238] truncate">
                      {action.title}
                    </span>
                    {isHigh && (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-amber-800 text-amber-100 border border-amber-950">
                        Priority
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#37474f] font-medium truncate">
                    {action.description}
                  </p>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-[#263238] shrink-0 ml-2" />
            </Card>
          );
        })}
      </div>
    </div>
  );
};
