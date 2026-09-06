import { CMPacket } from '../types/compare';

export function exportCMPacketToCSV(packet: CMPacket): string {
  const headers = [
    'Parameter',
    'Category',
    'PHB_Baseline',
    'SHB_Value',
    'DEV',
    'DeviationDistance',
    'Direction',
    'Cumulative_Boundaries',
    'Matched_Stage',
    'Matched_Boundary',
    'Beyond_Boundary',
    'PHB_Devs',
    'SHB_Devs',
    'Residual_Compare',
    'Compare_Stage',
    'Status',
  ];

  const rows = packet.results.map((r) => [
    `"${r.parameterName}"`,
    r.category,
    r.phbBaseline,
    r.shbValue,
    r.deviation,
    r.deviationDistance,
    r.direction,
    `"[${r.cumulativeBoundaries.join(',')}]"`,
    r.matchedStage,
    r.matchedBoundary,
    r.beyondBoundary,
    r.phbDevs,
    r.shbDevs,
    r.compare,
    r.compareStage,
    r.status,
  ]);

  const vectorRow = [
    '# FINAL_ML_VECTOR',
    `"[${packet.mlVector.join(',')}]"`,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    packet.isAllValid ? 'ALL_VALID' : 'INVALID',
  ];

  return [headers.join(','), ...rows.map((row) => row.join(',')), vectorRow.join(',')].join('\n');
}

export function downloadCSVFile(csvContent: string, filename = 'band_v1_compare_packet.csv') {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
