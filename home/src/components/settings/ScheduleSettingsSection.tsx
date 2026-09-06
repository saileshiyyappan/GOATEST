/**
 * GOATEST Scheduled Assessment Section
 * PMT-6 Part 8: Schedule creation, inspection, and Firestore persistence.
 */

import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Dialog } from '../ui/Dialog';
import { useToast } from '../../context/ToastContext';
import { scheduleService } from '../../services/scheduleService';
import type { AssessmentScheduleItem } from '../../types';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Activity,
  CalendarPlus,
} from 'lucide-react';

export interface ScheduleSettingsSectionProps {
  userId: string;
}

const ORGAN_TARGETS = [
  'Full Assessment',
  'Cardiovascular & Heart',
  'Respiratory & Lungs',
  'Neurological / Cognition',
  'Metabolic / Vitals',
  'General Wellness',
];

const WheelPicker: React.FC<{ label: string; value: string; values: string[]; onChange: (value: string) => void }> = ({ label, value, values, onChange }) => {
  const index = Math.max(0, values.indexOf(value));
  const move = (delta: number) => onChange(values[(index + delta + values.length) % values.length]);
  const touchStart = React.useRef<number | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400">{label}</span>
      <div
        className="flex items-center justify-center gap-1 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-1 py-1.5 select-none touch-pan-y"
        onWheel={(event) => { event.preventDefault(); move(event.deltaY > 0 ? 1 : -1); }}
        onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientY ?? null; }}
        onTouchEnd={(event) => { if (touchStart.current === null) return; const delta = (event.changedTouches[0]?.clientY ?? touchStart.current) - touchStart.current; if (Math.abs(delta) > 12) move(delta < 0 ? 1 : -1); touchStart.current = null; }}
      >
        <button type="button" aria-label={`Previous ${label}`} onClick={() => move(-1)} className="px-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white">‹</button>
        <span className="min-w-8 text-center text-sm font-bold text-slate-900 dark:text-zinc-100">{value}</span>
        <button type="button" aria-label={`Next ${label}`} onClick={() => move(1)} className="px-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white">›</button>
      </div>
    </div>
  );
};

export const ScheduleSettingsSection: React.FC<ScheduleSettingsSectionProps> = ({ userId }) => {
  const { addToast } = useToast();
  const [schedules, setSchedules] = useState<AssessmentScheduleItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Dialog state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('Daily Assessment');
  const [hour, setHour] = useState<string>('08');
  const [minute, setMinute] = useState<string>('00');
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM');
  const [scheduledDate, setScheduledDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [organTarget, setOrganTarget] = useState<string>('Full Assessment');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const loadSchedules = async () => {
    if (!userId) return;
    try {
      const list = await scheduleService.getAllSchedules(userId);
      setSchedules(list);
    } catch (err) {
      console.warn('[ScheduleSettings] Error loading:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSchedules();
  }, [userId]);

  const handleOpenAdd = () => {
    setTitle('Daily Assessment');
    setHour('08');
    setMinute('00');
    setPeriod('AM');
    setScheduledDate(new Date().toISOString().split('T')[0]);
    setOrganTarget('Full Assessment');
    setIsModalOpen(true);
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      return;
    }

    const time = `${hour}:${minute} ${period}`;

    setIsSaving(true);
    try {
      await scheduleService.createScheduleItem(userId, {
        title: title.trim(),
        time,
        scheduledDate,
        organTarget,
      });

      await loadSchedules();
      setIsModalOpen(false);
      addToast({
        title: 'Schedule Created',
        description: `Assessment scheduled daily at ${time}.`,
        type: 'success',
      });
    } catch {
      addToast({
        title: 'Error',
        description: 'Could not create assessment schedule.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item: AssessmentScheduleItem) => {
    try {
      await scheduleService.deleteScheduleItem(userId, item.id);
      await loadSchedules();
      addToast({
        title: 'Schedule Removed',
        description: `${item.title} was removed.`,
        type: 'info',
      });
    } catch {
      addToast({
        title: 'Error',
        description: 'Failed to delete schedule item.',
        type: 'error',
      });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-500" />
          <span className="text-xs font-bold text-white uppercase tracking-wide">
            Assessment Schedules ({schedules.length})
          </span>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleOpenAdd}
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          className="text-xs !bg-white hover:!bg-white/90"
        >
          Add Schedule
        </Button>
      </div>

      <Card padding="md" className="flex flex-col gap-3">
        <p className="text-xs text-slate-500 dark:text-zinc-400">
          Configure recurring or one-off health monitoring sessions. Stored in your secure schedule pipeline.
        </p>

        {isLoading ? (
          <div className="py-4 text-center text-xs text-slate-400">Loading schedules...</div>
        ) : schedules.length === 0 ? (
          <div className="py-6 text-center flex flex-col items-center justify-center gap-2 text-slate-400 border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl">
            <CalendarPlus className="w-6 h-6 opacity-30" />
            <p className="text-xs">No assessments currently scheduled.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenAdd}
              className="text-xs mt-1"
            >
              Schedule First Assessment
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {schedules.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 flex items-center justify-between gap-3 text-left"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                        {item.title}
                      </span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                          item.status === 'Completed'
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                            : item.status === 'In Progress'
                            ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300'
                            : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-zinc-400 mt-0.5">
                      <span className="font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {item.time}
                      </span>
                      <span>·</span>
                      <span>{item.scheduledDate}</span>
                      {item.organTarget && (
                        <>
                          <span>·</span>
                          <span className="truncate">{item.organTarget}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(item)}
                  title="Delete schedule"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Schedule Modal */}
      <Dialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Schedule Assessment"
        description="Add an upcoming monitoring session to your timeline."
      >
        <form onSubmit={handleSaveSchedule} className="flex flex-col gap-3 py-2 text-left">
          <Input
            label="Assessment Title"
            placeholder="e.g. Morning Baseline Test"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-2.5">
            <Input
              label="Date"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              required
            />
            <div className="col-span-2 grid grid-cols-3 gap-2">
              <WheelPicker label="Hour" value={hour} values={Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'))} onChange={setHour} />
              <WheelPicker label="Minute" value={minute} values={Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'))} onChange={setMinute} />
              <WheelPicker label="Period" value={period} values={['AM', 'PM']} onChange={(value) => setPeriod(value as 'AM' | 'PM')} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Focus / Target Organ System
            </label>
            <select
              value={organTarget}
              onChange={(e) => setOrganTarget(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-[var(--color-accent)]"
            >
              {ORGAN_TARGETS.map((target) => (
                <option key={target} value={target}>
                  {target}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSaving}
            >
              {isSaving ? 'Scheduling...' : 'Save Schedule'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
