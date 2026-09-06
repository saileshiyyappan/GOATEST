/**
 * GOATEST Schedule Assessment Modal
 * 
 * Configures real assessment timetable slots.
 */

import React, { useState } from 'react';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Calendar, Clock, Target, Plus, Check } from 'lucide-react';
import { scheduleService } from '../../services/scheduleService';
import { useToast } from '../../context/ToastContext';

export interface ScheduleAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onScheduleCreated: () => void;
}

const ORGAN_OPTIONS = [
  'General Vital Scan',
  'Cardiovascular System',
  'Respiratory System',
  'Nervous System',
  'Digestive System',
  'Hepatic System',
];

const WheelPicker: React.FC<{ label: string; value: string; values: string[]; onChange: (value: string) => void }> = ({ label, value, values, onChange }) => {
  const index = Math.max(0, values.indexOf(value));
  const move = (delta: number) => onChange(values[(index + delta + values.length) % values.length]);
  const touchStart = React.useRef<number | null>(null);
  return <div className="flex flex-col gap-1"><span className="text-[10px] font-semibold text-[#455a64]">{label}</span><div className="flex items-center justify-center gap-1 rounded-xl border border-[#263238] bg-[#78909c] px-1 py-1.5 select-none" onWheel={(event) => { event.preventDefault(); move(event.deltaY > 0 ? 1 : -1); }} onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientY ?? null; }} onTouchEnd={(event) => { if (touchStart.current === null) return; const delta = (event.changedTouches[0]?.clientY ?? touchStart.current) - touchStart.current; if (Math.abs(delta) > 12) move(delta < 0 ? 1 : -1); touchStart.current = null; }}><button type="button" aria-label={`Previous ${label}`} onClick={() => move(-1)} className="px-1.5 text-[#263238]">‹</button><span className="min-w-8 text-center text-sm font-bold text-[#263238]">{value}</span><button type="button" aria-label={`Next ${label}`} onClick={() => move(1)} className="px-1.5 text-[#263238]">›</button></div></div>;
};

export const ScheduleAssessmentModal: React.FC<ScheduleAssessmentModalProps> = ({
  isOpen,
  onClose,
  userId,
  onScheduleCreated,
}) => {
  const { addToast } = useToast();
  const [title, setTitle] = useState<string>('Routine Organ Assessment');
  const [hour, setHour] = useState<string>('08');
  const [minute, setMinute] = useState<string>('00');
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM');
  const [organTarget, setOrganTarget] = useState<string>('General Vital Scan');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const numericHour = Number(hour);
    const numericMinute = Number(minute);
    if (!/^\d{2}$/.test(hour) || numericHour < 1 || numericHour > 12 || !/^\d{2}$/.test(minute) || numericMinute > 59) {
      addToast({ title: 'Invalid Time', description: 'Enter a valid 12-hour time between 01:00 and 12:59.', type: 'error' });
      return;
    }

    const time = `${hour}:${minute} ${period}`;

    setIsSubmitting(true);
    try {
      await scheduleService.createScheduleItem(userId, {
        title: title.trim(),
        time,
        organTarget,
      });

      addToast({
        title: 'Assessment Scheduled',
        description: `Scheduled "${title}" at ${time}.`,
        type: 'success',
      });

      onScheduleCreated();
      onClose();
    } catch (err: unknown) {
      addToast({
        title: 'Scheduling Failed',
        description: err instanceof Error ? err.message : 'Could not save schedule slot.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="SCHEDULE ASSESSMENT"
      description="Add a daily assessment window to your timetable"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 py-1 text-left">
        <Input
          label="Assessment Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Morning Vital Check"
          required
        />

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-[#263238]">
            Target Time Slot
          </label>
          <div className="grid grid-cols-3 gap-1.5"><WheelPicker label="Hour" value={hour} values={Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'))} onChange={setHour} /><WheelPicker label="Minute" value={minute} values={Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'))} onChange={setMinute} /><WheelPicker label="Period" value={period} values={['AM', 'PM']} onChange={(value) => setPeriod(value as 'AM' | 'PM')} /></div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-[#263238]">
            Target Organ System
          </label>
          <select
            value={organTarget}
            onChange={(e) => setOrganTarget(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border border-[#263238] bg-[#78909c] text-xs font-semibold text-[#263238] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          >
            {ORGAN_OPTIONS.map((opt) => (
              <option key={opt} value={opt} className="bg-[#90a4ae] text-[#263238]">
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div className="pt-2 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="bg-[#78909c] text-[#263238] border-[#263238]">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            className="bg-[#263238] text-white hover:bg-[#1f292e] border border-[#263238]"
          >
            Save Slot
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
