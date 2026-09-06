import React, { useState } from 'react';
import { Palette, Bluetooth, ExternalLink } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useDevice } from '../context/DeviceContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ThemeCustomizerModal } from '../components/layout/ThemeCustomizerModal';

export const SettingsPage: React.FC = () => {
  const { mode, accent } = useTheme();
  const { status, connect, disconnect } = useDevice();
  const [showThemeModal, setShowThemeModal] = useState(false);

  return (
    <div className="p-4 space-y-4 pb-24">
      <div>
        <h2 className="text-xl font-black tracking-tight text-zinc-100">
          SETTINGS
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          Telemetry configuration & app preferences.
        </p>
      </div>

      {/* Appearance Section */}
      <Card className="border border-zinc-750 bg-zinc-850/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-zinc-100">Theme & Appearance</h3>
              <p className="text-[11px] text-zinc-400">
                Mode: {mode} · Accent: {accent.name}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowThemeModal(true)} className="text-xs">
            Customize
          </Button>
        </div>
      </Card>

      {/* Hardware / BLE Section */}
      <Card className="border border-zinc-750 bg-zinc-850/80 space-y-3">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300">
              <Bluetooth className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-zinc-100">Hardware Telemetry</h3>
              <p className="text-[11px] text-zinc-400">Web Bluetooth GATT</p>
            </div>
          </div>
          <Badge variant={status === 'CONNECTED' ? 'success' : 'neutral'}>
            {status}
          </Badge>
        </div>

        <div className="flex justify-between items-center text-xs text-zinc-300">
          <span>Connection Mode</span>
          <span className="font-mono text-zinc-400">Direct Peripheral</span>
        </div>

        <div className="pt-1">
          {status === 'CONNECTED' ? (
            <Button variant="outline" size="sm" fullWidth onClick={disconnect} className="text-xs">
              Disconnect Sensor
            </Button>
          ) : (
            <Button variant="secondary" size="sm" fullWidth onClick={connect} className="text-xs font-bold">
              Pair Sensor Device
            </Button>
          )}
        </div>
      </Card>

      {/* External PHB Integration Notice */}
      <Card className="border border-zinc-800 bg-zinc-900/60 space-y-2 text-xs text-zinc-400">
        <div className="flex items-center justify-between text-zinc-300 font-bold">
          <div className="flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-cyan-400" />
            <span>External Health Record Link</span>
          </div>
          <Badge variant="neutral">NOT CONFIGURED</Badge>
        </div>
        <p className="text-[11px] leading-relaxed">
          Personal Health Record integration is an external service. Configuration point is staged for production setup.
        </p>
      </Card>

      {/* System Build Info */}
      <Card compact className="border border-zinc-800/80 bg-zinc-900/40 text-[11px] font-mono text-zinc-400 space-y-1">
        <div className="flex justify-between">
          <span>Application:</span>
          <span className="text-zinc-300">GOATEST Sensor Platform</span>
        </div>
        <div className="flex justify-between">
          <span>Module:</span>
          <span className="text-zinc-300">SHB Telemetry Suite</span>
        </div>
      </Card>

      <ThemeCustomizerModal
        isOpen={showThemeModal}
        onClose={() => setShowThemeModal(false)}
      />
    </div>
  );
};
