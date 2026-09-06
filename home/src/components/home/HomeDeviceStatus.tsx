/**
 * GOATEST Home Device Status Component
 * 
 * Real device state: CONNECTED, DISCONNECTED, CONNECTING, NOT_AVAILABLE.
 * ZERO fake BLE telemetries or synthetic readings.
 * Full universal theme contrast adaptation.
 */

import React from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Bluetooth } from 'lucide-react';
import type { DeviceInfo } from '../../types';

export interface HomeDeviceStatusProps {
  deviceInfo: DeviceInfo;
  onOpenDeviceModal: () => void;
}

export const HomeDeviceStatus: React.FC<HomeDeviceStatusProps> = ({
  deviceInfo,
  onOpenDeviceModal,
}) => {
  const isConnected = deviceInfo.connected && deviceInfo.status === 'CONNECTED';
  const isConnecting = deviceInfo.status === 'CONNECTING';
  const isNotAvailable = deviceInfo.status === 'NOT_AVAILABLE';

  return (
    <Card
      padding="sm"
      className="flex items-center justify-between shadow-xs bg-[#90a4ae] text-[#263238] border border-[#263238]"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors border border-[#263238] ${
            isConnected
              ? 'bg-emerald-800 text-emerald-100'
              : isConnecting
              ? 'bg-amber-800 text-amber-100 animate-pulse'
              : 'bg-[#78909c] text-[#263238]'
          }`}
        >
          <Bluetooth className="w-4 h-4" />
        </div>

        <div className="min-w-0 text-left">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-[#263238] truncate">
              {isConnected
                ? deviceInfo.deviceName || 'Connected Sensor'
                : isConnecting
                ? 'Connecting to Sensor...'
                : 'Device not connected'}
            </span>
            {isConnected && (
              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-800 text-emerald-100 border border-emerald-950">
                ACTIVE
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#37474f] font-medium truncate">
            {isConnected
              ? 'Ready for physiological assessment'
              : isNotAvailable
              ? 'Bluetooth unavailable'
              : 'Tap to pair device'}
          </p>
        </div>
      </div>

      <Button
        variant={isConnected ? 'outline' : 'primary'}
        size="sm"
        onClick={onOpenDeviceModal}
        className="shrink-0 text-xs px-3 h-8 ml-2"
      >
        {isConnected ? 'Details' : 'Connect'}
      </Button>
    </Card>
  );
};
