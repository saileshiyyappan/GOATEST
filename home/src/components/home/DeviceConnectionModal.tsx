/**
 * GOATEST Device Connection Modal
 * 
 * Manages Bluetooth link and sensor status.
 * Real state architecture. ZERO simulated physiological readings.
 */

import React, { useState } from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Bluetooth, Radio, Battery, ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react';
import { useDevice } from '../../../../shb/src/context/DeviceContext';
import { useToast } from '../../context/ToastContext';
import type { DeviceInfo } from '../../types';

export interface DeviceConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceInfo: DeviceInfo;
  onStatusChanged: (info: DeviceInfo) => void;
}

export const DeviceConnectionModal: React.FC<DeviceConnectionModalProps> = ({
  isOpen,
  onClose,
  deviceInfo,
  onStatusChanged,
}) => {
  const { addToast } = useToast();
  const { status: bleStatus, device: bleDevice, errorMessage, platformInfo, openAppSettings, connect, disconnect } = useDevice();
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  const isConnected = bleStatus === 'CONNECTED' || bleStatus === 'NOTIFYING' || bleStatus === 'STREAMING';
  const sharedDeviceInfo = {
    ...deviceInfo,
    connected: isConnected,
    status: bleStatus === 'NOT_SUPPORTED' ? 'NOT_AVAILABLE' : bleStatus === 'CONNECTING' ? 'CONNECTING' : isConnected ? 'CONNECTED' : 'DISCONNECTED',
    deviceName: bleDevice?.name || deviceInfo.deviceName,
    batteryLevel: bleDevice?.batteryLevel ?? deviceInfo.batteryLevel,
    lastConnectedAt: bleDevice?.connectedAt ? new Date(bleDevice.connectedAt).toISOString() : deviceInfo.lastConnectedAt,
  } as const;

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await connect();
      const updated = { ...sharedDeviceInfo, connected: true, status: 'CONNECTED' as const };
      onStatusChanged(updated);
      addToast({
        title: 'Sensor Connected',
        description: `Connected to ${updated.deviceName || 'GOATEST Sensor'}.`,
        type: 'success',
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sensor connection failed.';
      addToast({
        title: 'Connection Standby',
        description: msg,
        type: 'info',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    const updated = { ...sharedDeviceInfo, connected: false, status: 'DISCONNECTED' as const };
    onStatusChanged(updated);
    addToast({
      title: 'Sensor Disconnected',
      description: 'Sensor link returned to standby state.',
      type: 'info',
    });
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Sensor & Bluetooth"
      description="Manage device connection"
    >
      <div className="flex flex-col gap-3 py-1 text-left">
        {/* Status Card */}
        <Card padding="md" className="flex flex-col gap-2.5 shadow-xs bg-[#90a4ae] text-[#263238] border border-[#263238]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center border border-[#263238] ${
                  isConnected
                    ? 'bg-emerald-800 text-emerald-100'
                    : 'bg-[#78909c] text-[#263238]'
                }`}
              >
                <Bluetooth className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#263238]">
                  {isConnected ? sharedDeviceInfo.deviceName || 'Connected Sensor' : 'Sensor Disconnected'}
                </h4>
                <p className="text-[10px] text-[#37474f] font-medium">
                  Status: <span className="font-bold text-[#263238]">{sharedDeviceInfo.status}</span>
                </p>
              </div>
            </div>

            {isConnected && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-100 bg-emerald-800 border border-emerald-950 px-2 py-0.5 rounded-md">
                <CheckCircle2 className="w-3 h-3" />
                <span>LINKED</span>
              </span>
            )}
          </div>

          {isConnected && (
            <div className="pt-2 border-t border-[#263238] flex items-center justify-between text-xs text-[#263238]">
              <div className="flex items-center gap-1.5 font-medium">
                <Battery className="w-4 h-4 text-emerald-800" />
                <span>Battery Level: 100%</span>
              </div>
              {sharedDeviceInfo.lastConnectedAt && (
                <span className="text-[10px] text-[#37474f] font-semibold">
                  {new Date(sharedDeviceInfo.lastConnectedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </div>
          )}
        </Card>

        {/* Informative Hardware Boundary Note */}
        <div className="p-2.5 rounded-xl bg-[#78909c] border border-[#263238] flex items-start gap-2.5 text-xs text-[#263238]">
          <Radio className="w-4 h-4 text-[#263238] shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <p className="font-bold text-[#263238]">
              Bluetooth Connection
            </p>
            <p className="mt-0.5 text-[#37474f] font-medium">
              {platformInfo.os === 'ANDROID'
                ? 'Uses Android Nearby Devices permission and the native BLE transport when hardware is active and within range.'
                : 'Pairs using standard browser Bluetooth APIs when hardware is active and within range.'}
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="p-2.5 rounded-xl bg-red-100 border border-red-800 text-xs text-red-900" role="alert">
            {errorMessage}
            {platformInfo.os === 'ANDROID' && /permission|nearby devices/i.test(errorMessage) && openAppSettings && (
              <Button variant="outline" size="sm" className="mt-2 text-red-900 border-red-800" onClick={() => void openAppSettings()}>
                Open Android App Settings
              </Button>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="pt-2 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} className="bg-[#78909c] text-[#263238] border-[#263238]">
            Close
          </Button>

          {isConnected ? (
            <Button variant="danger" size="sm" onClick={handleDisconnect}>
              Disconnect
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              isLoading={isConnecting}
              onClick={handleConnect}
              leftIcon={<Bluetooth className="w-3.5 h-3.5" />}
              className="bg-[#263238] text-white hover:bg-[#1f292e] border border-[#263238]"
            >
              Connect Sensor
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
};
