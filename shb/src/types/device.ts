export type DeviceConnectionStatus = 
  | 'DISCONNECTED' 
  | 'SCANNING'
  | 'DEVICE_SELECTED'
  | 'CONNECTING' 
  | 'CONNECTED' 
  | 'NOTIFYING' 
  | 'STREAMING' 
  | 'CONNECTION_FAILED'
  | 'ERROR'
  | 'NOT_SUPPORTED';

export interface DeviceInfo {
  name: string | null;
  id: string | null;
  batteryLevel: number | null;
  rssi: number | null;
  connectedAt: number | null;
}

export interface DiscoveredBleDevice {
  id: string;
  name: string;
  device?: any;
  isPaired?: boolean;
  rssi?: number | null;
}

export interface BlePacketInfo {
  id: string;
  timestamp: number;
  timeString: string;
  deviceName: string;
  characteristicUuid: string;
  byteLength: number;
  hexString: string;
  rawPayload: string;
  parsedSummary?: string;
  parsedFields?: Record<string, any>;
  status: 'RAW' | 'PARSED' | 'INVALID';
  errorReason?: string;
}

export interface DebugLogEntry {
  id: string;
  timestamp: number;
  timeString: string;
  level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' | 'BLE_RX' | 'PARSED' | 'INVALID';
  tag: 'BLE' | 'BLE RX' | 'PACKET' | 'B-FIT' | 'DV' | 'IV' | 'ENGINE';
  message: string;
  details?: string;
}

export interface DeviceContextType {
  status: DeviceConnectionStatus;
  device: DeviceInfo | null;
  selectedDevice: DiscoveredBleDevice | null;
  availableDevices: DiscoveredBleDevice[];
  errorMessage: string | null;
  lastRawPacket: string | null;
  lastPacketInfo: BlePacketInfo | null;
  packetCount: number;
  packetRateHz: number;
  debugLogs: DebugLogEntry[];
  isBluetoothSupported: boolean;
  platformInfo: {
    os: 'ANDROID' | 'IOS' | 'DESKTOP' | 'UNKNOWN';
    browser: string;
    hasWebBluetooth: boolean;
  };
  addDebugLog: (tag: DebugLogEntry['tag'], level: DebugLogEntry['level'], message: string, details?: string) => void;
  clearDebugLogs: () => void;
  subscribePacket: (listener: (packet: BlePacketInfo) => void) => () => void;
  scanDevices: () => Promise<void>;
  openAppSettings?: () => Promise<void>;
  selectDevice: (device: DiscoveredBleDevice | null) => void;
  connect: (targetDevice?: DiscoveredBleDevice | any) => Promise<void>;
  disconnect: () => void;
  reconnect: () => Promise<void>;
  sendCommand?: (cmd: string | Uint8Array) => Promise<boolean>;
}
