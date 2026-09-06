/**
 * GOATEST In-App PHB Viewer Modal
 * 
 * Complete Read-Only Structured Renderer for Personal Health Baseline (PHB V1 & Extensible).
 * 
 * Renders:
 * - Header & Baseline Status
 * - Timestamps (Generated, Updated)
 * - Account Profile Details
 * - Assessment Scope (Cardiovascular, Respiratory, Neurological, etc.)
 * - DIRECT VITALS (DV): Heart Rate, SpO2, PPI (value, unit, source)
 * - INDIRECT VITALS (IV): RMSSD, SDNN, Respiratory Rate (value, unit, derivation)
 * - CONTEXT VARIABLES (CX): Activity Intensity, Ambient Temperature, Humidity, Pressure, Altitude
 * - DEMOGRAPHIC PROFILE: Age, Sex, BMI, Activity Level, Stress Perception, Altitude, Climate
 * - ENGINE & REFERENCE INFO: Engine, Ruleset, Deviation Model, Datasets
 * - Dynamic Recursive Renderer for any additional or future schema fields
 * - Strictly Read-Only (no inputs, no edit controls)
 * - "Update PHB" button opens external https://phb-web.vercel.app/
 */

import React from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  FileSpreadsheet,
  X,
  Calendar,
  Layers,
  User,
  CheckCircle2,
  AlertCircle,
  FileText,
  ExternalLink,
  RefreshCw,
  Loader2,
  Heart,
  Activity,
  Wind,
  Gauge,
  Compass,
  Cpu,
  ShieldCheck,
  Info,
} from 'lucide-react';
import type { UserPhbRecord } from '../../services/phbService';

export interface PhbDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  phbRecord: UserPhbRecord | null;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onUpdatePhb?: () => void;
}

// Utility: format key name to human-readable label
function formatKeyLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

// Utility: format primitive value
function formatPrimitiveValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') return val.toLocaleString();
  if (typeof val === 'string') {
    // If ISO date string, format nicely
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(val)) {
      try {
        return new Date(val).toLocaleString();
      } catch {
        return val;
      }
    }
    return val;
  }
  return String(val);
}

// Component to render a metric card (value, unit, source)
interface MetricItemProps {
  label: string;
  value: unknown;
  unit?: string;
  source?: string;
  icon?: React.ReactNode;
}

