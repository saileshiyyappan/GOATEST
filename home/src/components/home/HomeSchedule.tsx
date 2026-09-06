/**
 * GOATEST Today's Schedule Component
 * 
 * Real schedule items from Firestore.
 * ZERO fabricated scheduled items.
 * Clean empty state when no schedule is active.
 * Full universal theme contrast adaptation.
 */

import React from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { SectionHeader } from '../ui/PageHeader';
import { Calendar, Clock, Plus, CheckCircle } from 'lucide-react';
import type { AssessmentScheduleItem } from '../../types';

export interface HomeScheduleProps {
  schedule: AssessmentScheduleItem[];
  onOpenScheduleModal: () => void;
  onStartScheduledTest: (item: AssessmentScheduleItem) => void;
}

export const HomeSchedule: React.FC<HomeScheduleProps> = ({
  schedule,
  onOpenScheduleModal,
  onStartScheduledTest,
}) => {
  return (
    <div className="flex flex-col gap-2.5 text-left">
      <SectionHeader
        title="Today's Schedule"
        titleClassName="text-[#dde2e9]"
        subtitle="Assessment timetable"
        action={
          <button
            type="button"
            onClick={onOpenScheduleModal}
            className="text-[11px] font-bold text-[#f2f6f8] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>
              <Plus className="w-3.5 h-3.5" />
            </span>
            <span className="text-[#eaf3f7]">Add Slot</span>
          </button>
        }
      />

      {schedule.length === 0 ? (
        <Card padding="md" className="flex flex-col items-center justify-center py-6 text-center shadow-xs bg-[#90a4ae] text-[#263238] border border-[#263238]">
          <div className="w-10 h-10 rounded-xl bg-[#78909c] text-[#263238] border border-[#263238] flex items-center justify-center mb-2">
            <Calendar className="w-5 h-5" />
          </div>
          <h4 className="text-xs font-bold text-[#263238]">
            No assessments scheduled today
          </h4>
          <p className="text-xs text-[#37474f] font-medium mt-1 max-w-[240px] leading-relaxed">
            Set routine assessment times to maintain consistent physiological records.
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={onOpenScheduleModal}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            className="mt-3.5 text-xs bg-[#263238] text-white hover:bg-[#1f292e] border border-[#263238]"
          >
            Schedule Assessment
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {schedule.map((item) => {
            const isCompleted = item.status === 'Completed';
            return (
              <Card
                key={item.id}
                padding="sm"
                className="flex items-center justify-between transition-all shadow-xs bg-[#90a4ae] text-[#263238] border border-[#263238]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-[#263238] ${
                      isCompleted
                        ? 'bg-emerald-800 text-emerald-100'
                        : 'bg-[#78909c] text-[#263238]'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Clock className="w-4 h-4" />
                    )}
                  </div>

                  <div className="min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#263238] truncate">
                        {item.title}
                      </span>
                      <span className="text-[10px] font-bold text-[#37474f]">
                        {item.time}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#37474f] font-medium truncate">
                      Target: {item.organTarget || 'General System'}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 ml-2">
                  {isCompleted ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-800 text-emerald-100 border border-emerald-950">
                      Completed
                    </span>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onStartScheduledTest(item)}
                      className="text-xs h-7 px-2.5 bg-[#263238] text-white hover:bg-[#1f292e] border border-[#263238]"
                    >
                      Start
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
