import React from 'react';
import { Activity, Compass, Thermometer, Cpu } from 'lucide-react';
import { useShbTheme } from '../../theme/shbTheme';
import { SensorStatusItem, SensorModuleStatus } from '../../types/shb';

export const DEFAULT_SENSORS: SensorStatusItem[] = [
  { id: 'PPG', name: 'MAX30102', fullName: 'Optical PPG', status: 'WAITING', rateHz: 50 },
  { id: 'MPU', name: 'MPU6050', fullName: '6-DoF IMU', status: 'WAITING', rateHz: 50 },
  { id: 'ENV', name: 'BMP180', fullName: 'Temp / Pres / Alt', status: 'WAITING', rateHz: 10 },
];

export interface SensorStatusCardProps {
  sensors?: SensorStatusItem[] | null;
  bleConnected?: boolean;
}

export const SensorStatusCard: React.FC<SensorStatusCardProps> = ({
  sensors,
  bleConnected = false,
}) => {
  const { shb_color } = useShbTheme();

  const sensorList = (sensors && Array.isArray(sensors) && sensors.length > 0)
    ? sensors
    : DEFAULT_SENSORS;

  // Ensure only the active hardware modules are rendered (PPG, MPU, ENV)
  const activeSensors = sensorList
    .filter(Boolean)
    .filter((s) => s && (s.id === 'PPG' || s.id === 'MPU' || s.id === 'ENV'));

  const getStatusStyle = (status: SensorModuleStatus) => {
    switch (status) {
      case 'STREAMING':
      case 'CONNECTED':
        return {
          color: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
        };
      case 'ERROR':
        return {
          color: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
        };
      case 'WAITING':
      case 'NOT_CONNECTED':
      default:
        return {
          color: shb_color.textMuted,
          backgroundColor: shb_color.panel,
          border: `1px solid ${shb_color.panelBorder}`,
        };
    }
  };

  const getSensorIcon = (id: string) => {
    switch (id) {
      case 'PPG':
        return <Activity className="w-3.5 h-3.5 text-rose-400" />;
      case 'MPU':
        return <Compass className="w-3.5 h-3.5 text-amber-400" />;
      case 'ENV':
        return <Thermometer className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Cpu className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  return (
    <div
      className="rounded-xl p-2.5 transition-colors w-full"
      style={{
        backgroundColor: shb_color.card,
        border: `1px solid ${shb_color.cardBorder}`,
      }}
    >
      <div
        className="flex items-center justify-between pb-1.5 mb-2"
        style={{ borderBottom: `1px solid ${shb_color.panelBorder}` }}
      >
        <div className="flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5" style={{ color: shb_color.textSecondary }} />
          <span className="text-xs font-black tracking-wider uppercase" style={{ color: shb_color.textPrimary }}>
            TELEMETRY MODULES
          </span>
        </div>
        <span className="text-[10px] font-mono" style={{ color: shb_color.textMuted }}>
          {bleConnected ? 'STREAM ACTIVE' : 'BLE STANDBY'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {activeSensors.map((sensor) => {
          const rawStatus = sensor?.status || 'WAITING';
          const effectiveStatus: SensorModuleStatus = bleConnected ? rawStatus : 'NOT_CONNECTED';
          const style = getStatusStyle(effectiveStatus);

          return (
            <div
              key={sensor.id}
              className="p-1.5 rounded-lg flex flex-col items-center justify-between text-center transition-colors"
              style={style}
            >
              <div
                className="p-1 rounded-md mb-0.5"
                style={{ backgroundColor: shb_color.panel }}
              >
                {getSensorIcon(sensor.id)}
              </div>
              <span
                className="text-[11px] font-mono font-bold tracking-tight"
                style={{ color: shb_color.textPrimary }}
              >
                {sensor.id}
              </span>
              <span className="text-[9px] font-mono opacity-80" style={{ color: shb_color.textSecondary }}>
                {sensor.name}
              </span>
              <span className="text-[8px] uppercase tracking-wider font-semibold opacity-90 mt-0.5">
                {effectiveStatus === 'NOT_CONNECTED' ? 'OFFLINE' : effectiveStatus}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
