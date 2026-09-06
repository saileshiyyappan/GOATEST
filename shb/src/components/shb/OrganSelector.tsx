import React, { useState, useRef } from 'react';
import { Bluetooth, BluetoothConnected, Loader2, AlertCircle, ChevronDown } from 'lucide-react';
import { useShbTheme } from '../../theme/shbTheme';
import { useDevice } from '../../context/DeviceContext';
import { OrganCategory } from '../../types/shb';
import { AUTHORITATIVE_ORGAN_REGISTRY } from '../../services/organ/organRegistry';
import { BleDeviceDropdown } from './BleDeviceDropdown';

export const ORGAN_CATEGORIES: OrganCategory[] = AUTHORITATIVE_ORGAN_REGISTRY;

export interface OrganSelectorProps {
  selectedOrgan: OrganCategory | null;
  onSelectOrgan: (organ: OrganCategory) => void;
  onProceed: () => void;
}

export const OrganSelector: React.FC<OrganSelectorProps> = ({
  selectedOrgan,
  onSelectOrgan,
  onProceed,
}) => {
  const { shb_color, accent } = useShbTheme();
  const { status: bleStatus, device, errorMessage } = useDevice();
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isConnected = bleStatus === 'CONNECTED' || bleStatus === 'NOTIFYING' || bleStatus === 'STREAMING';
  const isConnecting = bleStatus === 'CONNECTING';

  return (
    <div className="flex flex-col h-full justify-between w-full max-w-md mx-auto py-1 select-none">
      {/* Title + Compact BLE Capsule Button with In-App Dropdown */}
      <div className="text-center pt-1 pb-1 flex flex-col items-center gap-1.5 relative">
        <h2
          className="text-xs font-black tracking-widest uppercase font-mono"
          style={{ color: shb_color.textPrimary }}
        >
          ORGAN SELECTION
        </h2>

        {/* Compact Capsule Bluetooth Button */}
        <div className="relative">
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase transition-all duration-150 active:scale-95 shadow-sm cursor-pointer"
            style={{
              backgroundColor: isConnected
                ? '#10b981'
                : isConnecting
                ? 'rgba(59, 130, 246, 0.15)'
                : shb_color.panel,
              color: isConnected
                ? '#ffffff'
                : isConnecting
                ? '#60a5fa'
                : shb_color.textPrimary,
              border: isConnected
                ? '1px solid #059669'
                : isConnecting
                ? '1px solid rgba(59, 130, 246, 0.35)'
                : `1px solid ${shb_color.panelBorder}`,
              boxShadow: isConnected ? '0 0 10px rgba(16, 185, 129, 0.4)' : undefined,
            }}
            title={isConnected ? `Connected to ${device?.name || 'M-Band'}` : 'Select Bluetooth Sensor'}
          >
            {isConnecting ? (
              <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
            ) : isConnected ? (
              <BluetoothConnected className="w-3 h-3 text-white" />
            ) : (
              <Bluetooth className="w-3 h-3 text-zinc-400" />
            )}
            <span>
              {isConnecting
                ? 'CONNECTING'
                : isConnected
                ? 'CONNECTED'
                : 'CONNECT BLUETOOTH'}
            </span>
            <ChevronDown className={`w-3 h-3 opacity-70 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          <BleDeviceDropdown
            isOpen={isDropdownOpen}
            onClose={() => setIsDropdownOpen(false)}
            anchorRef={buttonRef}
          />
        </div>

        {/* Concise BLE Error Feedback if any */}
        {errorMessage && bleStatus === 'ERROR' && (
          <div className="flex items-center gap-1 text-[10px] font-mono text-rose-400 max-w-xs text-center">
            <AlertCircle className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate">{errorMessage}</span>
          </div>
        )}
      </div>

      {/* 11 Compact Curved Buttons */}
      <div className="flex-1 flex flex-col justify-center gap-1.5 px-2 py-1">
        {ORGAN_CATEGORIES.map((category) => {
          const isSelected = selectedOrgan?.id === category.id;

          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onSelectOrgan(category)}
              className="w-full py-2 px-3 rounded-xl text-center text-xs font-mono font-bold tracking-wider transition-all duration-150 active:scale-[0.98] cursor-pointer"
              style={{
                backgroundColor: isSelected
                  ? accent.primary
                  : shb_color.card,
                color: isSelected
                  ? '#ffffff'
                  : shb_color.textPrimary,
                border: isSelected
                  ? `1px solid ${accent.primary}`
                  : `1px solid ${shb_color.cardBorder}`,
                boxShadow: isSelected
                  ? `0 2px 8px ${accent.ring}`
                  : undefined,
              }}
            >
              {category.name}
            </button>
          );
        })}
      </div>

      {/* Fixed Bottom Action */}
      <div className="pt-2 px-2 pb-1">
        <button
          type="button"
          disabled={!selectedOrgan}
          onClick={onProceed}
          className="w-full py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 font-bold text-xs uppercase tracking-wider font-mono shadow-md transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
          style={{
            backgroundColor: shb_color.primaryButton,
            color: shb_color.primaryButtonText,
          }}
        >
          <span>
            {selectedOrgan
              ? `Start ${selectedOrgan.name} Assessment`
              : 'Select an Organ'}
          </span>
        </button>
      </div>
    </div>
  );
};
