import { BleClient } from '@capacitor-community/bluetooth-le';
import type { BleDevice, BleService } from '@capacitor-community/bluetooth-le';

export interface AndroidMbandBleTransportOptions {
  serviceUuid: string;
  sensorCharacteristicUuid: string;
  commandCharacteristicUuid: string;
}

/** Native Android BLE transport. Packet bytes are passed through unchanged as DataView. */
export class AndroidMbandBleTransport {
  private client = BleClient;
  private deviceId: string | null = null;
  private initialized = false;
  private notificationsActive = false;
  private notificationGeneration = 0;
  private enabledNotificationsActive = false;
  private stopNotificationsPromise: Promise<void> | null = null;
  private readonly options: AndroidMbandBleTransportOptions;

  constructor(options: AndroidMbandBleTransportOptions) {
    this.options = options;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.client.initialize({ androidNeverForLocation: true });
    this.initialized = true;
  }

  private getClient() {
    return this.client;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async isEnabled(): Promise<boolean> {
    return this.getClient().isEnabled();
  }

  async openBluetoothSettings(): Promise<void> {
    await this.getClient().openBluetoothSettings();
  }

  async openAppSettings(): Promise<void> {
    await this.getClient().openAppSettings();
  }

  async startEnabledNotifications(callback: (enabled: boolean) => void): Promise<void> {
    if (this.enabledNotificationsActive) return;
    await this.getClient().startEnabledNotifications(callback);
    this.enabledNotificationsActive = true;
  }

  async stopEnabledNotifications(): Promise<void> {
    if (!this.enabledNotificationsActive) return;
    await this.getClient().stopEnabledNotifications();
    this.enabledNotificationsActive = false;
  }

  async requestDevice(): Promise<BleDevice> {
    return this.getClient().requestDevice({ services: [this.options.serviceUuid] });
  }

  async connect(deviceId: string, onDisconnect: () => void, onPacket: (value: DataView) => void): Promise<BleService[]> {
    const client = this.getClient();
    await this.stopNotifications();
    this.deviceId = deviceId;
    try {
      await client.connect(deviceId, () => {
        void this.stopNotifications().finally(onDisconnect);
      });
      const services = await client.getServices(deviceId);
      const service = services.find((item) => item.uuid.toLowerCase() === this.options.serviceUuid.toLowerCase());
      if (!service) throw new Error(`Service ${this.options.serviceUuid} not found.`);
      const sensor = service.characteristics.find((item) => item.uuid.toLowerCase() === this.options.sensorCharacteristicUuid.toLowerCase());
      if (!sensor) throw new Error(`Sensor characteristic ${this.options.sensorCharacteristicUuid} not found.`);
      const generation = ++this.notificationGeneration;
      await client.startNotifications(deviceId, this.options.serviceUuid, this.options.sensorCharacteristicUuid, (value) => {
        if (generation === this.notificationGeneration && this.notificationsActive) onPacket(value);
      });
      this.notificationsActive = true;
      return services;
    } catch (error) {
      await this.stopNotifications();
      try { await client.disconnect(deviceId); } catch { /* already disconnected */ }
      this.deviceId = null;
      throw error;
    }
  }

  async stopNotifications(): Promise<void> {
    if (this.stopNotificationsPromise) return this.stopNotificationsPromise;
    const deviceId = this.deviceId;
    const shouldStop = this.notificationsActive;
    this.notificationsActive = false;
    this.notificationGeneration += 1;
    if (!deviceId || !shouldStop) return;
    this.stopNotificationsPromise = this.client.stopNotifications(deviceId, this.options.serviceUuid, this.options.sensorCharacteristicUuid)
      .catch(() => undefined)
      .finally(() => { this.stopNotificationsPromise = null; });
    return this.stopNotificationsPromise;
  }

  async disconnect(): Promise<void> {
    if (this.client && this.deviceId) {
      await this.stopNotifications();
      await this.client.disconnect(this.deviceId);
      this.deviceId = null;
    }
  }

  async write(value: DataView, withoutResponse = false): Promise<void> {
    if (!this.deviceId) throw new Error('No native BLE device is connected.');
    const client = this.getClient();
    if (withoutResponse) {
      await client.writeWithoutResponse(this.deviceId, this.options.serviceUuid, this.options.commandCharacteristicUuid, value);
    } else {
      await client.write(this.deviceId, this.options.serviceUuid, this.options.commandCharacteristicUuid, value);
    }
  }
}
