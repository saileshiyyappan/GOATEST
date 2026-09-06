/**
 * GOATEST Location Settings & Sharing Section
 * PMT-6 Part 5: Real Location Permission & Sharing controls.
 * Zero fake GPS data. Uses real navigator.geolocation API when permitted.
 */

import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useToast } from '../../context/ToastContext';
import { userService } from '../../services/userService';
import type { LocationSettings, GeolocationPermissionState } from '../../types';
import {
  MapPin,
  Compass,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  Shield,
} from 'lucide-react';

export interface LocationSettingsSectionProps {
  userId: string;
}

export const LocationSettingsSection: React.FC<LocationSettingsSectionProps> = ({ userId }) => {
  const { addToast } = useToast();
  const [settings, setSettings] = useState<LocationSettings>({
    sharingEnabled: false,
    permissionStatus: 'PROMPT',
    lastKnownCoordinates: null,
  });
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const loadSettings = async () => {
      if (!userId) return;
      try {
        const data = await userService.getLocationSettings(userId);
        if (isMounted) {
          setSettings(data);
        }
      } catch (err) {
        console.warn('[LocationSettings] Error loading:', err);
      }
    };

    // Check browser permission status if supported
    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((perm) => {
        if (!isMounted) return;
        const mappedStatus: GeolocationPermissionState =
          perm.state === 'granted'
            ? 'GRANTED'
            : perm.state === 'denied'
            ? 'DENIED'
            : 'PROMPT';
        setSettings((prev) => ({ ...prev, permissionStatus: mappedStatus }));
      }).catch(() => {
        // Permissions query not supported for geolocation
      });
    } else if (typeof navigator !== 'undefined' && !('geolocation' in navigator)) {
      setSettings((prev) => ({ ...prev, permissionStatus: 'UNSUPPORTED' }));
    }

    loadSettings();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const handleToggleSharing = async () => {
    if (!userId) return;
    const nextState = !settings.sharingEnabled;
    setIsUpdating(true);
    try {
      const updated = await userService.updateLocationSettings(userId, {
        sharingEnabled: nextState,
      });
      setSettings(updated);
      addToast({
        title: nextState ? 'Location Sharing Enabled' : 'Location Sharing Disabled',
        description: nextState
          ? 'Emergency alerts will attach your real-time coordinates.'
          : 'Coordinates will not be shared during alerts.',
        type: nextState ? 'success' : 'info',
      });

      // If user enabled sharing, attempt to fetch current position
      if (nextState) {
        handleRefreshCoordinates();
      }
    } catch {
      addToast({
        title: 'Error',
        description: 'Could not update location preferences.',
        type: 'error',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRefreshCoordinates = () => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setSettings((prev) => ({ ...prev, permissionStatus: 'UNSUPPORTED' }));
      addToast({
        title: 'Unsupported',
        description: 'Geolocation is not supported by your browser environment.',
        type: 'warning',
      });
      return;
    }

    setIsFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy,
          timestamp: new Date(pos.timestamp).toISOString(),
        };

        const updated = await userService.updateLocationSettings(userId, {
          permissionStatus: 'GRANTED',
          lastKnownCoordinates: coords,
        });
        setSettings(updated);
        setIsFetchingLocation(false);
        addToast({
          title: 'Location Acquired',
          description: `Coordinates updated with ~${Math.round(coords.accuracyMeters || 10)}m accuracy.`,
          type: 'success',
        });
      },
      async (err) => {
        setIsFetchingLocation(false);
        const status: GeolocationPermissionState = err.code === 1 ? 'DENIED' : 'PROMPT';
        await userService.updateLocationSettings(userId, {
          permissionStatus: status,
        });
        setSettings((prev) => ({ ...prev, permissionStatus: status }));

        let reason = 'Location acquisition failed.';
        if (err.code === 1) reason = 'Location permission was denied in your browser.';
        if (err.code === 2) reason = 'Position unavailable.';
        if (err.code === 3) reason = 'Location request timed out.';

        addToast({
          title: 'Location Notice',
          description: reason,
          type: 'warning',
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const getStatusBadge = () => {
    switch (settings.permissionStatus) {
      case 'GRANTED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> GRANTED
          </span>
        );
      case 'DENIED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> DENIED
          </span>
        );
      case 'UNSUPPORTED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
            UNSUPPORTED
          </span>
        );
      case 'PROMPT':
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            PROMPT NEEDED
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-500" />
          <span className="text-xs font-bold text-white uppercase tracking-wide">
            Location & GPS Sharing
          </span>
        </div>
        {getStatusBadge()}
      </div>

      <Card padding="md" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col text-left">
            <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
              Share Coordinates in Emergency
            </span>
            <span className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
              Attaches verified GPS coordinates to emergency beacon alerts.
            </span>
          </div>

          <button
            type="button"
            onClick={handleToggleSharing}
            disabled={isUpdating}
            className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
              settings.sharingEnabled ? 'bg-[var(--color-accent)]' : 'bg-slate-300 dark:bg-zinc-700'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                settings.sharingEnabled ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Real Coordinates Status */}
        {settings.sharingEnabled && (
          <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-blue-500" />
                <span>Verified Coordinates</span>
              </span>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRefreshCoordinates}
                disabled={isFetchingLocation}
                leftIcon={<RefreshCw className={`w-3 h-3 ${isFetchingLocation ? 'animate-spin' : ''}`} />}
                className="text-[10px] h-7 px-2.5"
              >
                {isFetchingLocation ? 'Acquiring...' : 'Update Location'}
              </Button>
            </div>

            {settings.lastKnownCoordinates ? (
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 font-mono text-[11px] text-slate-700 dark:text-zinc-300 flex flex-col gap-0.5">
                <div>Latitude: {settings.lastKnownCoordinates.latitude.toFixed(5)}°</div>
                <div>Longitude: {settings.lastKnownCoordinates.longitude.toFixed(5)}°</div>
                {settings.lastKnownCoordinates.accuracyMeters && (
                  <div className="text-[10px] text-slate-500 dark:text-zinc-500">
                    Accuracy: ±{Math.round(settings.lastKnownCoordinates.accuracyMeters)} meters
                  </div>
                )}
                <div className="text-[10px] text-slate-400 mt-1">
                  Last updated: {new Date(settings.lastKnownCoordinates.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-[11px] text-slate-500 dark:text-zinc-400 text-left">
                No location recorded yet. Tap "Update Location" to request browser coordinates.
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
