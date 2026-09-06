import React from 'react';
import { Wind, Lock, Activity } from 'lucide-react';
import { useShbTheme } from '../../theme/shbTheme';
import { IndirectVitalItem, VitalStatus } from '../../types/shb';

export interface RespiratoryRateCardProps {
  rrItem?: IndirectVitalItem;
  isAcquiring?: boolean;
}

export const RespiratoryRateCard: React.FC<RespiratoryRateCardProps> = ({
  rrItem,
  isAcquiring = false,
}) => {
  const { shb_color, accent } = useShbTheme();

  const liveVal = rrItem?.liveValue ?? rrItem?.value;
  const lockedVal = rrItem?.lockedValue;
  const status: VitalStatus = rrItem?.status || 'WAITING';

  const formatValue = (val: number | string | null | undefined): string => {
    if (val === null || val === undefined || val === '') return '--';
    if (typeof val === 'number') {
      return Number.isInteger(val) ? `${val}.0` : val.toFixed(1);
    }
    return String(val);
  };

  const getStatusBadge = (st: VitalStatus) => {
    switch (st) {
      case 'LOCKED':
        return {
          label: 'LOCKED',
          color: '#10b981',
          bg: 'rgba(16, 185, 129, 0.15)',
          border: 'rgba(16, 185, 129, 0.3)',
        };
      case 'STABLE':
        return {
          label: 'STABLE',
          color: '#34d399',
          bg: 'rgba(52, 211, 153, 0.15)',
          border: 'rgba(52, 211, 153, 0.3)',
        };
      case 'ESTIMATING':
        return {
          label: 'ESTIMATING',
          color: '#60a5fa',
          bg: 'rgba(96, 165, 250, 0.15)',
          border: 'rgba(96, 165, 250, 0.3)',
        };
      case 'ACQUIRING':
        return {
          label: 'ACQUIRING',
          color: '#fbbf24',
          bg: 'rgba(251, 191, 36, 0.15)',
          border: 'rgba(251, 191, 36, 0.3)',
        };
      case 'NOT_AVAILABLE':
        return {
          label: 'NOT AVAILABLE',
          color: '#9ca3af',
          bg: 'rgba(156, 163, 175, 0.1)',
          border: 'rgba(156, 163, 175, 0.2)',
        };
      case 'WAITING':
      default:
        return {
          label: 'WAITING',
          color: shb_color.textMuted,
          bg: shb_color.panel,
          border: shb_color.panelBorder,
        };
    }
  };

  const badge = getStatusBadge(status);
  const isLocked = status === 'LOCKED' && lockedVal !== null && lockedVal !== undefined;
  const isEstimatingOrStable = status === 'ESTIMATING' || status === 'STABLE';
  const hasLive = liveVal !== null && liveVal !== undefined;

  return (
    <div
      id="respiratory-rate-card"
      className="rounded-2xl overflow-hidden transition-colors w-full"
      style={{
        backgroundColor: shb_color.card,
        border: `1px solid ${shb_color.cardBorder}`,
      }}
    >
      {/* Section Header */}
      <div
        className="px-3.5 py-2.5 flex items-center justify-between"
        style={{
          backgroundColor: shb_color.panel,
          borderBottom: `1px solid ${shb_color.panelBorder}`,
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="p-1 rounded-lg"
            style={{
              backgroundColor: shb_color.card,
              border: `1px solid ${shb_color.cardBorder}`,
            }}
          >
            <Wind
              className="w-4 h-4"
              style={{
                color: isLocked ? '#10b981' : isEstimatingOrStable ? '#60a5fa' : accent.primary,
              }}
            />
          </div>
          <div>
            <h3
              className="text-xs font-black tracking-wider uppercase"
              style={{ color: shb_color.textPrimary }}
            >
              RESPIRATORY RATE
            </h3>
            <p className="text-[10px] font-mono" style={{ color: shb_color.textMuted }}>
              PPG SPECTRAL ESTIMATION (RIFV / RIIV / RIAV)
            </p>
          </div>
        </div>

        {/* State Badge */}
        <span
          id="rr-status-badge"
          className="text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider"
          style={{
            backgroundColor: badge.bg,
            color: badge.color,
            border: `1px solid ${badge.border}`,
          }}
        >
          {badge.label}
        </span>
      </div>

      {/* Primary Value Display Grid */}
      <div className="p-3.5 grid grid-cols-2 gap-3">
        {/* Live RR Box */}
        <div
          className="p-3 rounded-xl flex flex-col justify-between"
          style={{
            backgroundColor: shb_color.panel,
            border: `1px solid ${shb_color.panelBorder}`,
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: shb_color.textMuted }}>
              LIVE RR
            </span>
            {isAcquiring && hasLive && (
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: '#60a5fa' }}
              />
            )}
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span
              id="live-rr-value"
              className="text-xl font-mono font-black tracking-tight"
              style={{
                color: hasLive ? (isLocked ? shb_color.textPrimary : '#60a5fa') : shb_color.textMuted,
              }}
            >
              {formatValue(liveVal)}
            </span>
            <span className="text-[10px] font-mono font-semibold" style={{ color: shb_color.textMuted }}>
              breaths/min
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-[9px] font-mono" style={{ color: shb_color.textMuted }}>
            <Activity className="w-3 h-3 text-sky-400/80" />
            <span>0.10–0.50 Hz Band</span>
          </div>
        </div>

        {/* Locked RR Box */}
        <div
          className="p-3 rounded-xl flex flex-col justify-between"
          style={{
            backgroundColor: isLocked ? 'rgba(16, 185, 129, 0.08)' : shb_color.panel,
            border: isLocked ? '1px solid rgba(16, 185, 129, 0.3)' : `1px solid ${shb_color.panelBorder}`,
          }}
        >
          <div className="flex items-center justify-between">
            <span
              className="text-[10px] font-mono uppercase tracking-wider"
              style={{ color: isLocked ? '#10b981' : shb_color.textMuted }}
            >
              LOCKED RR
            </span>
            {isLocked && <Lock className="w-3 h-3 text-emerald-400" />}
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span
              id="locked-rr-value"
              className="text-xl font-mono font-black tracking-tight"
              style={{
                color: isLocked ? '#10b981' : shb_color.textMuted,
              }}
            >
              {formatValue(lockedVal)}
            </span>
            <span className="text-[10px] font-mono font-semibold" style={{ color: isLocked ? '#10b981' : shb_color.textMuted }}>
              breaths/min
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-[9px] font-mono" style={{ color: isLocked ? '#34d399' : shb_color.textMuted }}>
            <span>{isLocked ? 'Robust Averaged Lock' : 'Awaiting Stability'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
