import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Activity,
  ChevronDown,
  Layers,
  Eye,
  Check,
} from 'lucide-react';
import { useShbTheme } from '../../theme/shbTheme';
import { CmPacket, CmParameterRow, SynchronizedPhbJson } from '../../types/compare';
import { phbCache } from '../../services/compare/phbCache';
import { PhbDocumentViewer } from './PhbDocumentViewer';
import {
  AUTHORITATIVE_ORGAN_REGISTRY,
  getOrganDefinition,
  filterCompareRows,
  OrganDefinition,
} from '../../services/organ/organRegistry';

export interface CompareTableViewProps {
  cmPacket: CmPacket;
  onBack: () => void;
  onProceedToCondition?: () => void | Promise<void>;
  onSelectTargetOrgan?: (organ: string) => void;
  onViewPhb?: () => void;
  phbDocument?: SynchronizedPhbJson | null;
}

export const CompareTableView: React.FC<CompareTableViewProps> = ({
  cmPacket,
  onBack,
  onProceedToCondition,
  onSelectTargetOrgan,
  onViewPhb,
  phbDocument,
}) => {
  const { shb_color } = useShbTheme();
  const [showInternalPhbViewer, setShowInternalPhbViewer] = useState<boolean>(false);
  const [isOrganMenuOpen, setIsOrganMenuOpen] = useState<boolean>(false);
  const organMenuRef = useRef<HTMLDivElement>(null);

  const [isProceedingToCondition, setIsProceedingToCondition] = useState(false);

  const handleProceedToCondition = async () => {
    if (!onProceedToCondition || isProceedingToCondition) return;
    setIsProceedingToCondition(true);
    try {
      await onProceedToCondition();
    } finally {
      setIsProceedingToCondition(false);
    }
  };

  // Active Organ selection state
  const [selectedOrganId, setSelectedOrganId] = useState<string>(() => {
    return cmPacket.targetOrgan || cmPacket.target || 'OVERALL';
  });

  const currentOrganDef: OrganDefinition = useMemo(() => {
    return getOrganDefinition(selectedOrganId);
  }, [selectedOrganId]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (organMenuRef.current && !organMenuRef.current.contains(event.target as Node)) {
        setIsOrganMenuOpen(false);
      }
    };
    if (isOrganMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOrganMenuOpen]);

  const activePhb = useMemo(() => {
    if (phbDocument) return phbDocument;
    if (cmPacket.uid && phbCache.hasPhb(cmPacket.uid)) {
      return phbCache.getPhb(cmPacket.uid);
    }
    return phbCache.getPhb();
  }, [phbDocument, cmPacket.uid]);

  const { canonicalRows, shbOnlyRows } = useMemo(() => {
    const allRows = cmPacket.rows || cmPacket.parameters || [];
    const filteredRows = filterCompareRows(allRows, selectedOrganId);

    const canonical = filteredRows.filter((p) => p.status !== 'NO_PHB_REFERENCE');
    const shbOnly = filteredRows.filter((p) => p.status === 'NO_PHB_REFERENCE');

    return {
      canonicalRows: canonical,
      shbOnlyRows: shbOnly,
      totalFilteredCount: filteredRows.length,
    };
  }, [cmPacket, selectedOrganId]);

  const handleSelectOrgan = (organId: string) => {
    setSelectedOrganId(organId);
    setIsOrganMenuOpen(false);
    if (onSelectTargetOrgan) {
      onSelectTargetOrgan(organId);
    }
  };

  const handleOpenPhbViewer = () => {
    if (onViewPhb) {
      onViewPhb();
    } else {
      setShowInternalPhbViewer(true);
    }
  };

  if (showInternalPhbViewer && activePhb) {
    return (
      <PhbDocumentViewer
        phb={activePhb}
        onBack={() => setShowInternalPhbViewer(false)}
      />
    );
  }

  const formatNumber = (val: number | null | undefined, decimals: number = 1): string => {
    if (val === null || val === undefined || !Number.isFinite(val)) return '--';
    if (Number.isInteger(val)) return val.toString();
    return val.toFixed(decimals);
  };

  const formatSigned = (val: number | null | undefined, decimals: number = 1): string => {
    if (val === null || val === undefined || !Number.isFinite(val)) return '--';
    if (val === 0) return '0';
    const formatted = formatNumber(val, decimals);
    if (val > 0) return `+${formatted}`;
    return formatted;
  };

  const renderRow = (row: CmParameterRow) => {
    const paramKey = row.key || row.paramKey || '';
    const isTemp = paramKey === 'ambientTemperature' || paramKey === 'temp' || paramKey === 'skinTemperature';
    const isPpi = paramKey === 'ppi';
    const isActivity = paramKey === 'activityIntensity' || paramKey === 'accel' || paramKey === 'motionVector';
    const isRr = paramKey === 'respiratoryRate' || paramKey === 'rr';
    const decimals = isActivity ? 2 : (isTemp || isPpi || isRr) ? 1 : 0;
    const isComputed = row.status === 'COMPUTED' || row.status === 'VALID';
    const isShbOnly = row.status === 'NO_PHB_REFERENCE' || (row.phbBaseline === null && row.phb === null);
    const paramType = row.type || (row.category === 'DIRECT' ? 'DV' : row.category === 'INDIRECT' ? 'IV' : 'CX');
    const paramName = row.name || row.parameter || paramKey;
    const phbVal = row.phbBaseline ?? row.phb;
    const shbVal = row.shbValue ?? row.shb;
    const devVal = row.deviation ?? row.dev;
    const phbDevsVal = row.phbDevs;
    const shbDevsVal = row.shbDevs ?? row.dev;
    const compareVal = row.compare;

    const stageNum = typeof row.compareStage === 'number' ? row.compareStage : typeof row.matchedStage === 'number' ? row.matchedStage : typeof row.stage === 'number' ? row.stage : null;
    const stageDisplay = stageNum !== null ? `${stageNum}` : (row.stage && row.stage !== 'NONE' ? row.stage : '--');

    const getStageBadgeStyle = () => {
      if (stageNum === null || !isComputed) return 'bg-zinc-800 text-zinc-500 border-zinc-700/50';
      if (stageNum === 0) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      if (stageNum === 1) return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      if (stageNum === 2) return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      if (stageNum === 3) return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      if (stageNum >= 4) return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    };

    const getTypeBadgeStyle = () => {
      if (paramType === 'DV') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      if (paramType === 'IV') return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    };

    return (
      <tr
        key={`${row.secNo}_${paramKey}`}
        className={`transition-colors border-b ${
          isComputed
            ? 'hover:bg-white/[0.02]'
            : isShbOnly
            ? 'opacity-60 bg-white/[0.005]'
            : 'hover:bg-white/[0.01]'
        }`}
        style={{
          color: shb_color.textPrimary,
          borderColor: 'rgba(255, 255, 255, 0.05)',
        }}
      >
        {/* 1. Sec. No. */}
        <td className="py-2.5 px-2 text-center text-zinc-500 text-[10px] font-mono whitespace-nowrap">
          {row.secNo}
        </td>

        {/* 2. Parameter */}
        <td className="py-2.5 px-2 min-w-[110px]">
          <div className="font-semibold text-zinc-200 text-xs leading-tight">
            {paramName}
          </div>
          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{row.unit}</div>
        </td>

        {/* 3. Type (DV, IV, or CX) */}
        <td className="py-2.5 px-2 text-center whitespace-nowrap">
          <span
            className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold border inline-block ${getTypeBadgeStyle()}`}
          >
            {paramType}
          </span>
        </td>

        {/* 4. PHB */}
        <td className="py-2.5 px-2 text-right font-mono text-xs whitespace-nowrap">
          {isShbOnly || phbVal === null || phbVal === undefined ? (
            <span className="text-zinc-600">--</span>
          ) : (
            <span className="text-zinc-300 font-medium">{formatNumber(phbVal, decimals)}</span>
          )}
        </td>

        {/* 5. SHB */}
        <td className="py-2.5 px-2 text-right font-mono text-xs whitespace-nowrap">
          {shbVal !== null && shbVal !== undefined ? (
            <span className="text-zinc-200 font-semibold">{formatNumber(shbVal, decimals)}</span>
          ) : (
            <span className="text-zinc-600">--</span>
          )}
        </td>

        {/* 6. DEV */}
        <td className="py-2.5 px-2 text-right font-mono text-xs font-bold whitespace-nowrap">
          {isComputed && devVal !== null && devVal !== undefined ? (
            <span
              className={
                devVal > 0
                  ? 'text-amber-400'
                  : devVal < 0
                  ? 'text-cyan-400'
                  : 'text-zinc-400'
              }
            >
              {formatSigned(devVal, decimals)}
            </span>
          ) : (
            <span className="text-zinc-600">--</span>
          )}
        </td>

        {/* 7. PHB_DEVS */}
        <td className="py-2.5 px-2 text-right font-mono text-xs text-zinc-400 whitespace-nowrap">
          {isComputed && phbDevsVal !== null && phbDevsVal !== undefined ? (
            formatSigned(phbDevsVal, decimals)
          ) : (
            <span className="text-zinc-600">--</span>
          )}
        </td>

        {/* 8. SHB_DEVS */}
        <td className="py-2.5 px-2 text-right font-mono text-xs text-zinc-300 whitespace-nowrap">
          {isComputed && shbDevsVal !== null && shbDevsVal !== undefined ? (
            formatSigned(shbDevsVal, decimals)
          ) : (
            <span className="text-zinc-600">--</span>
          )}
        </td>

        {/* 9. COMPARE */}
        <td className="py-2.5 px-2 text-right font-mono text-xs font-bold whitespace-nowrap">
          {isComputed && compareVal !== null && compareVal !== undefined ? (
            <span
              className={
                compareVal > 0
                  ? 'text-emerald-400'
                  : compareVal < 0
                  ? 'text-rose-400'
                  : 'text-zinc-300'
              }
            >
              {formatSigned(compareVal, decimals)}
            </span>
          ) : (
            <span className="text-zinc-600">--</span>
          )}
        </td>

        {/* 10. Stage */}
        <td className="py-2.5 px-2 text-center font-mono whitespace-nowrap">
          <span
            className={`text-[9px] font-bold px-1.5 py-0.5 rounded border inline-block ${getStageBadgeStyle()}`}
          >
            {stageDisplay}
          </span>
        </td>
      </tr>
    );
  };

  return (
    <div className="flex flex-col min-h-full w-full pb-6 select-none animate-fadeIn">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between pt-2 pb-3 gap-2">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 hover:opacity-80 shrink-0"
          style={{
            backgroundColor: shb_color.panel,
            color: shb_color.textPrimary,
            border: `1px solid ${shb_color.panelBorder}`,
          }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to SHB</span>
        </button>

        <div className="flex items-center gap-1.5">
          {/* View PHB Button */}
          {activePhb && (
            <button
              onClick={handleOpenPhbViewer}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 shadow-sm"
              style={{
                backgroundColor: shb_color.panel,
                color: shb_color.accent,
                border: `1px solid ${shb_color.panelBorder}`,
              }}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>View PHB</span>
            </button>
          )}

          <button
            type="button"
            id="shb-compare-next-btn"
            onClick={handleProceedToCondition}
            disabled={!onProceedToCondition || isProceedingToCondition}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all shrink-0"
            style={{
              backgroundColor: onProceedToCondition ? 'rgba(16, 185, 129, 0.14)' : shb_color.panel,
              borderColor: onProceedToCondition ? 'rgba(16, 185, 129, 0.45)' : shb_color.panelBorder,
              color: onProceedToCondition ? '#34d399' : shb_color.textMuted,
              cursor: onProceedToCondition && !isProceedingToCondition ? 'pointer' : 'not-allowed',
              opacity: isProceedingToCondition ? 0.65 : 1,
            }}
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>NEXT &gt;</span>
          </button>
        </div>
      </div>

      {/* Title & Dynamic Metadata Header with Compact ORGAN WISE Dropdown Control */}
      <div
        className="p-3 rounded-2xl border mb-2.5 shadow-sm relative"
        style={{
          backgroundColor: shb_color.card,
          borderColor: shb_color.cardBorder,
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-400" />
              <h1
                className="text-xs font-black tracking-wider uppercase font-mono"
                style={{ color: shb_color.textPrimary }}
              >
                COMPARE TABLE
              </h1>
            </div>
            <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
              Target: <span className="text-zinc-100 font-bold uppercase">{currentOrganDef.name}</span> •{' '}
              <span className="text-emerald-400 font-bold">
                {currentOrganDef.count} Physiological
              </span>
              {shbOnlyRows.length > 0 && (
                <span className="text-zinc-500"> • +{shbOnlyRows.length} SHB-only</span>
              )}
            </p>
          </div>

          {/* Compact ORGAN WISE Menu Control */}
          <div className="relative" ref={organMenuRef}>
            <button
              onClick={() => setIsOrganMenuOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all active:scale-95 border shadow-sm"
              style={{
                backgroundColor: isOrganMenuOpen ? 'rgba(16, 185, 129, 0.2)' : shb_color.panel,
                color: isOrganMenuOpen ? '#34d399' : shb_color.textPrimary,
                borderColor: isOrganMenuOpen ? 'rgba(16, 185, 129, 0.4)' : shb_color.panelBorder,
              }}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-bold">ORGAN WISE</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  isOrganMenuOpen ? 'rotate-180 text-emerald-400' : 'text-zinc-400'
                }`}
              />
            </button>

            {/* Organ Selection Dropdown Menu (All 11 Authoritative Organs) */}
            {isOrganMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 w-60 rounded-2xl border shadow-xl z-50 py-1.5 max-h-72 overflow-y-auto no-scrollbar animate-fadeIn"
                style={{
                  backgroundColor: '#121215',
                  borderColor: 'rgba(255, 255, 255, 0.12)',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.8), 0 8px 10px -6px rgba(0, 0, 0, 0.8)',
                }}
              >
                <div className="px-3 py-1 text-[9px] font-mono uppercase text-zinc-500 font-bold tracking-wider border-b border-zinc-800/80 mb-1">
                  Select Organ View (DV → IV → CX)
                </div>
                {AUTHORITATIVE_ORGAN_REGISTRY.map((organ) => {
                  const isSelected = selectedOrganId.toUpperCase() === organ.id.toUpperCase();
                  return (
                    <button
                      key={organ.id}
                      onClick={() => handleSelectOrgan(organ.id)}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs font-mono transition-colors ${
                        isSelected
                          ? 'bg-emerald-500/15 text-emerald-300 font-bold'
                          : 'text-zinc-300 hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500 w-4">{organ.order}.</span>
                        <span>{organ.displayName}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-zinc-500 font-mono px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800">
                          {organ.count}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comparison Table Container (10 Columns with strict internal horizontal scroll) */}
      <div
        className="rounded-2xl border overflow-hidden shadow-md flex-1 mb-3"
        style={{
          backgroundColor: shb_color.panel,
          borderColor: shb_color.panelBorder,
        }}
      >
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[580px]">
            <thead>
              <tr
                className="border-b text-[9px] uppercase font-mono tracking-wider"
                style={{
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  borderColor: shb_color.panelBorder,
                  color: shb_color.textMuted,
                }}
              >
                <th className="py-2 px-2 text-center w-7">Sec.</th>
                <th className="py-2 px-2">Parameter</th>
                <th className="py-2 px-2 text-center w-10">Type</th>
                <th className="py-2 px-2 text-right">PHB</th>
                <th className="py-2 px-2 text-right">SHB</th>
                <th className="py-2 px-2 text-right font-bold text-zinc-200">DEV</th>
                <th className="py-2 px-2 text-right">PHB_DEVS</th>
                <th className="py-2 px-2 text-right">SHB_DEVS</th>
                <th className="py-2 px-2 text-right font-bold text-emerald-400">COMPARE</th>
                <th className="py-2 px-2 text-center w-11">Stage</th>
              </tr>
            </thead>
            <tbody className="divide-y text-xs font-mono" style={{ borderColor: 'rgba(255, 255, 255, 0.05)' }}>
              {/* 1. Filtered Canonical Physiological Parameters */}
              {canonicalRows.map(renderRow)}

              {/* 2. SHB-Only Parameters Section */}
              {shbOnlyRows.length > 0 && (
                <>
                  <tr
                    className="border-t border-b"
                    style={{
                      backgroundColor: 'rgba(0,0,0,0.4)',
                      borderColor: shb_color.panelBorder,
                    }}
                  >
                    <td
                      colSpan={10}
                      className="py-1.5 px-2 text-[9px] font-mono uppercase tracking-wider text-zinc-500 font-bold"
                    >
                      SHB-ONLY PARAMETERS (NO PHB BASELINE)
                    </td>
                  </tr>
                  {shbOnlyRows.map(renderRow)}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
