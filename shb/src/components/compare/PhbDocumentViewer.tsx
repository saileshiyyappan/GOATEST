import React, { useState } from 'react';
import {
  ArrowLeft,
  Copy,
  Check,
  FileJson,
  Activity,
  GitBranch,
  Sliders,
  ShieldCheck,
  User,
  Clock,
  Layers,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useShbTheme } from '../../theme/shbTheme';
import { SynchronizedPhbJson } from '../../types/compare';

export interface PhbDocumentViewerProps {
  phb: SynchronizedPhbJson;
  onBack: () => void;
}

type ViewerTab = 'overview' | 'direct' | 'indirect' | 'deviations' | 'raw';

export const PhbDocumentViewer: React.FC<PhbDocumentViewerProps> = ({ phb, onBack }) => {
  const { shb_color } = useShbTheme();
  const [activeTab, setActiveTab] = useState<ViewerTab>('overview');
  const [copied, setCopied] = useState<boolean>(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    stages: true,
    metadata: true,
  });

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCopyJson = async () => {
    try {
      const jsonStr = JSON.stringify(phb.rawDocument || phb, null, 2);
      await navigator.clipboard.writeText(jsonStr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy PHB JSON:', err);
    }
  };

  const directItems = phb.physiological?.direct || [];
  const indirectItems = phb.physiological?.indirect || [];
  const deviationConfigs = phb.deviationConfiguration || [];

  return (
    <div className="flex flex-col min-h-[85vh] w-full pb-8">
      {/* Header bar */}
      <div className="flex items-center justify-between pt-2 pb-4 border-b border-white/5">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 hover:opacity-80"
          style={{
            backgroundColor: shb_color.panel,
            color: shb_color.textPrimary,
            border: `1px solid ${shb_color.panelBorder}`,
          }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Compare</span>
        </button>

        <button
          onClick={handleCopyJson}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all active:scale-95 hover:opacity-80"
          style={{
            backgroundColor: shb_color.panel,
            color: copied ? '#10b981' : shb_color.textSecondary,
            border: `1px solid ${shb_color.panelBorder}`,
          }}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Copied JSON</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Raw JSON</span>
            </>
          )}
        </button>
      </div>

      {/* Document ID & Status Badge */}
      <div className="mt-3 p-3.5 rounded-2xl border bg-black/20 backdrop-blur-sm space-y-2 border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">
              PHB Document Verified
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            /phbs/{phb.uid?.slice(0, 8)}...
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] font-mono text-zinc-400">
          <div className="flex items-center gap-1.5 truncate">
            <User className="w-3 h-3 text-zinc-500 shrink-0" />
            <span className="truncate">UID: {phb.uid || 'Anonymous'}</span>
          </div>
          <div className="flex items-center gap-1.5 truncate">
            <Clock className="w-3 h-3 text-zinc-500 shrink-0" />
            <span className="truncate">
              Updated: {phb.updatedAt ? new Date(phb.updatedAt).toLocaleDateString() : 'Active'}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 mt-4 p-1 rounded-xl bg-black/30 border border-white/5 overflow-x-auto no-scrollbar">
        {(
          [
            { id: 'overview', label: 'Overview', icon: Layers },
            { id: 'direct', label: `Direct (${directItems.length})`, icon: Activity },
            { id: 'indirect', label: `Indirect (${indirectItems.length})`, icon: GitBranch },
            { id: 'deviations', label: `Deviations (${deviationConfigs.length})`, icon: Sliders },
            { id: 'raw', label: 'Raw JSON', icon: FileJson },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div className="mt-4 flex-1">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-3">
            <div className="p-4 rounded-2xl border bg-black/20 border-white/5 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200 font-mono">
                Baseline Summary
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="text-[10px] text-zinc-400 uppercase font-mono">Direct Parameters</div>
                  <div className="text-lg font-black text-blue-400 mt-1 font-mono">
                    {directItems.length}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">
                    {phb.discoveredDirectKeys?.join(', ') || 'HR, SpO2, PPI, Temp, Accel'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="text-[10px] text-zinc-400 uppercase font-mono">Indirect Parameters</div>
                  <div className="text-lg font-black text-purple-400 mt-1 font-mono">
                    {indirectItems.length}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">
                    {phb.discoveredIndirectKeys?.join(', ') || 'RMSSD, SDNN, CaO2, MAI'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="text-[10px] text-zinc-400 uppercase font-mono">Deviation Models</div>
                  <div className="text-lg font-black text-amber-400 mt-1 font-mono">
                    {deviationConfigs.length}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">5-Stage Adaptive</div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="text-[10px] text-zinc-400 uppercase font-mono">Engine Version</div>
                  <div className="text-sm font-bold text-zinc-300 mt-1 font-mono">
                    {phb.version || phb.engineVersion || 'v1.0-P25'}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">Firestore /phbs/{phb.uid?.slice(0, 6)}</div>
                </div>
              </div>
            </div>

            {/* Quick feature list */}
            <div className="p-4 rounded-2xl border bg-black/20 border-white/5 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono">
                Normalized Baselines
              </h3>
              <div className="space-y-1.5">
                {Array.from(phb.features.entries()).map(([key, feat]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 text-xs font-mono"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                          feat.category === 'DIRECT'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        }`}
                      >
                        {feat.category === 'DIRECT' ? 'DV' : 'IV'}
                      </span>
                      <span className="text-zinc-200 font-semibold">{feat.parameterName}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-emerald-400 font-bold">{feat.phbValue}</span>
                      <span className="text-zinc-500 text-[10px] ml-1">{feat.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* DIRECT VITALS TAB */}
        {activeTab === 'direct' && (
          <div className="space-y-2.5">
            {directItems.length === 0 ? (
              <div className="p-6 text-center text-zinc-500 text-xs font-mono">
                No direct physiological baselines found in PHB.
              </div>
            ) : (
              directItems.map((item, idx) => {
                const val = item.baseline ?? item.value ?? item.val ?? item.reading ?? item.numericValue;
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl border bg-black/20 border-white/5 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-zinc-200 font-mono">
                        {item.name || `Direct Feature #${idx + 1}`}
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5 font-mono">
                        Unit: {item.unit || 'Standard'} • Category: Direct Vital
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-black text-blue-400 font-mono">
                        {typeof val === 'number' ? val : '--'}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono">{item.unit || ''}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* INDIRECT VITALS TAB */}
        {activeTab === 'indirect' && (
          <div className="space-y-2.5">
            {indirectItems.length === 0 ? (
              <div className="p-6 text-center text-zinc-500 text-xs font-mono">
                No indirect physiological baselines found in PHB.
              </div>
            ) : (
              indirectItems.map((item, idx) => {
                const val = item.baseline ?? item.value ?? item.val ?? item.reading ?? item.numericValue;
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl border bg-black/20 border-white/5 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-zinc-200 font-mono">
                        {item.name || `Indirect Feature #${idx + 1}`}
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5 font-mono">
                        Unit: {item.unit || 'Standard'} • Category: Indirect Derived Vital
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-black text-purple-400 font-mono">
                        {typeof val === 'number' ? val : '--'}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono">{item.unit || ''}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* DEVIATION CONFIGURATIONS TAB */}
        {activeTab === 'deviations' && (
          <div className="space-y-3">
            {deviationConfigs.length === 0 ? (
              <div className="p-6 text-center text-zinc-500 text-xs font-mono">
                No custom deviation configurations defined. Default 5-stage models applied.
              </div>
            ) : (
              deviationConfigs.map((cfg, idx) => {
                const isExpanded = expandedSections[`dev_${idx}`] !== false;
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl border bg-black/20 border-white/5 space-y-2.5"
                  >
                    <div
                      onClick={() => toggleSection(`dev_${idx}`)}
                      className="flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-zinc-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-zinc-400" />
                        )}
                        <span className="text-xs font-bold text-zinc-200 font-mono">
                          {cfg.featureName || `Config #${idx + 1}`}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        {cfg.directionality || 'BIDIRECTIONAL'}
                      </span>
                    </div>

                    {isExpanded && (
                      <div className="pt-2 border-t border-white/5 space-y-1.5 text-[11px] font-mono">
                        <div className="flex justify-between text-zinc-400">
                          <span>Comparison Type:</span>
                          <span className="text-zinc-200">{cfg.comparisonType || 'ABSOLUTE'}</span>
                        </div>
                        {cfg.deviationThreshold && (
                          <div className="flex justify-between text-zinc-400">
                            <span>Base Threshold:</span>
                            <span className="text-emerald-400">±{cfg.deviationThreshold}</span>
                          </div>
                        )}
                        {cfg.deviationProfile && (
                          <div className="mt-2 p-2 rounded-xl bg-black/40 border border-white/5">
                            <div className="text-[10px] text-zinc-500 uppercase font-mono mb-1">
                              5-Stage Boundaries (Magnitudes)
                            </div>
                            <pre className="text-[10px] text-zinc-300 overflow-x-auto">
                              {JSON.stringify(cfg.deviationProfile, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* RAW JSON TAB */}
        {activeTab === 'raw' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 px-1">
              <span>Unreduced Document Body (/phbs/{phb.uid})</span>
              <button
                onClick={handleCopyJson}
                className="text-emerald-400 hover:underline flex items-center gap-1"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="p-3.5 rounded-2xl border bg-black/40 border-white/10 overflow-x-auto max-h-[60vh]">
              <pre className="text-[10px] font-mono text-emerald-300 leading-relaxed whitespace-pre-wrap">
                {JSON.stringify(phb.rawDocument || phb, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
