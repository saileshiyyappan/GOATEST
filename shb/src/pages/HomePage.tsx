import React from 'react';
import { Activity, Bluetooth, ShieldCheck, ArrowRight, Sparkles, Heart } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useDevice } from '../context/DeviceContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

export interface HomePageProps {
  onStartTest: () => void;
  onOpenSettings: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onStartTest, onOpenSettings }) => {
  const { accent } = useTheme();
  const { status, connect, disconnect, device } = useDevice();

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Quick Launch Action */}
      <Card className="p-5 border border-zinc-800 bg-gradient-to-br from-zinc-850 to-zinc-900 shadow-lg">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider uppercase text-zinc-400">
              HEALTH ASSESSMENT
            </span>
            <span
              className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: status === 'CONNECTED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(113, 113, 122, 0.15)',
                color: status === 'CONNECTED' ? '#10b981' : '#a1a1aa',
                border: status === 'CONNECTED' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(113, 113, 122, 0.3)',
              }}
            >
              {status === 'CONNECTED' ? 'DEVICE READY' : 'STANDBY'}
            </span>
          </div>

          <h2 className="text-xl font-black tracking-tight text-zinc-100">
            Real-Time Physiological Telemetry
          </h2>

          <p className="text-xs text-zinc-400 leading-relaxed">
            Acquire direct physiological baselines with real sensor telemetry and derived vital analysis.
          </p>

          <div className="pt-1">
            <Button
              variant="accent"
              size="lg"
              fullWidth
              onClick={onStartTest}
              className="flex items-center justify-center gap-2 font-bold tracking-wide shadow-md"
            >
              <Activity className="w-4 h-4" />
              <span>Launch Assessment</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Sensor Hardware Status */}
      <Card className="border border-zinc-800 bg-zinc-850/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: accent.bgLight }}
            >
              <Bluetooth className="w-5 h-5" style={{ color: accent.primary }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-zinc-200">Sensor Peripheral</h3>
                <Badge variant={status === 'CONNECTED' ? 'success' : 'neutral'}>
                  {status}
                </Badge>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {status === 'CONNECTED'
                  ? device?.name || 'Peripheral Paired & Active'
                  : 'Web Bluetooth GATT'}
              </p>
            </div>
          </div>

          <div>
            {status === 'CONNECTED' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={disconnect}
                className="text-xs"
              >
                Disconnect
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={connect}
                className="text-xs font-semibold"
              >
                Connect
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Real Data Guarantee */}
      <Card compact className="border border-zinc-800 bg-zinc-900/60 text-xs text-zinc-400 space-y-1.5">
        <div className="flex items-center gap-2 text-zinc-300 font-bold">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Real Data Standard</span>
        </div>
        <p className="text-[11px] leading-relaxed">
          GOATEST acquires 100% genuine physiological telemetry from paired hardware sensors.
        </p>
      </Card>
    </div>
  );
};
