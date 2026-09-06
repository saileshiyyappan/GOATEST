import React, { useState } from 'react';
import { Bluetooth, Palette } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useDevice } from '../../context/DeviceContext';
import { Badge } from '../ui/Badge';
import { ThemeCustomizerModal } from './ThemeCustomizerModal';

export const TopNav: React.FC = () => {
  const { mode, accent } = useTheme();
  const { status, connect } = useDevice();
  const [showThemeModal, setShowThemeModal] = useState(false);

  const getDeviceBadge = () => {
    switch (status) {
      case 'CONNECTED':
        return <Badge variant="success">BLE ONLINE</Badge>;
      case 'CONNECTING':
        return <Badge variant="warning">CONNECTING</Badge>;
      case 'ERROR':
        return <Badge variant="danger">BLE ERROR</Badge>;
      case 'DISCONNECTED':
      default:
        return <Badge variant="neutral">BLE STANDBY</Badge>;
    }
  };

  return (
    <>
      <header
        className={`sticky top-0 z-40 px-4 py-3 flex items-center justify-between border-b backdrop-blur-md transition-colors ${
          mode === 'WHITE'
            ? 'bg-white/90 border-slate-200 text-slate-900'
            : mode === 'DARK'
            ? 'bg-zinc-950/90 border-zinc-800 text-zinc-100'
            : 'bg-zinc-900/90 border-zinc-800 text-zinc-100'
        }`}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm text-white shadow-sm"
            style={{ backgroundColor: accent.primary }}
          >
            G
          </div>
          <div>
            <span className="text-sm font-black tracking-tight">GOATEST</span>
            <p className="text-[10px] font-mono text-zinc-400">Health Telemetry</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* BLE Status Button */}
          <button
            onClick={connect}
            className="flex items-center gap-1 p-1 rounded-lg hover:bg-zinc-800/60 transition-colors"
            title="Device Status / Connect"
          >
            <Bluetooth className="w-3.5 h-3.5 text-zinc-400" />
            {getDeviceBadge()}
          </button>

          {/* Theme Palette Toggle */}
          <button
            onClick={() => setShowThemeModal(true)}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors"
            title="Customize Appearance"
          >
            <Palette className="w-4 h-4" />
          </button>
        </div>
      </header>

      <ThemeCustomizerModal
        isOpen={showThemeModal}
        onClose={() => setShowThemeModal(false)}
      />
    </>
  );
};