const MetricItem: React.FC<MetricItemProps> = ({ label, value, unit, source, icon }) => {
  // If value is an object with { value, unit, source }
  let displayVal = value;
  let displayUnit = unit;
  let displaySource = source;

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    displayVal = obj.value ?? obj.val ?? obj.reading ?? '';
    displayUnit = (obj.unit as string) || unit;
    displaySource = (obj.source as string) || (obj.derivation as string) || source;
  }

  return (
    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/60 flex flex-col gap-1">
      <div className="flex items-center justify-between gap-1 text-[10px] text-slate-500 dark:text-zinc-400">
        <div className="flex items-center gap-1 font-semibold uppercase tracking-wider">
          {icon}
          <span>{label}</span>
        </div>
        {displaySource && (
          <span className="px-1.5 py-0.2 rounded bg-slate-200 dark:bg-zinc-700 text-[9px] font-mono text-slate-700 dark:text-zinc-300">
            {displaySource}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1 mt-0.5">
        <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">
          {formatPrimitiveValue(displayVal)}
        </span>
        {displayUnit && (
          <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">
            {displayUnit}
          </span>
        )}
      </div>
    </div>
  );
};

// Generic Recursive Section for dynamic/unknown fields
const RecursiveFieldRenderer: React.FC<{ data: unknown; label?: string; depth?: number }> = ({
  data,
  label,
  depth = 0,
}) => {
  if (data === null || data === undefined) return null;

  if (typeof data !== 'object') {
    return (
      <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-zinc-800 last:border-0">
        {label && <span className="text-slate-500 dark:text-zinc-400">{formatKeyLabel(label)}</span>}
        <span className="font-semibold text-slate-900 dark:text-white font-mono">
          {formatPrimitiveValue(data)}
        </span>
      </div>
    );
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return null;
    const isPrimitiveArray = data.every((item) => typeof item !== 'object');
    if (isPrimitiveArray) {
      return (
        <div className="flex flex-col gap-1 py-1.5">
          {label && (
            <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
              {formatKeyLabel(label)}
            </span>
          )}
          <div className="flex flex-wrap gap-1">
            {data.map((item, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-[11px] font-medium text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700/60"
              >
                {String(item)}
              </span>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-1.5 py-1.5">
        {label && (
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
            {formatKeyLabel(label)}
          </span>
        )}
        <div className="flex flex-col gap-1.5 pl-2 border-l border-slate-200 dark:border-zinc-700">
          {data.map((item, idx) => (
            <RecursiveFieldRenderer key={idx} data={item} depth={depth + 1} />
          ))}
        </div>
      </div>
    );
  }

  // Object
  const entries = Object.entries(data as Record<string, unknown>).filter(
    ([, v]) => v !== undefined && v !== null
  );
  if (entries.length === 0) return null;

  return (
    <div className={`flex flex-col gap-1.5 ${depth > 0 ? 'py-1 pl-2 border-l border-slate-200 dark:border-zinc-700' : ''}`}>
      {label && (
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
          {formatKeyLabel(label)}
        </span>
      )}
      <div className="flex flex-col gap-1">
        {entries.map(([k, v]) => (
          <RecursiveFieldRenderer key={k} label={k} data={v} depth={depth + 1} />
        ))}
      </div>
    </div>
  );
};

export const PhbDetailModal: React.FC<PhbDetailModalProps> = ({
  isOpen,
  onClose,
  phbRecord,
  isLoading = false,
  error = null,
  onRetry,
  onUpdatePhb,
}) => {
  if (!isOpen) return null;

  // Extract known canonical fields
  const record = (phbRecord || {}) as Record<string, any>;
  const status = record.status || 'ACTIVE';
  const createdAt = record.createdAt || record.generated || record.created_at;
  const updatedAt = record.updatedAt || record.updated || record.updated_at;
  const baselineFocus = record.baselineFocus || record.focus || [];
  const assessmentScope =
    record.assessmentScope || record.scope || record.assessment_scope || record.scopes;
  const directVitals =
    record.directVitals || record.dv || record.DV || record.direct_vitals;
  const indirectVitals =
    record.indirectVitals || record.iv || record.IV || record.indirect_vitals;
  const contextVariables =
    record.contextVariables || record.cx || record.CX || record.context_variables;
  const demographicProfile =
    record.demographicProfile || record.demographics || record.demographic_profile;
  const engineInfo =
    record.engine || record.engineInfo || record.ruleset || record.referenceInfo || record.model;
  const notes = record.notes || record.clinicalNotes || record.summary;
  const accountInfo = record.account || record.profile;

  // Keys that are already handled specifically in dedicated sections
  const handledKeys = new Set([
    'userId',
    'status',
    'createdAt',
    'updatedAt',
    'generated',
    'updated',
    'created_at',
    'updated_at',
    'baselineFocus',
    'focus',
    'assessmentScope',
    'scope',
    'assessment_scope',
    'scopes',
    'directVitals',
    'dv',
    'DV',
    'direct_vitals',
    'indirectVitals',
    'iv',
    'IV',
    'indirect_vitals',
    'contextVariables',
    'cx',
    'CX',
    'context_variables',
    'demographicProfile',
    'demographics',
    'demographic_profile',
    'engine',
    'engineInfo',
    'ruleset',
    'referenceInfo',
    'model',
    'notes',
    'clinicalNotes',
    'summary',
    'account',
    'profile',
    'url',
  ]);

  const extraKeys = Object.keys(record).filter((k) => !handledKeys.has(k));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs select-none">
      <Card
        padding="none"
        className="w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden shadow-2xl relative animate-in fade-in zoom-in-95 duration-150 border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-accent)]/15 text-[var(--color-accent)] flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Personal Health Baseline
              </h2>
              <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                Deterministic Physiological Baseline (PHB V1)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-left">
          {/* 1. Loading State */}
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="w-7 h-7 text-[var(--color-accent)] animate-spin" />
              <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Retrieving canonical baseline...
              </p>
            </div>
          ) : error ? (
            /* 2. Error State */
            <div className="py-8 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase">
                  Unable to load PHB
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-xs">
                  Could not retrieve baseline records. Please check network connectivity.
                </p>
              </div>
              {onRetry && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onRetry}
                  leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                  className="text-xs mt-2"
                >
                  Retry
                </Button>
              )}
            </div>
          ) : phbRecord ? (
            /* 3. Fully Populated Complete PHB Viewer */
            <div className="space-y-4">
              {/* Status & Timestamp Header Banner */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block text-xs">
                      Baseline Profile
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono">
                      {createdAt ? `Generated: ${new Date(createdAt).toLocaleDateString()}` : 'Active Record'}
                    </span>
                  </div>
                </div>
                <Badge variant="verified" size="sm">
                  {status}
                </Badge>
              </div>

              {/* Account / Demographic Profile */}
              {(accountInfo || demographicProfile || record.ageCategory) && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/60 flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300 font-bold text-[11px]">
                    <User className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                    <span>Demographic Profile</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {demographicProfile && typeof demographicProfile === 'object' ? (
                      Object.entries(demographicProfile).map(([k, v]) => (
                        <div key={k} className="flex flex-col">
                          <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">
                            {formatKeyLabel(k)}
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white font-mono">
                            {formatPrimitiveValue(v)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <>
                        {record.ageCategory && (
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">
                              Classification
                            </span>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {record.ageCategory}
                            </span>
                          </div>
                        )}
                        {accountInfo?.role && (
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">
                              Role
                            </span>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {accountInfo.role}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Assessment Scope */}
              {(assessmentScope || baselineFocus.length > 0) && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300 font-bold text-[11px]">
                    <Layers className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                    <span>Assessment Scope</span>
                  </div>

                  {Array.isArray(assessmentScope) ? (
                    <div className="flex flex-wrap gap-1.5">
                      {assessmentScope.map((scopeItem: any, idx: number) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-[11px] font-medium text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700/60"
                        >
                          {typeof scopeItem === 'string' ? scopeItem : scopeItem.name || scopeItem.domain}
                        </span>
                      ))}
                    </div>
                  ) : typeof assessmentScope === 'object' && assessmentScope !== null ? (
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries(assessmentScope).map(([k, v]) => (
                        <div
                          key={k}
                          className="p-2 rounded-lg bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/60 flex items-center justify-between text-[11px]"
                        >
                          <span className="text-slate-600 dark:text-zinc-400 truncate mr-1">
                            {formatKeyLabel(k)}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white font-mono">
                            {formatPrimitiveValue(v)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : baselineFocus.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {baselineFocus.map((focus: string) => (
                        <span
                          key={focus}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-[11px] font-medium text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700/60"
                        >
                          {focus}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}

              {/* DIRECT VITALS (DV) */}
              {directVitals && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300 font-bold text-[11px]">
                    <Heart className="w-3.5 h-3.5 text-rose-500" />
                    <span>Direct Vitals (DV)</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {typeof directVitals === 'object' && !Array.isArray(directVitals) ? (
                      Object.entries(directVitals).map(([k, v]) => (
                        <MetricItem
                          key={k}
                          label={formatKeyLabel(k)}
                          value={v}
                          icon={<Heart className="w-3 h-3 text-rose-500" />}
                        />
                      ))
                    ) : Array.isArray(directVitals) ? (
                      directVitals.map((dvItem: any, idx: number) => (
                        <MetricItem
                          key={idx}
                          label={dvItem.name || dvItem.metric || `Vital ${idx + 1}`}
                          value={dvItem.value ?? dvItem}
                          unit={dvItem.unit}
                          source={dvItem.source}
                          icon={<Heart className="w-3 h-3 text-rose-500" />}
                        />
                      ))
                    ) : null}
                  </div>
                </div>
              )}

              {/* INDIRECT VITALS (IV) */}
              {indirectVitals && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300 font-bold text-[11px]">
                    <Activity className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Indirect Vitals (IV)</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {typeof indirectVitals === 'object' && !Array.isArray(indirectVitals) ? (
                      Object.entries(indirectVitals).map(([k, v]) => (
                        <MetricItem
                          key={k}
                          label={formatKeyLabel(k)}
                          value={v}
                          icon={<Activity className="w-3 h-3 text-indigo-500" />}
                        />
                      ))
                    ) : Array.isArray(indirectVitals) ? (
                      indirectVitals.map((ivItem: any, idx: number) => (
                        <MetricItem
                          key={idx}
                          label={ivItem.name || ivItem.metric || `Metric ${idx + 1}`}
                          value={ivItem.value ?? ivItem}
                          unit={ivItem.unit}
                          source={ivItem.source || ivItem.derivation}
                          icon={<Activity className="w-3 h-3 text-indigo-500" />}
                        />
                      ))
                    ) : null}
                  </div>
                </div>
              )}

              {/* CONTEXT VARIABLES (CX) */}
              {contextVariables && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300 font-bold text-[11px]">
                    <Compass className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Context Variables (CX)</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {typeof contextVariables === 'object' && !Array.isArray(contextVariables) ? (
                      Object.entries(contextVariables).map(([k, v]) => (
                        <MetricItem
                          key={k}
                          label={formatKeyLabel(k)}
                          value={v}
                          icon={<Gauge className="w-3 h-3 text-emerald-500" />}
                        />
                      ))
                    ) : Array.isArray(contextVariables) ? (
                      contextVariables.map((cxItem: any, idx: number) => (
                        <MetricItem
                          key={idx}
                          label={cxItem.name || cxItem.variable || `Context ${idx + 1}`}
                          value={cxItem.value ?? cxItem}
                          unit={cxItem.unit}
                          source={cxItem.source}
                          icon={<Gauge className="w-3 h-3 text-emerald-500" />}
                        />
                      ))
                    ) : null}
                  </div>
                </div>
              )}

              {/* ENGINE & REFERENCE INFORMATION */}
              {engineInfo && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/60 flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300 font-bold text-[11px]">
                    <Cpu className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                    <span>Engine & Reference Specifications</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    {typeof engineInfo === 'object' ? (
                      Object.entries(engineInfo).map(([k, v]) => (
                        <div
                          key={k}
                          className="flex items-center justify-between py-0.5 text-slate-600 dark:text-zinc-400"
                        >
                          <span>{formatKeyLabel(k)}</span>
                          <span className="font-semibold text-slate-900 dark:text-white font-mono">
                            {formatPrimitiveValue(v)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span className="font-mono text-slate-800 dark:text-zinc-200 font-medium">
                        {String(engineInfo)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Clinical Notes */}
              {notes && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/60 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300 font-bold text-[11px]">
                    <FileText className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                    <span>Baseline Clinical Notes</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-zinc-300 italic leading-relaxed">
                    {notes}
                  </p>
                </div>
              )}

              {/* Dynamic Extra Fields (Extensible for future PHB specifications) */}
              {extraKeys.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/60 flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300 font-bold text-[11px]">
                    <Info className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                    <span>Additional Baseline Telemetries</span>
                  </div>
                  <div className="space-y-1">
                    {extraKeys.map((key) => (
                      <RecursiveFieldRenderer key={key} label={key} data={record[key]} />
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata Footer */}
              <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                <span>Updated: {updatedAt ? new Date(updatedAt).toLocaleDateString() : 'Active'}</span>
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                  <ShieldCheck className="w-3 h-3" />
                  Verified Baseline
                </span>
              </div>
            </div>
          ) : (
            /* 4. Missing / Uncreated Baseline State */
            <div className="py-8 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  PHB Not Created Yet
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-xs leading-relaxed">
                  A Personal Health Baseline has not yet been generated for this account. Generate baseline via the official PHB web portal.
                </p>
              </div>
              {onUpdatePhb && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onUpdatePhb();
                  }}
                  leftIcon={<ExternalLink className="w-3.5 h-3.5" />}
                  className="text-xs mt-2"
                >
                  Generate PHB
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-2 shrink-0 bg-slate-50/50 dark:bg-zinc-900">
          {onUpdatePhb ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onClose();
                onUpdatePhb();
              }}
              leftIcon={<ExternalLink className="w-3.5 h-3.5" />}
              className="text-xs"
            >
              Update PHB
            </Button>
          ) : (
            <div />
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="text-xs"
          >
            Close
          </Button>
        </div>
      </Card>
    </div>
  );
};
