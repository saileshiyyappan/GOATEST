import React from 'react';
import { useShbTheme } from '../../theme/shbTheme';
import { IndirectVitalItem, OrganCategoryId } from '../../types/shb';
import { getOrganDefinition } from '../../services/organ/organRegistry';

export interface IndirectVitalsProps {
  vitals?: Record<string, IndirectVitalItem> | IndirectVitalItem[];
  organId?: OrganCategoryId;
  isAcquiring?: boolean;
}

const DEFAULT_RR_ITEM: IndirectVitalItem = {
  id: 'rr',
  label: 'Respiratory Rate',
  shortCode: 'RR',
  unit: 'breaths/min',
  liveValue: null,
  value: null,
  lockedValue: null,
  status: 'WAITING',
};

export const IndirectVitals: React.FC<IndirectVitalsProps> = ({
  vitals,
  organId = 'OVERALL',
  isAcquiring = false,
}) => {
  const { shb_color, accent } = useShbTheme();
  const organDef = getOrganDefinition(organId);
  const activeIvKeys = organDef.ivKeys;

  const vitalList: IndirectVitalItem[] = React.useMemo(() => {
    const dict: Record<string, IndirectVitalItem> = Array.isArray(vitals)
      ? vitals.reduce((acc, v) => {
          if (v && v.id) acc[v.id] = v;
          return acc;
        }, {} as Record<string, IndirectVitalItem>)
      : vitals || {};

    const resolveItem = (key: string): IndirectVitalItem => {
      if (dict[key]) return dict[key];
      if (key === 'rr' || key === 'respiratoryRate' || key === 'resp_rate') {
        return dict['rr'] || dict['respiratoryRate'] || dict['resp_rate'] || DEFAULT_RR_ITEM;
      }
      return {
        id: key as IndirectVitalItem['id'],
        label: key === 'rmssd' ? 'RMSSD' : key === 'sdnn' ? 'SDNN' : key.toUpperCase(),
        shortCode: key === 'rmssd' ? 'RMSSD' : key === 'sdnn' ? 'SDNN' : key.toUpperCase(),
        unit: 'ms',
        liveValue: null,
        value: null,
        lockedValue: null,
        status: 'WAITING',
      };
    };

    return activeIvKeys.map((k) => resolveItem(k === 'respiratoryRate' ? 'rr' : k));
  }, [vitals, activeIvKeys]);

  if (activeIvKeys.length === 0) {
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
          INDIRECT VITALS (IV)
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
                  color: isLive && isAcquiring ? '#a78bfa' : shb_color.textMuted,
                }}
              >
                {formatValue(item.liveValue)}
              </div>

              {/* Locked Value */}
              <div
                className="col-span-3 text-right font-bold"
                style={{
                  color: isLocked ? '#a78bfa' : shb_color.textMuted,
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
