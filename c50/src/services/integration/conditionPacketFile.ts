import fs from 'fs';
import path from 'path';

export interface CanonicalCmPacket {
  version: string;
  packetType: string;
  sessionId: string;
  uid: string;
  target: string;
  timestamp: number | string;
  parameters: unknown[];
  validParameterCount: number;
  missingParameters: unknown[];
  missingShbParameters: unknown[];
  missingPhbParameters: unknown[];
  status: string;
  [key: string]: unknown;
}

export function getComparePacketPath(rootDir = process.cwd()): string {
  return path.join(rootDir, 'condition', 'compare.json');
}

export function isCompleteCanonicalCmPacket(value: unknown): value is CanonicalCmPacket {
  if (!value || typeof value !== 'object') return false;
  const packet = value as Partial<CanonicalCmPacket>;
  return packet.version === '2.0.0' &&
    packet.packetType === 'CM_PACKET' &&
    typeof packet.sessionId === 'string' &&
    typeof packet.uid === 'string' &&
    typeof packet.target === 'string' &&
    (typeof packet.timestamp === 'number' || typeof packet.timestamp === 'string') &&
    Array.isArray(packet.parameters) &&
    packet.validParameterCount === 11 &&
    packet.parameters.length === 11 &&
    Array.isArray(packet.missingParameters) && packet.missingParameters.length === 0 &&
    Array.isArray(packet.missingShbParameters) && packet.missingShbParameters.length === 0 &&
    Array.isArray(packet.missingPhbParameters) && packet.missingPhbParameters.length === 0 &&
    packet.status === 'COMPUTED';
}

export function writeCanonicalCmPacket(packet: unknown, rootDir = process.cwd()): string {
  if (!isCompleteCanonicalCmPacket(packet)) {
    throw new Error('Only a complete COMPUTED 11-parameter canonical CM_PACKET can be written');
  }
  const comparePath = getComparePacketPath(rootDir);
  fs.mkdirSync(path.dirname(comparePath), { recursive: true });
  fs.writeFileSync(comparePath, JSON.stringify(packet, null, 2), 'utf-8');
  return comparePath;
}

export function readCanonicalCmPacket(rootDir = process.cwd()): CanonicalCmPacket {
  const comparePath = getComparePacketPath(rootDir);
  const packet = JSON.parse(fs.readFileSync(comparePath, 'utf-8')) as unknown;
  if (!isCompleteCanonicalCmPacket(packet)) {
    throw new Error(`Invalid or incomplete canonical CM_PACKET in ${comparePath}`);
  }
  return packet;
}
