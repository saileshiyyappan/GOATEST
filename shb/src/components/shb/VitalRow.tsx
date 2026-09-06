import React from 'react';
import { useShbTheme } from '../../theme/shbTheme';
import { DirectVitalItem, VitalStatus } from '../../types/shb';

export interface VitalRowProps {
  item?: DirectVitalItem;
  label?: string;
  shortCode?: string;
  unit?: string;
  liveValue?: number | string | null;
  lockedValue?: number | string | null;
  status?: VitalStatus;
  normalRange?: string;
  isLast?: boolean;
}

export const VitalRow: React.FC<VitalRowProps> = ({
  item,
  label,
  shortCode,
  unit,
  liveValue,
  lockedValue,
  status,
  isLast = false,
}) => {
  const { shb_color, accent } = useShbTheme();

  // Support both item object or direct props gracefully
  const effLabel = item?.label ?? label ?? '';
  const effShortCode = item?.shortCode ?? shortCode ?? '';
  const effUnit = item?.unit ?? unit ?? '';
  const effLiveValue = item?.liveValue ?? liveValue ?? null;
  const effLockedValue = item?.lockedValue ?? lockedValue ?? null;
  const effStatus: VitalStatus = item?.status ?? status ?? 'WAITING';

  const formatValue = (val: number | string | null | undefined) => {
    if (val === null || val === undefined || val === '') return '--';
    if (typeof val === 'number') {
      return Number.isInteger(val) ? val.toString() : val.toFixed(1);
    }
    return String(val);
  };

  const isLiveAcquiring = effStatus === 'ACQUIRING' || effStatus === 'STABILIZING';
  const isLocked = effStatus === 'LOCKED' && effLockedValue !== null;

  return (
    <div
      className="grid grid-cols-12 items-center py-2.5 px-3.5 transition-colors"
      style={{
        borderBottom: isLast ? 'none' : `1px solid ${shb_color.panelBorder}`,
      }}
    >
      {/* Parameter Column */}
      <div className="col-span-5 flex flex-col">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold tracking-tight" style={{ color: shb_color.textPrimary }}>
            {effLabel}
          </span>
          <span
            className="text-[9px] font-mono px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: shb_color.panel,
              color: shb_color.textMuted,
              border: `1px solid ${shb_color.panelBorder}`,
            }}
          >
            {effShortCode}
          </span>
        </div>
        <span className="text-[10px] font-mono mt-0.5" style={{ color: shb_color.textMuted }}>
          Unit: {effUnit}
        </span>
      </div>

      {/* Live Value Column */}
      <div className="col-span-4 flex items-center gap-1.5">
        <span
          className="font-mono text-xs font-bold tracking-wider"
          style={{
            color: isLiveAcquiring && effLiveValue !== null ? accent.primary : shb_color.textMuted,
          }}
        >
          {formatValue(effLiveValue)}
        </span>
        {isLiveAcquiring && effLiveValue !== null && (
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0"
            style={{ backgroundColor: accent.primary }}
          />
        )}
      </div>

      {/* Locked Value Column */}
      <div className="col-span-3 flex justify-end">
        <span
          className="font-mono text-xs font-black tracking-wider px-2 py-0.5 rounded-md"
          style={{
            backgroundColor: isLocked ? 'rgba(16, 185, 129, 0.15)' : shb_color.panel,
            color: isLocked ? '#10b981' : shb_color.textMuted,
            border: isLocked
              ? '1px solid rgba(16, 185, 129, 0.3)'
              : `1px solid ${shb_color.panelBorder}`,
          }}
        >
          {formatValue(effLockedValue)}
        </span>
      </div>
    </div>
  );
};
