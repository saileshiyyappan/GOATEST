/**
 * GOATEST Assessment Hero & Action Component
 * 
 * Prominent START ASSESSMENT pipeline launcher.
 * Displays real assessment status from Firestore.
 * ZERO fake physiological readings.
 * Full universal theme contrast adaptation.
 */

import React from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Activity, ArrowRight, CheckCircle2, Clock, PlayCircle } from 'lucide-react';
import type { AssessmentStatusSummary } from '../../types';

export interface HomeAssessmentHeroProps {
  assessmentStatus: AssessmentStatusSummary;
  onStartAssessment: () => void;
}

export const HomeAssessmentHero: React.FC<HomeAssessmentHeroProps> = ({
  assessmentStatus,
  onStartAssessment,
}) => {
  const isCompleted = assessmentStatus.status === 'Completed';
  const hasScheduled = assessmentStatus.todayScheduledCount > 0;

  return (
    <Card
      padding="lg"
      className="relative overflow-hidden shadow-xs bg-[#90a4ae] text-[#263238] border border-[#263238]"
    >
      <div className="flex flex-col gap-4 text-left">
        {/* Header & Status Indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#78909c] text-[#263238] border border-[#263238] flex items-center justify-center font-bold">
              <Activity className="w-4 h-4 text-[#263238]" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#37474f]">
                Assessment
              </span>
              <h2 className="text-sm font-bold text-[#263238]">
                Daily Assessment
              </h2>
            </div>
          </div>

          <span
            className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-lg uppercase tracking-wider border ${
              isCompleted
                ? 'bg-emerald-800 text-emerald-100 border-emerald-950'
                : hasScheduled
                ? 'bg-[#37474f] text-white border-[#263238]'
                : 'bg-[#78909c] text-[#263238] border-[#263238]'
            }`}
          >
            {assessmentStatus.status}
          </span>
        </div>

        {/* Assessment Subtext & Real Metrics */}
        <div className="flex flex-col gap-1.5 text-xs text-[#263238]">
          <p className="leading-relaxed font-medium">
            Record guided biological readings from your connected sensor device.
          </p>

          <div className="flex items-center gap-4 pt-1 text-[11px] text-[#37474f] font-medium">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#263238]" />
              <span>
                Today's Schedule:{' '}
                <b className="text-[#263238] font-bold">{assessmentStatus.todayCompletedCount}</b> /{' '}
                <b className="text-[#263238] font-bold">{assessmentStatus.todayScheduledCount}</b>
              </span>
            </div>

            {assessmentStatus.lastCompletedAt && (
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-800" />
                <span>
                  Last:{' '}
                  {new Date(assessmentStatus.lastCompletedAt).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Big Prominent Action Button */}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={onStartAssessment}
          leftIcon={<PlayCircle className="w-5 h-5" />}
          rightIcon={<ArrowRight className="w-4 h-4 ml-auto" />}
          className="font-bold text-sm tracking-wide shadow-md py-3.5 bg-[#263238] text-white hover:bg-[#1f292e] border border-[#263238]"
        >
          START ASSESSMENT
        </Button>
      </div>
    </Card>
  );
};
