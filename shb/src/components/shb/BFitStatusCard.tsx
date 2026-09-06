import React from 'react';
import { ShieldAlert, ShieldCheck, Activity, Gauge, Zap, Vibrate } from 'lucide-react';
import { useShbTheme } from '../../theme/shbTheme';
import { BFitStatusDisplay, BFitStatusCode } from '../../types/shb';

export interface BFitStatusCardProps {
  bfitState?: BFitStatusDisplay | null;
}

const DEFAULT_BFIT_STATE: BFitStatusDisplay = {
  status: 'WAITING' as BFitStatusCode,
  confidence: null,
  sensorContact: null,
  motionStability: null,
  interferenceCount: 0,
  message: 'Awaiting sensor stream & baseline stabilization',
  shakeState: null,
  shakeEventCount: 0,
};

export const BFitStatusCard: React.FC<BFitStatusCardProps> = ({
  bfitState,
}) => {
  const { shb_color } = useShbTheme();

  const state = bfitState || DEFAULT_BFIT_STATE;
  const status: BFitStatusCode = state.status || 'WAITING';

  const getStatusBadge = (code: BFitStatusCode) => {
    switch (code) {
      case 'ALLOW':
        return (
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            ALLOW TEST
          </span>
        );
      case 'MID':
        return (
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
            MID SIGNAL
          </span>
        );
      case 'BAD':
        return (
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30">
            INTERFERENCE
          </span>
        );
      case 'NOT_READY':
        return (
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
            NOT READY
          </span>
        );
      case 'WAITING':
      default:
        return (
          <span
            className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: shb_color.panel,
              color: shb_color.textMuted,
              border: `1px solid ${shb_color.panelBorder}`,
            }}
          >
            WAITING
          </span>
        );
    }
  };

  const getStatusIcon = (code: BFitStatusCode) => {
    switch (code) {
      case 'ALLOW':
        return <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />;
      case 'BAD':
        return <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />;
      default:
        return <Activity className="w-3.5 h-3.5" style={{ color: shb_color.textMuted }} />;
    }
  };

  return (
    <div
      className="rounded-xl p-2.5 transition-colors w-full"
      style={{
        backgroundColor: shb_color.card,
        border: `1px solid ${shb_color.cardBorder}`,
      }}
    >
      <div
        className="flex items-center justify-between pb-1.5 mb-2"
        style={{ borderBottom: `1px solid ${shb_color.panelBorder}` }}
      >
        <div className="flex items-center gap-2">
          <div
            className="p-1 rounded-lg flex items-center justify-center"
            style={{
              backgroundColor: shb_color.panel,
              border: `1px solid ${shb_color.panelBorder}`,
            }}
          >
            {getStatusIcon(status)}
          </div>
          <div>
            <span className="text-xs font-black tracking-wider uppercase" style={{ color: shb_color.textPrimary }}>
              Signal Quality
            </span>
          </div>
        </div>
        <div>{getStatusBadge(status)}</div>
      </div>

      {/* Quad-parameter metric monitors: Contact, Stability, Events, Shake */}
      <div className="grid grid-cols-4 gap-1.5 text-center">
        {/* Sensor Contact */}
        <div
          className="p-1.5 rounded-lg"
          style={{
            backgroundColor: shb_color.panel,
            border: `1px solid ${shb_color.panelBorder}`,
          }}
        >
          <div
            className="flex items-center justify-center gap-1 text-[9px] font-semibold uppercase tracking-tight"
            style={{ color: shb_color.textMuted }}
          >
            <Zap className="w-2.5 h-2.5" />
            <span>Contact</span>
          </div>
          <p
            className="text-[11px] font-mono font-bold mt-0.5"
            style={{ color: shb_color.textPrimary }}
          >
            {state.sensorContact === null
              ? 'WAITING'
              : state.sensorContact
              ? 'SOLID'
              : 'POOR'}
          </p>
        </div>

        {/* Motion Stability */}
        <div
          className="p-1.5 rounded-lg"
          style={{
            backgroundColor: shb_color.panel,
            border: `1px solid ${shb_color.panelBorder}`,
          }}
        >
          <div
            className="flex items-center justify-center gap-1 text-[9px] font-semibold uppercase tracking-tight"
            style={{ color: shb_color.textMuted }}
          >
            <Gauge className="w-2.5 h-2.5" />
            <span>Stability</span>
          </div>
          <p
            className="text-[11px] font-mono font-bold mt-0.5"
            style={{ color: shb_color.textPrimary }}
          >
            {state.motionStability === null
              ? 'WAITING'
              : `${Math.round(state.motionStability * 100)}%`}
          </p>
        </div>

        {/* Interference Events */}
        <div
          className="p-1.5 rounded-lg"
          style={{
            backgroundColor: shb_color.panel,
            border: `1px solid ${shb_color.panelBorder}`,
          }}
        >
          <div
            className="flex items-center justify-center gap-1 text-[9px] font-semibold uppercase tracking-tight"
            style={{ color: shb_color.textMuted }}
          >
            <ShieldAlert className="w-2.5 h-2.5" />
            <span>Events</span>
          </div>
          <p
            className={`text-[11px] font-mono font-bold mt-0.5 ${
              (state.interferenceCount || 0) >= 2 ? 'text-rose-400' : ''
            }`}
            style={{
              color: (state.interferenceCount || 0) >= 2 ? '#ef4444' : shb_color.textPrimary,
            }}
          >
            {state.interferenceCount || 0} / 2
          </p>
        </div>

        {/* Shake State */}
        <div
          className="p-1.5 rounded-lg"
          style={{
            backgroundColor: shb_color.panel,
            border: `1px solid ${
              state.shakeState === 1 ? 'rgba(239, 68, 68, 0.4)' : shb_color.panelBorder
            }`,
          }}
        >
          <div
            className="flex items-center justify-center gap-1 text-[9px] font-semibold uppercase tracking-tight"
            style={{ color: state.shakeState === 1 ? '#ef4444' : shb_color.textMuted }}
          >
            <Vibrate className="w-2.5 h-2.5" />
            <span>Shake</span>
          </div>
          <p
            className="text-[11px] font-mono font-bold mt-0.5"
            style={{
              color:
                state.shakeState === 1
                  ? '#ef4444'
                  : state.shakeState === 0
                  ? '#10b981'
                  : shb_color.textMuted,
            }}
          >
            {state.shakeState === null || state.shakeState === undefined
              ? '--'
              : state.shakeState === 1
              ? '1'
              : '0'}
          </p>
        </div>
      </div>
    </div>
  );
};
