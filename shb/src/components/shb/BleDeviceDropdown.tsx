import React, { useEffect, useRef } from 'react';
import { Bluetooth, Radio, AlertCircle, RefreshCw, X, Check, Loader2, Smartphone, ShieldCheck } from 'lucide-react';
import { useShbTheme } from '../../theme/shbTheme';
import { useDevice } from '../../context/DeviceContext';
import { DiscoveredBleDevice } from '../../types/device';

export interface BleDeviceDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export const BleDeviceDropdown: React.FC<BleDeviceDropdownProps> = ({
  isOpen,
  onClose,
  anchorRef,
}) => {
  const { shb_color, accent } = useShbTheme();
  const {
    status: bleStatus,
    device,
    selectedDevice,
    availableDevices,
    errorMessage,
    isBluetoothSupported,
    platformInfo,
    selectDevice,
    scanDevices,
    connect,
    disconnect,
    reconnect,
  } = useDevice();

  const dropdownRef = useRef<HTMLDivElement>(null);

  const isStreaming = bleStatus === 'STREAMING';
  const isNotifying = bleStatus === 'NOTIFYING';
  const isConnected = bleStatus === 'CONNECTED' || isNotifying || isStreaming;
  const isConnecting = bleStatus === 'CONNECTING';
  const isScanning = bleStatus === 'SCANNING';
  const isError = bleStatus === 'ERROR' || bleStatus === 'CONNECTION_FAILED';
  const isNotSupported = bleStatus === 'NOT_SUPPORTED' || !isBluetoothSupported;
  const isDeviceSelected = bleStatus === 'DEVICE_SELECTED';

  // Handle click outside to close dropdown
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        (!anchorRef?.current || !anchorRef.current.contains(target))
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  const activeDeviceName = device?.name || selectedDevice?.name || 'M-BAND';

  const handleSelectDevice = (dev: DiscoveredBleDevice) => {
    selectDevice(dev);
  };

  const handleConnectClick = async () => {
    if (isConnected) return;
    await connect(selectedDevice || undefined);
  };

  return (
    <div
      ref={dropdownRef}
      id="ble-device-dropdown"
      className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-80 rounded-2xl border shadow-2xl z-50 p-3.5 animate-fadeIn font-mono select-none"
      style={{
        backgroundColor: '#121215',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        boxShadow: '0 16px 36px -4px rgba(0, 0, 0, 0.9), 0 6px 16px rgba(0, 0, 0, 0.6)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800 mb-3">
        <div className="flex items-center gap-1.5">
          <Bluetooth className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[11px] font-bold tracking-wider uppercase text-zinc-200">
            BLUETOOTH SELECTOR
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80 transition-colors"
          title="Close Selector"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* State: NOT_SUPPORTED */}
      {isNotSupported && (
        <div className="space-y-2.5 py-1">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-amber-300">
                Web Bluetooth Not Supported
              </div>
              <div className="text-[10px] text-amber-400/80 mt-1 leading-relaxed">
                {platformInfo.os === 'IOS'
                  ? 'iOS Safari restricts Web Bluetooth. Use a Bluetooth-enabled browser like Bluefy or connect on Chrome/Android/Desktop.'
                  : errorMessage || 'Your browser does not support Web Bluetooth. Please use Google Chrome or Microsoft Edge.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* State: CONNECTED / NOTIFYING / STREAMING */}
      {isConnected && (
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                {isStreaming ? (
                  <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                ) : (
                  <Bluetooth className="w-4 h-4 text-emerald-400" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-emerald-300 truncate">
                  {activeDeviceName}
                </div>
                <div className="text-[9px] text-emerald-400/90 flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                  <span>{isStreaming ? 'STREAMING SENSOR DATA' : 'GATT CONNECTED'}</span>
                </div>
              </div>
            </div>
            <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
              ACTIVE
            </span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-zinc-400">Connected to M-BAND</span>
            <button
              type="button"
              onClick={() => disconnect()}
              className="px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 active:scale-95 transition-all"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}

      {/* State: CONNECTING / SCANNING */}
      {(isConnecting || isScanning) && (
        <div className="space-y-2.5 py-1">
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center gap-2.5">
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-blue-300">
                {isScanning ? 'Scanning for M-BAND...' : `Connecting to ${activeDeviceName}...`}
              </div>
              <div className="text-[9px] text-blue-400/80 mt-0.5">
                Negotiating GATT services & subscribing telemetry
              </div>
            </div>
          </div>
        </div>
      )}

      {/* State: ERROR / FAILED */}
      {isError && !isConnected && !isConnecting && (
        <div className="space-y-2.5 py-1">
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-rose-300">
                Connection Failed
              </div>
              <div className="text-[9px] text-rose-400/80 mt-1 leading-relaxed">
                {errorMessage || 'Device connection failed. Ensure M-BAND is powered on and within Bluetooth range.'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={reconnect}
            className="w-full py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700 active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        </div>
      )}

      {/* State: DISCONNECTED or DEVICE_SELECTED */}
      {!isConnected && !isConnecting && !isScanning && !isNotSupported && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-bold">
              Available In-App Devices
            </span>
            <span className="text-[9px] text-zinc-500">
              {availableDevices.length} device{availableDevices.length > 1 ? 's' : ''}
            </span>
          </div>

          {/* Discovered Devices List */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {availableDevices.map((dev) => {
              const isCurrentSelected = selectedDevice?.id === dev.id || (selectedDevice === null && dev.name === 'M-BAND');

              return (
                <button
                  key={dev.id}
                  type="button"
                  onClick={() => handleSelectDevice(dev)}
                  className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between border transition-all active:scale-[0.98] ${
                    isCurrentSelected
                      ? 'bg-blue-500/15 border-blue-500/50 shadow-sm'
                      : 'bg-white/[0.02] border-zinc-800/80 hover:border-zinc-700 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isCurrentSelected
                          ? 'bg-blue-500/25 border border-blue-500/40 text-blue-300'
                          : 'bg-zinc-800/80 border border-zinc-700/60 text-zinc-400'
                      }`}
                    >
                      <Bluetooth className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className={`text-xs font-bold truncate ${isCurrentSelected ? 'text-blue-200' : 'text-zinc-200'}`}>
                        {dev.name}
                      </div>
                      <div className="text-[9px] text-zinc-500">
                        {dev.isPaired ? 'Paired device' : 'Ready to pair'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isCurrentSelected && (
                      <Check className="w-3.5 h-3.5 text-blue-400" />
                    )}
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded-md font-bold uppercase ${
                        isCurrentSelected
                          ? 'bg-blue-500/30 text-blue-200 border border-blue-500/50'
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                      }`}
                    >
                      {isCurrentSelected ? 'SELECTED' : 'SELECT'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Primary Action Button: Connect Selected Device */}
          <button
            type="button"
            onClick={handleConnectClick}
            className="w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Bluetooth className="w-3.5 h-3.5" />
            <span>Connect To {selectedDevice?.name || 'M-BAND'}</span>
          </button>

          {/* Secondary Action: Scan or Refresh */}
          <button
            type="button"
            onClick={() => scanDevices()}
            className="w-full py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Scan For Devices</span>
          </button>
        </div>
      )}
    </div>
  );
};
