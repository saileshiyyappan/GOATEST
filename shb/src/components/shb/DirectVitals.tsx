import React from 'react';
import { useShbTheme } from '../../theme/shbTheme';
import { DirectVitalItem, OrganCategoryId } from '../../types/shb';
import { getOrganDefinition } from '../../services/organ/organRegistry';

export interface DirectVitalsProps {
  vitals?: Record<string, DirectVitalItem> | DirectVitalItem[];
  organId?: OrganCategoryId;
  isAcquiring?: boolean;
}

export const DirectVitals: React.FC<DirectVitalsProps> = ({
  vitals,
  organId = 'OVERALL',
  isAcquiring = false,
}) => {
  const { shb_color, accent } = useShbTheme();
  const organDef = getOrganDefinition(organId);
  const activeDvKeys = organDef.dvKeys;

  const vitalList: DirectVitalItem[] = React.useMemo(() => {
    if (!vitals) return [];
    
    const dict: Record<string, DirectVitalItem> = Array.isArray(vitals)
      ? vitals.reduce((acc, v) => {
          if (v && v.id) acc[v.id] = v;
          return acc;
        }, {} as Record<string, DirectVitalItem>)
      : vitals;

    const list: DirectVitalItem[] = [];
    for (const key of activeDvKeys) {
      const item = dict[key] || dict[key === 'heartRate' ? 'hr' : key === 'spo2' ? 'spO2' : 'ppi'];
      if (item) {
        list.push(item);
      } else {
        list.push({
          id: key as any,
          label: key === 'heartRate' ? 'Heart Rate' : key === 'spo2' ? 'SpO2 Saturation' : 'Pulse Interval',
          shortCode: key === 'heartRate' ? 'HR' : key === 'spo2' ? 'SpO2' : 'PPI',
          unit: key === 'heartRate' ? 'bpm' : key === 'spo2' ? '%' : 'ms',
          liveValue: null,
          lockedValue: null,
          sampleCount: 0,
          status: 'NOT_AVAILABLE',
        });
      }
    }
    return list;
  }, [vitals, activeDvKeys]);

  if (activeDvKeys.length === 0) {
    return null;
  }

  const formatValue = (val: number | string | null | undefined) => {
    if (val === null || val === undefined || val === '') return '--';
    if (typeof val === 'number') {
      return Number.isInteger(val) ? val.toString() : val.toFixed(1);
    }
    return String(val);
  };

  return (
    <div
      className="rounded-xl overflow-hidden w-full"
      style={{
        backgroundColor: shb_color.card,
        border: `1px solid ${shb_color.cardBorder}`,
      }}
    >
      {/* Section Header */}
      <div
        className="px-3 py-1.5 flex items-center justify-between"
        style={{
          backgroundColor: shb_color.panel,
          borderBottom: `1px solid ${shb_color.panelBorder}`,
        }}
      >
        <span
          className="text-[11px] font-bold uppercase font-mono tracking-wider"
          style={{ color: shb_color.textPrimary }}
        >
          DIRECT VITALS (DV)
        </span>
        <span
          className="text-[9px] font-mono"
          style={{ color: shb_color.textMuted }}
        >
          {vitalList.length} PARAMETERS
        </span>
      </div>

      {/* Column Titles */}
      <div
        className="grid grid-cols-12 px-3 py-1 text-[9px] font-mono uppercase tracking-wider"
        style={{
          backgroundColor: 'rgba(0,0,0,0.15)',
          color: shb_color.textMuted,
          borderBottom: `1px solid ${shb_color.panelBorder}`,
        }}
      >
        <div className="col-span-6">Parameter</div>
        <div className="col-span-3 text-right">Live</div>
        <div className="col-span-3 text-right">Locked</div>
      </div>

      {/* Rows */}
      <div className="divide-y" style={{ borderColor: shb_color.panelBorder }}>
        {vitalList.map((item) => {
          const isLive = item.liveValue !== null && item.liveValue !== undefined;
          const isLocked = item.lockedValue !== null && item.lockedValue !== undefined;

          return (
            <div
              key={item.id}
              className="grid grid-cols-12 items-center px-3 py-2 font-mono text-xs"
            >
              {/* Parameter & Unit */}
              <div className="col-span-6 flex flex-col">
                <span className="font-bold" style={{ color: shb_color.textPrimary }}>
                  {item.label}
                </span>
                <span className="text-[9px]" style={{ color: shb_color.textMuted }}>
                  {item.unit}
                </span>
              </div>

              {/* Live Value */}
              <div
                className="col-span-3 text-right font-bold"
                style={{
                  color: isLive && isAcquiring ? accent.primary : shb_color.textMuted,
                }}
              >
                {formatValue(item.liveValue)}
              </div>

              {/* Locked Value */}
              <div
                className="col-span-3 text-right font-bold"
                style={{
                  color: isLocked ? '#10b981' : shb_color.textMuted,
                }}
              >
                {formatValue(item.lockedValue)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
