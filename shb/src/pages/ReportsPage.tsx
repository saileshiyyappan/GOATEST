import React from 'react';
import { FileText, Activity, ShieldAlert, ArrowRight } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export interface ReportsPageProps {
  onStartTest: () => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ onStartTest }) => {
  return (
    <div className="p-4 space-y-4 pb-24">
      <div>
        <h2 className="text-xl font-black tracking-tight text-zinc-100">
          CLINICAL REPORTS
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          Archived physiological assessments & biometric logs.
        </p>
      </div>

      {/* Empty State Card */}
      <Card className="text-center py-10 border border-zinc-800 bg-zinc-850/80 space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
          <FileText className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-zinc-200">No Assessment Reports Yet</h3>
          <p className="text-xs text-zinc-400 max-w-xs mx-auto">
            Complete a live SHB sensor assessment to generate your first physiological summary report.
          </p>
        </div>
        <div className="pt-2">
          <Button variant="accent" size="sm" onClick={onStartTest} className="inline-flex items-center gap-1.5 font-bold">
            <Activity className="w-3.5 h-3.5" />
            <span>Launch SHB Assessment</span>
          </Button>
        </div>
      </Card>
    </div>
  );
};
