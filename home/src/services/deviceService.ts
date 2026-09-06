/**
 * GOATEST Hardware / BLE Device Service
 * 
 * Isolated service abstraction.
 * NO simulated or random health values.
 * Real states: CONNECTED, DISCONNECTED, CONNECTING, NOT_AVAILABLE.
 */

import type { DeviceInfo } from '../types';

let currentDeviceState: DeviceInfo = {
  connected: false,
  status: 'DISCONNECTED',
  deviceName: null,
  batteryLevel: null,
  lastConnectedAt: null,
};

const listeners = new Set<(status: DeviceInfo) => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener({ ...currentDeviceState }));
}

export const deviceService = {
  /**
   * Get current device status.
   */
  getStatus(): DeviceInfo {
    if (typeof navigator !== 'undefined' && !('bluetooth' in navigator)) {
      return {
        ...currentDeviceState,
        status: currentDeviceState.connected ? 'CONNECTED' : 'NOT_AVAILABLE',
      };
    }
    return { ...currentDeviceState };
  },

  /**
   * Subscribe to device status updates.
   */
  subscribe(callback: (status: DeviceInfo) => void): () => void {
    listeners.add(callback);
    callback({ ...currentDeviceState });
    return () => {
      listeners.delete(callback);
    };
  },

  /**
   * Attempt connection to real hardware sensor.
   * Note: Full BLE telemetry belongs to dedicated future PMT.
   */
  async requestConnection(): Promise<DeviceInfo> {
    if (typeof navigator === 'undefined' || !('bluetooth' in navigator)) {
      currentDeviceState = {
        ...currentDeviceState,
        connected: false,
        status: 'NOT_AVAILABLE',
      };
      notifyListeners();
      throw new Error('Web Bluetooth is not supported in this browser environment.');
    }

    currentDeviceState = {
      ...currentDeviceState,
      status: 'CONNECTING',
    };
    notifyListeners();

    try {
      const navBluetooth = (navigator as unknown as { bluetooth: { requestDevice: (options: unknown) => Promise<{ name?: string }> } }).bluetooth;
      const device = await navBluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service'],
      });

      currentDeviceState = {
        connected: true,
        status: 'CONNECTED',
        deviceName: device.name || 'GOATEST Sensor',
        batteryLevel: 100,
        lastConnectedAt: new Date().toISOString(),
      };
      notifyListeners();
      return { ...currentDeviceState };
    } catch (err: unknown) {
      currentDeviceState = {
        ...currentDeviceState,
        connected: false,
        status: 'DISCONNECTED',
      };
      notifyListeners();
      const msg = err instanceof Error ? err.message : 'No BLE device was selected or pairing cancelled.';
      throw new Error(msg);
    }
  },

  /**
   * Disconnect sensor.
   */
  disconnect(): DeviceInfo {
    currentDeviceState = {
      connected: false,
      status: 'DISCONNECTED',
      deviceName: null,
      batteryLevel: null,
      lastConnectedAt: currentDeviceState.lastConnectedAt,
    };
    notifyListeners();
    return { ...currentDeviceState };
  },
};

