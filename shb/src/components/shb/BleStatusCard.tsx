import React, { useState, useRef } from 'react';
import { Bluetooth, Activity, Radio, AlertCircle, ChevronDown } from 'lucide-react';
import { useShbTheme } from '../../theme/shbTheme';
import { useDevice } from '../../context/DeviceContext';
import { BleDeviceDropdown } from './BleDeviceDropdown';

export interface BleStatusCardProps {
  compact?: boolean;
}

export const BleStatusCard: React.FC<BleStatusCardProps> = ({ compact = false }) => {
  const { shb_color, accent } = useShbTheme();
  const {
    status: bleStatus,
    connect,
    disconnect,
    device,
    errorMessage,
    packetCount,
    packetRateHz,
  } = useDevice();

  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isStreaming = bleStatus === 'STREAMING';
  const isNotifying = bleStatus === 'NOTIFYING';
  const isConnected = bleStatus === 'CONNECTED' || isNotifying || isStreaming;
  const isConnecting = bleStatus === 'CONNECTING';
  const isError = bleStatus === 'ERROR';

  const getStatusText = () => {
    if (isStreaming) {
      return `Streaming (${packetRateHz.toFixed(1)} Hz · ${packetCount} pkts)`;
    }
    if (isNotifying) {
      return 'Subscribed (Waiting for telemetry stream...)';
    }
    if (isConnected) {
      return 'Connected (Awaiting notification stream)';
    }
    if (isConnecting) {
      return 'Connecting to peripheral...';
    }
    if (isError) {
      return errorMessage || 'Connection error';
    }
    return 'BLE peripheral not connected';
  };

  const getStatusColor = () => {
    if (isStreaming) return '#10b981'; // Emerald
    if (isNotifying) return '#a78bfa'; // Violet
    if (isConnected) return '#3b82f6'; // Blue
    if (isConnecting) return '#f59e0b'; // Amber
    if (isError) return '#ef4444'; // Rose
    return shb_color.textSecondary;
  };

  return (
    <div
      className={`rounded-xl ${compact ? 'p-2.5' : 'p-3'} transition-all duration-150 w-full relative`}
      style={{
        backgroundColor: shb_color.card,
        border: `1px solid ${isStreaming ? 'rgba(16, 185, 129, 0.35)' : shb_color.cardBorder}`,
      }}
    >
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="p-2 rounded-lg flex items-center justify-center shrink-0 transition-colors"
            style={{
              backgroundColor: isStreaming
                ? 'rgba(16, 185, 129, 0.15)'
                : isConnected
                ? shb_color.accentBgLight
                : shb_color.panel,
            }}
          >
            {isStreaming ? (
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            ) : isError ? (
              <AlertCircle className="w-4 h-4 text-rose-400" />
            ) : (
              <Bluetooth
                className="w-4 h-4"
                style={{ color: isConnected ? accent.primary : shb_color.textSecondary }}
              />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold truncate" style={{ color: shb_color.textPrimary }}>
                {device?.name || 'M-BAND Peripheral'}
              </h4>
              {isStreaming && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
              )}
            </div>
            <p
              className="text-[11px] font-mono mt-0.5 truncate font-medium"
              style={{ color: getStatusColor() }}
            >
              {getStatusText()}
            </p>
          </div>
        </div>

        <div className="shrink-0 relative">
          <button
            ref={buttonRef}
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold font-mono tracking-wider transition-all active:scale-95 shadow-sm"
            style={{
              backgroundColor: isConnected
                ? 'rgba(16, 185, 129, 0.15)'
                : isConnecting
                ? 'rgba(245, 158, 11, 0.15)'
                : isError
                ? 'rgba(239, 68, 68, 0.15)'
                : shb_color.primaryButton,
              color: isConnected
                ? '#10b981'
                : isConnecting
                ? '#f59e0b'
                : isError
                ? '#ef4444'
                : shb_color.primaryButtonText,
              border: isConnected
                ? '1px solid rgba(16, 185, 129, 0.3)'
                : isConnecting
                ? '1px solid rgba(245, 158, 11, 0.3)'
                : isError
                ? '1px solid rgba(239, 68, 68, 0.3)'
                : undefined,
            }}
          >
            <span>
              {isConnected
                ? 'CONNECTED'
                : isConnecting
                ? 'CONNECTING...'
                : isError
                ? 'RETRY BLE'
                : 'CONNECT'}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          <BleDeviceDropdown
            isOpen={isDropdownOpen}
            onClose={() => setIsDropdownOpen(false)}
            anchorRef={buttonRef}
          />
        </div>
      </div>
    </div>
  );
};
