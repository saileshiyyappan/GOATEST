import React from 'react';
import { useShbTheme } from '../../theme/shbTheme';
import { OrganCategoryId } from '../../types/shb';
import { getOrganDefinition } from '../../services/organ/organRegistry';
import { CANONICAL_PARAMETER_DEFINITIONS } from '../../types/physiologicalRegistry';

export interface ContextVariablesProps {
  contextVariables?: {
    activityIntensity?: number | null;
    ambientTemperature?: number | null;
    relativeHumidity?: number | null;
    atmosphericPressure?: number | null;
    altitude?: number | null;
    [key: string]: any;
  } | null;
  lockedContextVariables?: {
    activityIntensity?: number | null;
    ambientTemperature?: number | null;
    relativeHumidity?: number | null;
    atmosphericPressure?: number | null;
    altitude?: number | null;
    [key: string]: any;
  } | null;
  organId?: OrganCategoryId;
  isAcquiring?: boolean;
  isLocked?: boolean;
}

interface CxItemDisplay {
  key: string;
  name: string;
  unit: string;
  liveValue: number | null;
  lockedValue: number | null;
  decimals: number;
}

export const ContextVariables: React.FC<ContextVariablesProps> = ({
  contextVariables,
  lockedContextVariables,
  organId = 'OVERALL',
  isAcquiring = false,
  isLocked = false,
}) => {
  const { shb_color } = useShbTheme();
  const organDef = getOrganDefinition(organId);
  const activeCxKeys = organDef.cxKeys;

  const cxItems: CxItemDisplay[] = React.useMemo(() => {
    return activeCxKeys.map((key) => {
      const def = CANONICAL_PARAMETER_DEFINITIONS[key];
      const liveVal = contextVariables
        ? (contextVariables[key] ??
           (key === 'atmosphericPressure' ? (contextVariables.pressure ?? contextVariables.PRES ?? contextVariables.BARO) : null) ??
           null)
        : null;
      const lockedVal = lockedContextVariables
        ? (lockedContextVariables[key] ??
           (key === 'atmosphericPressure' ? (lockedContextVariables.pressure ?? lockedContextVariables.PRES ?? lockedContextVariables.BARO) : null) ??
            null)
        : isLocked
          ? null
        : null;

      let decimals = 1;
      if (key === 'activityIntensity') decimals = 2;
      else if (key === 'relativeHumidity' || key === 'altitude') decimals = 0;

      return {
        key,
        name: def?.name || key,
        unit: def?.unit || '--',
        liveValue: typeof liveVal === 'number' && Number.isFinite(liveVal) ? (liveVal > 2000 ? +(liveVal / 100).toFixed(1) : liveVal) : null,
        lockedValue: typeof lockedVal === 'number' && Number.isFinite(lockedVal) ? (lockedVal > 2000 ? +(lockedVal / 100).toFixed(1) : lockedVal) : null,
        decimals,
      };
    });
  }, [activeCxKeys, contextVariables, lockedContextVariables, isLocked]);

  if (cxItems.length === 0) {
    return null;
  }

  const formatValue = (val: number | null, decimals: number): string => {
    if (val === null || val === undefined || !Number.isFinite(val)) return '--';
    if (decimals === 0) return Math.round(val).toString();
    return val.toFixed(decimals);
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
          CONTEXT VARIABLES (CX)
        </span>
        <span
          className="text-[9px] font-mono"
          style={{ color: shb_color.textMuted }}
        >
          {cxItems.length} PARAMETERS
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
        {cxItems.map((item) => {
          const isLive = item.liveValue !== null && item.liveValue !== undefined;
          const isLockedVal = item.lockedValue !== null && item.lockedValue !== undefined;

          return (
            <div
              key={item.key}
              className="grid grid-cols-12 items-center px-3 py-2 font-mono text-xs"
            >
              {/* Parameter & Unit */}
              <div className="col-span-6 flex flex-col">
                <span className="font-bold" style={{ color: shb_color.textPrimary }}>
                  {item.name}
                </span>
                <span className="text-[9px]" style={{ color: shb_color.textMuted }}>
                  {item.unit}
                </span>
              </div>

              {/* Live Value */}
              <div
                className="col-span-3 text-right font-bold"
                style={{
                  color: isLive && isAcquiring ? '#38bdf8' : shb_color.textMuted,
                }}
              >
                {formatValue(item.liveValue, item.decimals)}
              </div>

              {/* Locked Value */}
              <div
                className="col-span-3 text-right font-bold"
                style={{
                  color: isLockedVal ? '#38bdf8' : shb_color.textMuted,
                }}
              >
                {formatValue(item.lockedValue, item.decimals)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
