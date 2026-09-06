/**
 * GOATEST AI Health Insight Component
 * 
 * ZERO fabricated AI health insights or invented conclusions.
 * Clear clinical pipeline standby state.
 * Full universal theme contrast adaptation.
 */

import React from 'react';
import { Card } from '../ui/Card';
import { SectionHeader } from '../ui/PageHeader';
import { Sparkles, ShieldCheck, ArrowRight } from 'lucide-react';

export interface HomeAiInsightProps {
  onOpenAiChat?: () => void;
}

export const HomeAiInsight: React.FC<HomeAiInsightProps> = ({ onOpenAiChat }) => {
  return (
    <div className="flex flex-col gap-2.5 text-left">
      <SectionHeader
        title="AI Health Insights"
        subtitle="Clinical analysis pipeline"
      />

      <Card
        padding="md"
        className="relative overflow-hidden shadow-xs bg-[#90a4ae] text-[#263238] border border-[#263238]"
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#78909c] text-[#263238] border border-[#263238] flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4 text-[#263238]" />
          </div>

          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-1.5 mb-1">
              <h4 className="text-xs font-bold text-[#263238]">
                Health Insights
              </h4>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#78909c] text-[#263238] border border-[#263238]">
                STANDBY
              </span>
            </div>

            <p className="text-xs text-[#37474f] font-medium leading-relaxed">
              Health insights will appear after assessment data is recorded.
            </p>

            <div className="mt-3 pt-2.5 border-t border-[#263238] flex items-center justify-between">
              <div className="flex items-center gap-1 text-[10px] text-[#37474f] font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-[#263238]" />
                <span>Protected</span>
              </div>

              {onOpenAiChat && (
                <button
                  type="button"
                  onClick={onOpenAiChat}
                  className="text-xs font-bold text-[#263238] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Open AI</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
