import React, { createContext, useContext, useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import { App } from '@capacitor/app';
import { DeviceConnectionStatus, DeviceInfo, DeviceContextType, BlePacketInfo, DebugLogEntry, DiscoveredBleDevice } from '../types/device';
import { parseSensorPacket, ParsedSensorData } from '../services/vitals/packetParser';
import { PacketReassembler } from '../services/vitals/packetReassembler';
import { Capacitor } from '@capacitor/core';
import { AndroidMbandBleTransport } from '../services/ble/AndroidMbandBleTransport';

export const MBAND_SERVICE_UUID = '12345678-1234-1234-1234-1234567890ab';
export const MBAND_SENSOR_CHAR_UUID = '87654321-4321-4321-4321-ba0987654321';
export const MBAND_COMMAND_CHAR_UUID = '11111111-2222-3333-4444-555555555555';

const BLE_OPTIONAL_SERVICES: (string | number)[] = [
  MBAND_SERVICE_UUID,
  'heart_rate',
  'health_thermometer',
  'battery_service',
  'environmental_sensing',
  'generic_access',
  'generic_attribute',
  'device_information',
  'pulse_oximeter',
];

const MAX_DEBUG_LOGS = 200;

function formatTimeString(ts: number = Date.now()): string {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

const isBrowser = typeof window !== 'undefined' && typeof navigator !== 'undefined';
const isIos = isBrowser && /(iphone|ipad|ipod)/i.test(navigator.userAgent || '');
const isAndroid = isBrowser && /(android)/i.test(navigator.userAgent || '');
const isDesktop = isBrowser && !isIos && !isAndroid;
const hasWebBluetooth = isBrowser && 'bluetooth' in navigator && typeof (navigator as any).bluetooth?.requestDevice === 'function';
const isNativeAndroid = isBrowser && Capacitor.getPlatform() === 'android';
const hasBleTransport = isNativeAndroid || hasWebBluetooth;

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export const DeviceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<DeviceConnectionStatus>(() => (hasBleTransport ? 'DISCONNECTED' : 'NOT_SUPPORTED'));
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [availableDevices, setAvailableDevices] = useState<DiscoveredBleDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<DiscoveredBleDevice | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastRawPacket, setLastRawPacket] = useState<string | null>(null);
  const [lastPacketInfo, setLastPacketInfo] = useState<BlePacketInfo | null>(null);
  const [packetCount, setPacketCount] = useState<number>(0);
  const [packetRateHz, setPacketRateHz] = useState<number>(0);
  const [debugLogs, setDebugLogs] = useState<DebugLogEntry[]>([]);

  const deviceRef = useRef<any>(null);
  const gattServerRef = useRef<any>(null);
  const sensorCharRef = useRef<any>(null);
  const commandCharRef = useRef<any>(null);
  const activeCharacteristicsRef = useRef<any[]>([]);
  const packetListenersRef = useRef<Set<(packet: BlePacketInfo) => void>>(new Set());
  const packetTimestampsRef = useRef<number[]>([]);
  const isConnectingRef = useRef<boolean>(false);
  const isFirstPacketRef = useRef<boolean>(true);
  const reassemblerRef = useRef<PacketReassembler>(new PacketReassembler());
  const reconnectAttemptsRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<any>(null);
  const userInitiatedDisconnectRef = useRef<boolean>(false);
  const handleSensorPacketRef = useRef<((evt: any) => void) | null>(null);
  const nativeTransportRef = useRef<AndroidMbandBleTransport | null>(null);

  const platformInfo = {
    os: (isAndroid ? 'ANDROID' : isIos ? 'IOS' : isDesktop ? 'DESKTOP' : 'UNKNOWN') as 'ANDROID' | 'IOS' | 'DESKTOP' | 'UNKNOWN',
    browser: isBrowser ? (navigator.userAgent.includes('Chrome') ? 'Chrome/Chromium' : navigator.userAgent.includes('Safari') ? 'Safari' : 'Browser') : 'Unknown',
    hasWebBluetooth,
  };

  // Helper to append timestamped debug logs
  const addDebugLog = useCallback((
    tag: DebugLogEntry['tag'],
    level: DebugLogEntry['level'],
    message: string,
    details?: string
  ) => {
    const entry: DebugLogEntry = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      timeString: formatTimeString(),
      tag,
      level,
      message,
      details,
    };
    setDebugLogs((prev) => {
      const next = [...prev, entry];
      if (next.length > MAX_DEBUG_LOGS) {
        return next.slice(next.length - MAX_DEBUG_LOGS);
      }
      return next;
    });
  }, []);

  const clearDebugLogs = useCallback(() => {
    setDebugLogs([]);
  }, []);

  // Check permitted devices on mount
  const refreshPermittedDevices = useCallback(async () => {
    const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
    if (nav && nav.bluetooth && typeof nav.bluetooth.getDevices === 'function') {
      try {
        const devices = await nav.bluetooth.getDevices();
        if (Array.isArray(devices) && devices.length > 0) {
          const mapped: DiscoveredBleDevice[] = devices.map((d: any) => ({
            id: d.id || `ble_${Math.random()}`,
            name: d.name || 'M-BAND',
            device: d,
            isPaired: true,
          }));
          setAvailableDevices((prev) => {
            const list = [...mapped];
            return list;
          });
        }
      } catch {
        // getDevices not allowed in iframe or not granted
      }
    }
  }, []);

  useEffect(() => {
    refreshPermittedDevices();
  }, [refreshPermittedDevices]);

  // Direct packet subscription
  const subscribePacket = useCallback((listener: (packet: BlePacketInfo) => void) => {
    packetListenersRef.current.add(listener);
    return () => {
      packetListenersRef.current.delete(listener);
    };
  }, []);

  // Dispatches a parsed frame to state and listeners
  const dispatchProcessedPacket = useCallback((
    rawStr: string,
    parsed: ParsedSensorData,
    byteLength: number,
    hexString: string,
    charUuid: string
  ) => {
    const timestamp = Date.now();
    const timeStr = formatTimeString(timestamp);
    packetTimestampsRef.current.push(timestamp);

    // Immediate transition to STREAMING upon receiving first notification packet
    if (isFirstPacketRef.current) {
      isFirstPacketRef.current = false;
      addDebugLog('BLE', 'SUCCESS', `PACKET RECEIVED: First packet received from M-BAND (${byteLength} bytes)`);
    }
    setStatus((prev) => (prev !== 'STREAMING' ? 'STREAMING' : prev));

    const isValid = parsed.isValid;
    const packetInfo: BlePacketInfo = {
      id: `pkt_${timestamp}_${Math.random().toString(36).substring(2, 5)}`,
      timestamp,
      timeString: timeStr,
      deviceName: deviceRef.current?.name || 'M-BAND',
      characteristicUuid: charUuid,
      byteLength,
      hexString,
      rawPayload: rawStr,
      status: isValid ? 'PARSED' : parsed.parseErrors.length > 0 ? 'INVALID' : 'RAW',
      errorReason: parsed.parseErrors.length > 0 ? parsed.parseErrors.join('; ') : undefined,
      parsedSummary: parsed.fieldsFound.length > 0 ? parsed.fieldsFound.join(', ') : undefined,
      parsedFields: {
        hr: parsed.heartRate,
        spo2: parsed.spO2,
        ppi: parsed.ppi,
        temp: parsed.skinTemp,
        motion: parsed.motionMagnitude,
        pres: parsed.pressure,
        alt: parsed.altitude,
        hum: parsed.humidity,
        bat: parsed.batteryPercent,
        bfit: parsed.bfitScore,
      },
    };

    setLastRawPacket(rawStr);
    setLastPacketInfo(packetInfo);
    setPacketCount((c) => c + 1);

    if (isValid) {
      addDebugLog(
        'PACKET',
        'PARSED',
        `[PACKET PARSED] ${packetInfo.parsedSummary || 'Telemetry Data'}`,
        `HR=${parsed.heartRate ?? '--'} | SpO2=${parsed.spO2 ?? '--'}% | PPI=${parsed.ppi ?? '--'}ms | TEMP=${parsed.skinTemp ?? '--'}°C | MOTION=${parsed.motionMagnitude ?? '--'}g`
      );
    } else if (parsed.parseErrors.length > 0) {
      addDebugLog(
        'PACKET',
        'INVALID',
        `[PACKET INVALID] ${parsed.parseErrors.join(', ')}`,
        `Payload: ${rawStr}`
      );
    }

    // Forward to all subscribed listeners immediately
    for (const listener of packetListenersRef.current) {
      try {
        listener(packetInfo);
      } catch (err) {
        console.error('Error in packet listener:', err);
      }
    }
  }, [addDebugLog]);

  // Hook reassembler flush callback
  useEffect(() => {
    reassemblerRef.current.setOnFlush((frames: string[]) => {
      for (const frame of frames) {
        const parsed = parseSensorPacket(frame);
        dispatchProcessedPacket(
          frame,
          parsed,
          frame.length,
          Array.from(new TextEncoder().encode(frame)).map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase(),
          MBAND_SENSOR_CHAR_UUID
        );
      }
    });
  }, [dispatchProcessedPacket]);

  // Central BLE notification handler for M-BAND SENSOR characteristic
  const handleSensorPacket = useCallback((event: any) => {
    const char = event.target;
    const value: DataView = char.value;
    if (!value || value.byteLength === 0) return;

    const timestamp = Date.now();
    const timeStr = formatTimeString(timestamp);
    const byteLength = value.byteLength;

    // 1. Extract bytes and hex string
    const bytesArray = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    const hexArr: string[] = [];
    for (let i = 0; i < byteLength; i++) {
      hexArr.push(bytesArray[i].toString(16).padStart(2, '0'));
    }
    const hexString = hexArr.join(' ').toUpperCase();

    // 2. Decode UTF-8 string safely
    let rawPayload = '';
    try {
      const decoder = new TextDecoder('utf-8');
      rawPayload = decoder.decode(value);
    } catch {
      rawPayload = `[Binary: ${hexString}]`;
    }

    // 3. Log raw packet before parsing in development logs
    addDebugLog(
      'BLE RX',
      'BLE_RX',
      `[BLE RX] ${timeStr} | ${byteLength} bytes`,
      `RAW: ${rawPayload.trim()}\nHEX: ${hexString}`
    );

    // 4. Pass through PacketReassembler to handle MTU splits and framed lines
    const completeFrames = reassemblerRef.current.push(rawPayload);

    if (completeFrames.length > 0) {
      for (const frame of completeFrames) {
        const parsed = parseSensorPacket(frame);
        dispatchProcessedPacket(frame, parsed, byteLength, hexString, char.uuid || MBAND_SENSOR_CHAR_UUID);
      }
    } else if (rawPayload.startsWith('[Binary:')) {
      // Direct binary GATT fallback (e.g. 0x2A37)
      const parsed = parseSensorPacket(value);
      dispatchProcessedPacket(rawPayload, parsed, byteLength, hexString, char.uuid || MBAND_SENSOR_CHAR_UUID);
    }
  }, [addDebugLog, dispatchProcessedPacket]);

  // Keep ref synchronized to prevent stale listener closures
  useEffect(() => {
    handleSensorPacketRef.current = handleSensorPacket;
  }, [handleSensorPacket]);

  // Clean disconnect handler
  const handleDisconnect = useCallback(() => {
    addDebugLog('BLE', 'WARN', 'DISCONNECT: M-BAND GATT server disconnected');
    setStatus('DISCONNECTED');
    setPacketRateHz(0);
    isConnectingRef.current = false;
    isFirstPacketRef.current = true;

    // Clean up active characteristic listeners
    for (const char of activeCharacteristicsRef.current) {
      try {
        if (char._customListener) {
          char.removeEventListener('characteristicvaluechanged', char._customListener);
        }
      } catch {
        // ignore
      }
    }
    activeCharacteristicsRef.current = [];
    sensorCharRef.current = null;
    commandCharRef.current = null;
    gattServerRef.current = null;
    reassemblerRef.current.reset();

    // Bounded auto-reconnect if device was paired and disconnect was not user-initiated
    if (!isNativeAndroid && !userInitiatedDisconnectRef.current && deviceRef.current && reconnectAttemptsRef.current < 4) {
      const delayMs = Math.pow(2, reconnectAttemptsRef.current) * 1000; // 1s, 2s, 4s, 8s
      reconnectAttemptsRef.current += 1;
      addDebugLog('BLE', 'INFO', `Scheduling auto-reconnect #${reconnectAttemptsRef.current} in ${delayMs / 1000}s...`);

      reconnectTimeoutRef.current = setTimeout(async () => {
        if (!deviceRef.current || userInitiatedDisconnectRef.current) return;
        try {
          setStatus('CONNECTING');
          addDebugLog('BLE', 'INFO', `GATT_CONNECT: Reconnecting to ${deviceRef.current.name || 'M-BAND'}...`);
          const server = await deviceRef.current.gatt.connect();
          gattServerRef.current = server;

          // Re-discover M-BAND Service & Sensor Characteristic
          addDebugLog('BLE', 'INFO', `SERVICE_DISCOVERY: Discovering service ${MBAND_SERVICE_UUID}...`);
          const service = await server.getPrimaryService(MBAND_SERVICE_UUID);
          addDebugLog('BLE', 'SUCCESS', `SERVICE FOUND: ${MBAND_SERVICE_UUID}`);

          addDebugLog('BLE', 'INFO', `SENSOR_CHARACTERISTIC: Discovering characteristic ${MBAND_SENSOR_CHAR_UUID}...`);
          const sensorChar = await service.getCharacteristic(MBAND_SENSOR_CHAR_UUID);
          addDebugLog('BLE', 'SUCCESS', `SENSOR CHARACTERISTIC FOUND: ${MBAND_SENSOR_CHAR_UUID}`);

          await sensorChar.startNotifications();
          addDebugLog('BLE', 'SUCCESS', 'NOTIFICATIONS STARTED');

          if ((sensorChar as any)._customListener) {
            try {
              sensorChar.removeEventListener('characteristicvaluechanged', (sensorChar as any)._customListener);
            } catch {}
          }

          const listener = (evt: any) => {
            if (handleSensorPacketRef.current) {
              handleSensorPacketRef.current(evt);
            }
          };
          (sensorChar as any)._customListener = listener;
          sensorChar.addEventListener('characteristicvaluechanged', listener);
          sensorCharRef.current = sensorChar;
          activeCharacteristicsRef.current = [sensorChar];

          try {
            commandCharRef.current = await service.getCharacteristic(MBAND_COMMAND_CHAR_UUID);
          } catch {
            // Optional command char
          }

          reconnectAttemptsRef.current = 0;
          setStatus('NOTIFYING');
          addDebugLog('BLE', 'SUCCESS', 'Auto-reconnected and notifications active!');
        } catch (err: any) {
          addDebugLog('BLE', 'WARN', `Auto-reconnect #${reconnectAttemptsRef.current} failed: ${err.message}`);
          setStatus('DISCONNECTED');
          if (reconnectAttemptsRef.current >= 4) {
            addDebugLog('BLE', 'WARN', 'Auto-reconnect limit reached. Click Connect to re-pair.');
          }
        }
      }, delayMs);
    }
  }, [addDebugLog]);

  const handleNativeBluetoothState = useCallback((enabled: boolean) => {
    if (enabled) {
      addDebugLog('BLE', 'INFO', 'NATIVE BLE: Bluetooth enabled');
      setErrorMessage((previous) => previous?.includes('Bluetooth is turned off') ? null : previous);
      setStatus((previous) => previous === 'CONNECTION_FAILED' && !deviceRef.current ? 'DISCONNECTED' : previous);
      return;
    }

    addDebugLog('BLE', 'WARN', 'NATIVE BLE: Bluetooth disabled');
    if (deviceRef.current?.native) handleDisconnect();
    setStatus('CONNECTION_FAILED');
    setErrorMessage('Bluetooth is turned off. Enable Bluetooth and reconnect.');
  }, [addDebugLog, handleDisconnect]);

  const revalidateNativeBluetooth = useCallback(async () => {
    const transport = nativeTransportRef.current;
    if (!isNativeAndroid || !transport?.isInitialized()) return;
    try {
      handleNativeBluetoothState(await transport.isEnabled());
    } catch (error: any) {
      addDebugLog('BLE', 'WARN', `NATIVE BLE: Bluetooth state revalidation failed: ${error?.message || error}`);
    }
  }, [addDebugLog, handleNativeBluetoothState]);

  // Observe foreground/resume without initializing BLE or requesting permission at startup.
  useEffect(() => {
    if (!isNativeAndroid) return;
    let disposed = false;
    let appStateListener: { remove: () => Promise<void> } | null = null;
    void App.addListener('appStateChange', ({ isActive }) => {
      if (isActive && !disposed) void revalidateNativeBluetooth();
    }).then((listener) => {
      if (disposed) void listener.remove();
      else appStateListener = listener;
    });
    return () => {
      disposed = true;
      if (appStateListener) void appStateListener.remove();
    };
  }, [revalidateNativeBluetooth]);

  // Streaming Watchdog & Packet Rate Monitor (runs every 1s)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      // Keep only packet timestamps from the last 2 seconds
      packetTimestampsRef.current = packetTimestampsRef.current.filter((t) => now - t <= 2000);
      const currentHz = packetTimestampsRef.current.length > 0
        ? parseFloat((packetTimestampsRef.current.length / 2).toFixed(1))
        : 0;
      setPacketRateHz(currentHz);

      // State progression: STREAMING only when actual notifications arrive
      if (gattServerRef.current && gattServerRef.current.connected) {
        if (currentHz > 0) {
          setStatus('STREAMING');
        } else if (activeCharacteristicsRef.current.length > 0) {
          setStatus((prev) => (prev === 'STREAMING' ? 'NOTIFYING' : prev));
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const selectDevice = useCallback((dev: DiscoveredBleDevice | null) => {
    setSelectedDevice(dev);
    if (dev) {
      addDebugLog('BLE', 'INFO', `DEVICE_SELECTED: ${dev.name} selected in app`);
      setStatus((prev) => {
        if (prev === 'DISCONNECTED' || prev === 'ERROR' || prev === 'CONNECTION_FAILED') {
          return 'DEVICE_SELECTED';
        }
        return prev;
      });
    } else {
      setStatus((prev) => (prev === 'DEVICE_SELECTED' ? 'DISCONNECTED' : prev));
    }
  }, [addDebugLog]);

  const connect = async (targetDevice?: DiscoveredBleDevice | any) => {
    if (isConnectingRef.current) return;
    if (deviceRef.current?.gatt?.connected && sensorCharRef.current) {
      setStatus((currentStatus) => currentStatus === 'STREAMING' ? currentStatus : 'NOTIFYING');
      addDebugLog('BLE', 'INFO', 'Shared BLE session already connected; reusing existing GATT and notification subscription');
      return;
    }
    isConnectingRef.current = true;
    userInitiatedDisconnectRef.current = false;
    isFirstPacketRef.current = true;
    reconnectAttemptsRef.current = 0;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setErrorMessage(null);

    // 1. Check Web Bluetooth availability
    const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
    if (isNativeAndroid) {
      try {
        setStatus('SCANNING');
        addDebugLog('BLE', 'INFO', 'NATIVE BLE: Initializing Android Nearby Devices transport...');
        const transport = nativeTransportRef.current ?? new AndroidMbandBleTransport({
          serviceUuid: MBAND_SERVICE_UUID,
          sensorCharacteristicUuid: MBAND_SENSOR_CHAR_UUID,
          commandCharacteristicUuid: MBAND_COMMAND_CHAR_UUID,
        });
        nativeTransportRef.current = transport;
        await transport.initialize();
        await transport.startEnabledNotifications(handleNativeBluetoothState);
        if (!(await transport.isEnabled())) {
          const msg = 'Bluetooth is turned off. Enable Bluetooth and try again.';
          setStatus('CONNECTION_FAILED');
          setErrorMessage(msg);
          addDebugLog('BLE', 'ERROR', `NATIVE_BLE_DISABLED: ${msg}`);
          return;
        }
        const chosen = targetDevice?.deviceId ? targetDevice : await transport.requestDevice();
        const devName = chosen.name || 'M-BAND';
        const devId = chosen.deviceId;
        deviceRef.current = { id: devId, name: devName, native: true };
        setSelectedDevice({ id: devId, name: devName, device: chosen, isPaired: true });
        setAvailableDevices((prev) => [{ id: devId, name: devName, device: chosen, isPaired: true }, ...prev.filter((item) => item.id !== devId)]);
        setStatus('DEVICE_SELECTED');
        addDebugLog('BLE', 'SUCCESS', `M-BAND SELECTED: ${devName} (ID: ${devId})`);
        await transport.connect(
          devId,
          () => handleDisconnect(),
          (value) => handleSensorPacketRef.current?.({ target: { value, uuid: MBAND_SENSOR_CHAR_UUID } }),
        );
        setDevice({ id: devId, name: devName, batteryLevel: null, rssi: null, connectedAt: Date.now() });
        setStatus('NOTIFYING');
        addDebugLog('BLE', 'SUCCESS', `NATIVE BLE CONNECTED: ${devName}; notifications active`);
      } catch (err: any) {
        const raw = String(err?.message || err || 'Unknown native BLE failure');
        const msg = /permission|denied|authorized/i.test(raw)
          ? 'Nearby Devices permission was denied. Allow it in Android app settings and try again.'
          : `Native BLE connection failed: ${raw}`;
        setStatus('CONNECTION_FAILED');
        setErrorMessage(msg);
        addDebugLog('BLE', 'ERROR', `NATIVE_BLE_FAILED: ${msg}`);
        throw new Error(msg);
      } finally {
        isConnectingRef.current = false;
      }
      return;
    }

    if (!nav || !nav.bluetooth || typeof nav.bluetooth.requestDevice !== 'function') {
      setStatus('NOT_SUPPORTED');
      const msg = isIos
        ? 'Web Bluetooth is not supported in iOS Safari. Please use a Web Bluetooth-enabled browser like Bluefy.'
        : 'Web Bluetooth is not supported in this browser. Please use Chrome, Edge, or Opera.';
      setErrorMessage(msg);
      addDebugLog('BLE', 'ERROR', `NOT_SUPPORTED: ${msg}`);
      isConnectingRef.current = false;
      return;
    }

    try {
      setStatus('CONNECTING');
      addDebugLog('BLE', 'INFO', 'BLE INITIATING CONNECTION: Requesting M-BAND GATT connection...');

      // Check if we already have a chosen native device handle
      let chosenNativeDevice = targetDevice?.device || selectedDevice?.device || (deviceRef.current?.gatt ? deviceRef.current : null);

      // If no native BluetoothDevice instance is cached or it needs requesting
      if (!chosenNativeDevice || !chosenNativeDevice.gatt) {
        try {
          chosenNativeDevice = await nav.bluetooth.requestDevice({
            filters: [
              { services: [MBAND_SERVICE_UUID] },
              { name: 'M-BAND' },
              { namePrefix: 'M-BAND' },
            ],
            optionalServices: BLE_OPTIONAL_SERVICES,
          });
        } catch (pickerErr: any) {
          if (pickerErr.name === 'NotFoundError' || pickerErr.message?.includes('User cancelled')) {
            setStatus(selectedDevice ? 'DEVICE_SELECTED' : 'DISCONNECTED');
            setErrorMessage(null);
            addDebugLog('BLE', 'INFO', 'DEVICE_SELECTION_CANCELLED: User dismissed BLE picker');
            isConnectingRef.current = false;
            return;
          }

          // Controlled fallback with acceptAllDevices if filtered search isn't supported in browser build
          try {
            addDebugLog('BLE', 'WARN', `Filter request failed (${pickerErr.message}), trying acceptAllDevices fallback...`);
            chosenNativeDevice = await nav.bluetooth.requestDevice({
              acceptAllDevices: true,
              optionalServices: BLE_OPTIONAL_SERVICES,
            });
          } catch (fallbackErr: any) {
            if (fallbackErr.name === 'NotFoundError' || fallbackErr.message?.includes('User cancelled')) {
              setStatus(selectedDevice ? 'DEVICE_SELECTED' : 'DISCONNECTED');
              setErrorMessage(null);
              addDebugLog('BLE', 'INFO', 'DEVICE_SELECTION_CANCELLED: User dismissed BLE picker');
              isConnectingRef.current = false;
              return;
            }
            setStatus('CONNECTION_FAILED');
            setErrorMessage(`Device selection failed: ${fallbackErr.message}`);
            addDebugLog('BLE', 'ERROR', `DEVICE_SELECTION_FAILED: ${fallbackErr.message}`);
            isConnectingRef.current = false;
            return;
          }
        }
      }

      if (!chosenNativeDevice) {
        setStatus('DISCONNECTED');
        addDebugLog('BLE', 'WARN', 'DEVICE_SELECTION_FAILED: No device selected');
        isConnectingRef.current = false;
        return;
      }

      deviceRef.current = chosenNativeDevice;
      const devName = chosenNativeDevice.name || 'M-BAND';
      addDebugLog('BLE', 'SUCCESS', `M-BAND SELECTED: ${devName} (ID: ${chosenNativeDevice.id})`);

      // Update discovered devices list
      setAvailableDevices((prev) => {
        const existing = prev.find((d) => d.id === chosenNativeDevice.id || d.name === devName);
        if (existing) {
          return prev.map((d) => (d === existing ? { ...d, device: chosenNativeDevice, isPaired: true } : d));
        }
        return [{ id: chosenNativeDevice.id || `ble_${Date.now()}`, name: devName, device: chosenNativeDevice, isPaired: true }, ...prev];
      });
      setSelectedDevice({ id: chosenNativeDevice.id || 'm-band', name: devName, device: chosenNativeDevice, isPaired: true });

      // 3. Attach disconnect listener
      chosenNativeDevice.removeEventListener('gattserverdisconnected', handleDisconnect);
      chosenNativeDevice.addEventListener('gattserverdisconnected', handleDisconnect);

      // 4. Connect to GATT Server
      addDebugLog('BLE', 'INFO', 'GATT_CONNECT: Connecting to GATT Server...');
      let server: any = null;
      try {
        server = await chosenNativeDevice.gatt.connect();
        gattServerRef.current = server;
        setDevice({
          id: chosenNativeDevice.id || 'm-band-ble',
          name: devName,
          batteryLevel: null,
          rssi: null,
          connectedAt: Date.now(),
        });
        setStatus('CONNECTED');
        addDebugLog('BLE', 'SUCCESS', `GATT CONNECTED: ${devName}`);
      } catch (gattErr: any) {
        setStatus('CONNECTION_FAILED');
        setErrorMessage(`GATT connect failed: ${gattErr.message}`);
        addDebugLog('BLE', 'ERROR', `GATT_CONNECT_FAILED: ${gattErr.message}`);
        isConnectingRef.current = false;
        return;
      }

      // 5. Discover exact M-BAND Service: 12345678-1234-1234-1234-1234567890AB
      addDebugLog('BLE', 'INFO', `SERVICE_DISCOVERY: Discovering primary service ${MBAND_SERVICE_UUID}...`);
      let mbandService: any = null;
      try {
        mbandService = await server.getPrimaryService(MBAND_SERVICE_UUID);
        addDebugLog('BLE', 'SUCCESS', `SERVICE FOUND: ${MBAND_SERVICE_UUID}`);
      } catch (servErr: any) {
        try {
          const services = await server.getPrimaryServices();
          for (const s of services) {
            if (s.uuid.toLowerCase() === MBAND_SERVICE_UUID.toLowerCase()) {
              mbandService = s;
              break;
            }
          }
        } catch {
          // ignore
        }

        if (mbandService) {
          addDebugLog('BLE', 'SUCCESS', `SERVICE FOUND: ${MBAND_SERVICE_UUID}`);
        } else {
          setStatus('CONNECTION_FAILED');
          setErrorMessage(`Service ${MBAND_SERVICE_UUID} not found`);
          addDebugLog('BLE', 'ERROR', `SERVICE_DISCOVERY_FAILED: M-BAND service ${MBAND_SERVICE_UUID} not found on device`);
          isConnectingRef.current = false;
          return;
        }
      }

      // 6. Discover exact Sensor Characteristic: 87654321-4321-4321-4321-BA0987654321
      addDebugLog('BLE', 'INFO', `SENSOR_CHARACTERISTIC: Discovering characteristic ${MBAND_SENSOR_CHAR_UUID}...`);
      let sensorChar: any = null;
      try {
        sensorChar = await mbandService.getCharacteristic(MBAND_SENSOR_CHAR_UUID);
        addDebugLog('BLE', 'SUCCESS', `SENSOR CHARACTERISTIC FOUND: ${MBAND_SENSOR_CHAR_UUID}`);
      } catch (charErr: any) {
        try {
          const chars = await mbandService.getCharacteristics();
          for (const c of chars) {
            if (c.uuid.toLowerCase() === MBAND_SENSOR_CHAR_UUID.toLowerCase()) {
              sensorChar = c;
              break;
            }
          }
        } catch {
          // ignore
        }

        if (sensorChar) {
          addDebugLog('BLE', 'SUCCESS', `SENSOR CHARACTERISTIC FOUND: ${MBAND_SENSOR_CHAR_UUID}`);
        } else {
          setStatus('CONNECTION_FAILED');
          setErrorMessage(`Sensor characteristic ${MBAND_SENSOR_CHAR_UUID} not found`);
          addDebugLog('BLE', 'ERROR', `CHARACTERISTIC_DISCOVERY_FAILED: Sensor characteristic ${MBAND_SENSOR_CHAR_UUID} not found`);
          isConnectingRef.current = false;
          return;
        }
      }

      sensorCharRef.current = sensorChar;

      // 7. Discover Command Characteristic: 11111111-2222-3333-4444-555555555555 (Optional)
      try {
        const cmdChar = await mbandService.getCharacteristic(MBAND_COMMAND_CHAR_UUID);
        commandCharRef.current = cmdChar;
        addDebugLog('BLE', 'INFO', `COMMAND CHARACTERISTIC FOUND: ${MBAND_COMMAND_CHAR_UUID}`);
      } catch {
        // Optional
      }

      // 8. Start notifications on SENSOR characteristic
      addDebugLog('BLE', 'INFO', `NOTIFICATION_SUBSCRIPTION: Starting notifications on ${MBAND_SENSOR_CHAR_UUID}...`);
      try {
        if ((sensorChar as any)._customListener) {
          try {
            sensorChar.removeEventListener('characteristicvaluechanged', (sensorChar as any)._customListener);
          } catch {}
        }

        await sensorChar.startNotifications();
        addDebugLog('BLE', 'SUCCESS', 'NOTIFICATIONS STARTED');
        addDebugLog('BLE', 'INFO', 'Waiting for M-BAND telemetry packets...');

        const listener = (evt: any) => {
          if (handleSensorPacketRef.current) {
            handleSensorPacketRef.current(evt);
          }
        };
        (sensorChar as any)._customListener = listener;
        sensorChar.addEventListener('characteristicvaluechanged', listener);
        activeCharacteristicsRef.current = [sensorChar];

        setStatus('NOTIFYING');
      } catch (subErr: any) {
        setStatus('CONNECTION_FAILED');
        setErrorMessage(`Failed to start sensor notifications: ${subErr.message}`);
        addDebugLog('BLE', 'ERROR', `NOTIFICATION_SUBSCRIPTION_FAILED: ${subErr.message}`);
        isConnectingRef.current = false;
        return;
      }

    } catch (err: any) {
      if (err.name === 'NotFoundError' || err.message?.includes('User cancelled')) {
        setStatus(selectedDevice ? 'DEVICE_SELECTED' : 'DISCONNECTED');
        setErrorMessage(null);
        addDebugLog('BLE', 'INFO', 'User dismissed BLE picker');
      } else if (err.name === 'SecurityError' || err.message?.includes('Permissions-Policy') || err.message?.includes('policy')) {
        setStatus('CONNECTION_FAILED');
        setErrorMessage('Web Bluetooth blocked by preview permissions policy. Open in a new tab to grant Bluetooth permission.');
        addDebugLog('BLE', 'ERROR', 'SecurityError: Web Bluetooth blocked by iframe permissions policy');
      } else {
        setStatus('CONNECTION_FAILED');
        setErrorMessage(`Connection error: ${err.message || 'Unknown failure'}`);
        addDebugLog('BLE', 'ERROR', `Connection failed: ${err.message}`);
      }
    } finally {
      isConnectingRef.current = false;
    }
  };

  const reconnect = useCallback(async () => {
    addDebugLog('BLE', 'INFO', 'Manual Reconnect requested by user');
    await connect(selectedDevice || (deviceRef.current ? { name: deviceRef.current.name, device: deviceRef.current } : undefined));
  }, [selectedDevice, addDebugLog]);

  const scanDevices = useCallback(async () => {
    setStatus('SCANNING');
    addDebugLog('BLE', 'INFO', 'SCANNING: Discovering available BLE devices...');
    await refreshPermittedDevices();
    await connect();
  }, [refreshPermittedDevices, addDebugLog]);

  const disconnect = useCallback(() => {
    userInitiatedDisconnectRef.current = true;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    reconnectAttemptsRef.current = 0;
    addDebugLog('BLE', 'INFO', 'Disconnect requested by user');

    try {
      if (isNativeAndroid && nativeTransportRef.current) {
        void nativeTransportRef.current.stopNotifications().catch(() => undefined);
        void nativeTransportRef.current.disconnect().catch(() => undefined);
      }
      if (deviceRef.current && deviceRef.current.gatt && deviceRef.current.gatt.connected) {
        deviceRef.current.gatt.disconnect();
      }
    } catch {
      // ignore
    }
    handleDisconnect();
    setDevice(null);
    setStatus('DISCONNECTED');
  }, [addDebugLog, handleDisconnect]);

  const sendCommand = useCallback(async (cmd: string | Uint8Array): Promise<boolean> => {
    if (isNativeAndroid && nativeTransportRef.current) {
      try {
        const data = typeof cmd === 'string' ? new TextEncoder().encode(cmd) : cmd;
        await nativeTransportRef.current.write(new DataView(data.buffer, data.byteOffset, data.byteLength));
        addDebugLog('BLE', 'INFO', `Command sent to M-BAND: ${typeof cmd === 'string' ? cmd : '[Binary]'}`);
        return true;
      } catch (err: any) {
        addDebugLog('BLE', 'ERROR', `Failed to send native command: ${err.message}`);
        return false;
      }
    }
    if (!commandCharRef.current) {
      addDebugLog('BLE', 'WARN', 'Command characteristic not available');
      return false;
    }
    try {
      const data = typeof cmd === 'string' ? new TextEncoder().encode(cmd) : cmd;
      if (commandCharRef.current.writeValueWithResponse) {
        await commandCharRef.current.writeValueWithResponse(data);
      } else if (commandCharRef.current.writeValueWithoutResponse) {
        await commandCharRef.current.writeValueWithoutResponse(data);
      } else {
        await commandCharRef.current.writeValue(data);
      }
      addDebugLog('BLE', 'INFO', `Command sent to M-BAND: ${typeof cmd === 'string' ? cmd : '[Binary]'}`);
      return true;
    } catch (err: any) {
      addDebugLog('BLE', 'ERROR', `Failed to send command: ${err.message}`);
      return false;
    }
  }, [addDebugLog]);

  const openAppSettings = useCallback(async () => {
    if (nativeTransportRef.current?.isInitialized()) {
      await nativeTransportRef.current.openAppSettings();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isNativeAndroid && nativeTransportRef.current) {
        void nativeTransportRef.current.stopNotifications().catch(() => undefined);
        void nativeTransportRef.current.stopEnabledNotifications().catch(() => undefined);
        void nativeTransportRef.current.disconnect().catch(() => undefined);
      }
      if (deviceRef.current && deviceRef.current.gatt && deviceRef.current.gatt.connected) {
        try {
          deviceRef.current.gatt.disconnect();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return (
    <DeviceContext.Provider
      value={{
        status,
        device,
        selectedDevice,
        availableDevices,
        errorMessage,
        lastRawPacket,
        lastPacketInfo,
        packetCount,
        packetRateHz,
        debugLogs,
        isBluetoothSupported: hasBleTransport,
        platformInfo,
        addDebugLog,
        clearDebugLogs,
        subscribePacket,
        scanDevices,
        selectDevice,
        connect,
        disconnect,
        reconnect,
        sendCommand,
        openAppSettings,
      }}
    >
      {children}
    </DeviceContext.Provider>
  );
};

export const useDevice = (): DeviceContextType => {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error('useDevice must be used within a DeviceProvider');
  }
  return context;
};
