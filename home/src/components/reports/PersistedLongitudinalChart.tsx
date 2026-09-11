import React from 'react';
import type { ReportType } from '../../types';
import type { TestRecord, VisualizationTrendItem } from '../../types';
import { CANONICAL_11_PARAMETERS } from '../../../../c50/src/engine/canonicalParameters';

const aliases: Record<string, string[]> = {
  'Heart Rate': ['heart rate', 'heart_rate', 'hr', 'pulse'], SpO2: ['spo2', 'oxygen saturation', 'oxygen_saturation'], PPI: ['ppi', 'pulse interval'],
  RMSSD: ['rmssd', 'heart rate variability'], SDNN: ['sdnn', 'nn interval std dev', 'nn interval standard deviation'], 'Respiratory Rate': ['respiratory rate', 'respiratory_rate', 'resp rate', 'rr'],
  'Activity Intensity': ['activity intensity', 'activity_intensity', 'activity'], 'Ambient Temperature': ['ambient temperature', 'ambient_temperature', 'temperature', 'temp'],
  'Relative Humidity': ['relative humidity', 'relative_humidity', 'humidity'], 'Atmospheric Pressure': ['atmospheric pressure', 'atmospheric_pressure', 'pressure'], Altitude: ['altitude'],
};
const keyOf = (value: string) => value.replace(/[^a-z0-9]/gi, '').toLowerCase();
const numberOf = (value: unknown): number | null => { const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN; return Number.isFinite(n) ? n : null; };
const measurementKeys = ['shbValue', 'measuredValue', 'measurementValue', 'reading', 'value'];

const findValue = (test: TestRecord, names: string[]): number | null => {
  const wanted = new Set(names.map(keyOf));
  const packet = (test.rawData as Record<string, unknown>).cmPacket;
  if (!packet || typeof packet !== 'object') return null;
  const parameters = (packet as Record<string, unknown>).parameters;
  const rows = Array.isArray(parameters) ? parameters : parameters && typeof parameters === 'object' ? Object.values(parameters as Record<string, unknown>) : [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const item = row as Record<string, unknown>;
    const ids = [item.parameterId, item.id, item.name, item.metric].filter((id): id is string => typeof id === 'string');
    if (!ids.some((id) => wanted.has(keyOf(id)))) continue;
    const value = numberOf(item.shbValue);
    if (value !== null) return value;
  }
  return null;
};
const pointsFor = (tests: TestRecord[]): Array<VisualizationTrendItem & { parameter: string }> => tests.slice().sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).flatMap((test) => CANONICAL_11_PARAMETERS.flatMap((parameter) => {
  const value = findValue(test, aliases[parameter.name] || [parameter.name, parameter.id]);
  if (value === null) return [];
  return [{ timestamp: test.timestamp, label: new Date(test.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }), value, parameter: parameter.name }];
}));

export const PersistedLongitudinalChart: React.FC<{ reportType: Exclude<ReportType, 'TEST'>; sourceTests: TestRecord[] }> = ({ reportType, sourceTests }) => {
  const points = React.useMemo(() => pointsFor(sourceTests), [sourceTests]);
  const parameters = Array.from(new Set(points.map((point) => point.parameter)));
  const [selected, setSelected] = React.useState(parameters[0] || '');
  React.useEffect(() => { if (!parameters.includes(selected)) setSelected(parameters[0] || ''); }, [parameters, selected]);
  const data = points.filter((point) => point.parameter === selected);
  if (data.length === 0) return <div className="text-sm text-slate-500">Insufficient Assessment Visualization Data</div>;
  const width = 760, height = 360, left = 58, right = 24, top = 24, bottom = 62;
  const values = data.map((point) => point.value as number), min = Math.min(...values), max = Math.max(...values), span = max - min || Math.max(Math.abs(max) * 0.1, 1);
  const x = (index: number) => left + index * (width - left - right) / Math.max(data.length - 1, 1);
  const y = (value: number) => top + height - top - bottom - ((value - min) / span) * (height - top - bottom);
  return <div className="flex flex-col gap-3 text-left">
    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{reportType} physiological observations</div>
    <label className="flex items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300"><span className="font-semibold">Parameter</span><select aria-label="Trend parameter" value={selected} onChange={(event) => setSelected(event.target.value)} className="max-w-[240px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs">{parameters.map((parameter) => <option key={parameter}>{parameter}</option>)}</select></label>
    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60"><svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label={`${reportType} ${selected} line graph`}>
      <line x1={left} x2={left} y1={top} y2={height - bottom} stroke="currentColor" opacity=".45" /><line x1={left} x2={width - right} y1={height - bottom} y2={height - bottom} stroke="currentColor" opacity=".45" />
      <text x={left - 8} y={top + 4} textAnchor="end" fontSize="10" fill="currentColor">{max.toFixed(2)}</text><text x={left - 8} y={height - bottom + 4} textAnchor="end" fontSize="10" fill="currentColor">{min.toFixed(2)}</text>
      <polyline fill="none" stroke="#10b981" strokeWidth="3" points={data.map((point, index) => `${x(index)},${y(point.value as number)}`).join(' ')} />
      {data.map((point, index) => <circle key={`${point.timestamp}-${index}`} cx={x(index)} cy={y(point.value as number)} r="4" fill="#10b981"><title>{`${point.label}: ${point.value}`}</title></circle>)}
      {data.map((point, index) => <text key={`label-${point.timestamp}-${index}`} x={x(index)} y={height - 20} textAnchor="end" transform={`rotate(-35 ${x(index)} ${height - 20})`} fontSize="10" fill="currentColor">{point.label}</text>)}
      <text x={width / 2} y={height - 2} textAnchor="middle" fontSize="11" fill="currentColor">X-axis: date/time</text><text x="14" y={height / 2} textAnchor="middle" transform={`rotate(-90 14 ${height / 2})`} fontSize="11" fill="currentColor">Y-axis: {selected}</text>
    </svg></div>
  </div>;
};
