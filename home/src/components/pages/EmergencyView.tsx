/**
 * GOATEST Dedicated Emergency View
 * Center '+' Navigation Slot & High-Priority Emergency Protocol.
 * 
 * FEATURES:
 * - High-visibility emergency beacon trigger
 * - Direct contact triggers for registered Emergency Contacts (up to 5)
 * - Real-time Location broadcast status (no fake GPS)
 * - Transmit alert to Caretaker Notification pipeline
 * - Safe return to Home
 */

import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { userService } from '../../services/userService';
import { notificationService } from '../../services/notificationService';
import type { EmergencyContact, LocationSettings } from '../../types';
import {
  ShieldAlert,
  Phone,
  MapPin,
  AlertTriangle,
  Radio,
  CheckCircle2,
  ArrowLeft,
  Users,
  Compass,
  HeartPulse,
} from 'lucide-react';

export interface EmergencyViewProps {
  onBack: () => void;
}

export const EmergencyView: React.FC<EmergencyViewProps> = ({ onBack }) => {
  const { currentUser, userProfile } = useAuth();
  const { addToast } = useToast();
  const userId = currentUser?.uid || userProfile?.uid || 'guest';
  const userName = userProfile?.displayName || currentUser?.email || 'User';

  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [locationSettings, setLocationSettings] = useState<LocationSettings | null>(null);
  const [isAlertActive, setIsAlertActive] = useState<boolean>(false);
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [lastDispatchedAt, setLastDispatchedAt] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!userId) return;
      try {
        const [contactList, loc] = await Promise.all([
          userService.getEmergencyContacts(userId),
          userService.getLocationSettings(userId),
        ]);
        if (isMounted) {
          setContacts(contactList);
          setLocationSettings(loc);
        }
      } catch (err) {
        console.warn('[EmergencyView] Error loading:', err);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const handleTriggerEmergency = async () => {
    setIsDispatching(true);
    try {
      const coords = locationSettings?.sharingEnabled
        ? locationSettings.lastKnownCoordinates || null
        : null;

      const result = await notificationService.triggerEmergencyAlert(userId, userName, coords);
      setIsAlertActive(true);
      setLastDispatchedAt(result.timestamp);

      addToast({
        title: 'EMERGENCY BEACON TRANSMITTED',
        description: `Alert sent to ${result.contactCount} emergency contact(s) and caretakers.`,
        type: 'error',
      });
    } catch {
      addToast({
        title: 'Dispatch Error',
        description: 'Failed to broadcast emergency alert.',
        type: 'error',
      });
    } finally {
      setIsDispatching(false);
    }
  };

  const primaryContact = contacts.find((c) => c.isPrimary) || contacts[0];

  return (
    <div className="flex flex-col gap-4 text-left pb-8">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>

        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 flex items-center gap-1">
          <ShieldAlert className="w-3.5 h-3.5" /> CRITICAL PROTOCOL
        </span>
      </div>

      {/* Emergency Beacon Big Action Card */}
      <Card
        padding="lg"
        className={`border-2 flex flex-col items-center text-center transition-all ${
          isAlertActive
            ? 'bg-red-950/30 border-red-500 shadow-xl shadow-red-900/30'
            : 'bg-red-50/50 dark:bg-red-950/20 border-red-300 dark:border-red-900/60'
        }`}
      >
        <div className="relative mb-3 flex items-center justify-center">
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
              isAlertActive
                ? 'bg-red-600 text-white animate-pulse shadow-lg shadow-red-600/50'
                : 'bg-[var(--color-emergency)] text-white shadow-md'
            }`}
          >
            <ShieldAlert className="w-10 h-10 stroke-[2.5]" />
          </div>
          {isAlertActive && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 animate-ping" />
          )}
        </div>

        <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
          {isAlertActive ? 'Emergency Beacon Active' : 'Emergency Assistance'}
        </h1>

        <p className="text-xs text-slate-600 dark:text-zinc-300 mt-1 max-w-xs leading-relaxed">
          {isAlertActive
            ? 'Emergency alert has been broadcast. Contacting registered responders and caretakers.'
            : 'Press to broadcast an immediate high-priority alert with your verified coordinates to emergency contacts.'}
        </p>

        <div className="mt-5 w-full max-w-xs flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleTriggerEmergency}
            disabled={isDispatching}
            className={`w-full py-3 px-4 rounded-xl font-bold text-sm uppercase tracking-wider text-white shadow-lg transition-all active:scale-95 cursor-pointer ${
              isAlertActive
                ? 'bg-red-700 hover:bg-red-800 ring-2 ring-red-400 ring-offset-2'
                : 'bg-[var(--color-emergency)] hover:bg-red-700'
            }`}
          >
            {isDispatching
              ? 'Broadcasting...'
              : isAlertActive
              ? 'Re-transmit Emergency Alert'
              : 'Broadcast Emergency Alert'}
          </button>

          {isAlertActive && (
            <button
              type="button"
              onClick={() => {
                setIsAlertActive(false);
                addToast({
                  title: 'Alert Standby',
                  description: 'Emergency beacon returned to standby.',
                  type: 'info',
                });
              }}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 font-medium underline py-1"
            >
              Cancel / Return to Standby
            </button>
          )}
        </div>

        {lastDispatchedAt && (
          <span className="text-[10px] font-mono text-red-600 dark:text-red-400 mt-3 font-semibold">
            Last signal: {new Date(lastDispatchedAt).toLocaleTimeString()}
          </span>
        )}
      </Card>

      {/* Primary Emergency Contact Quick Call */}
      {primaryContact && (
        <Card padding="md" className="flex flex-col gap-2 border-red-200 dark:border-red-900/40 bg-red-50/30 dark:bg-red-950/10">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wide flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-red-600" />
              <span>Primary Responder</span>
            </span>
            <span className="text-[10px] font-bold text-red-600 dark:text-red-400 font-mono">
              {primaryContact.relationship}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {primaryContact.name}
              </span>
              <span className="text-xs font-mono text-slate-600 dark:text-zinc-400">
                {primaryContact.phone}
              </span>
            </div>

            <a
              href={`tel:${primaryContact.phone}`}
              className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold text-xs hover:bg-red-700 active:scale-95 transition-all flex items-center gap-1.5 shadow-md shadow-red-900/20"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call Now</span>
            </a>
          </div>
        </Card>
      )}

      {/* Registered Contacts List */}
      <Card padding="md" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span>Emergency Contacts ({contacts.length})</span>
          </span>
          <span className="text-[10px] text-slate-400">Isolated under UID</span>
        </div>

        {contacts.length === 0 ? (
          <div className="py-4 text-center text-xs text-slate-400">
            No emergency contacts registered. Configure them in Settings.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {contacts.map((c) => (
              <div
                key={c.id}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-2"
              >
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                      {c.name}
                    </span>
                    {c.isPrimary && (
                      <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300">
                        PRIMARY
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                    {c.phone} · {c.relationship}
                  </span>
                </div>

                <a
                  href={`tel:${c.phone}`}
                  className="p-2 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors shrink-0"
                  title="Call"
                >
                  <Phone className="w-3.5 h-3.5" />
                </a>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Verified Location Status */}
      <Card padding="md" className="flex flex-col gap-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-900 dark:text-zinc-100 uppercase tracking-wide flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-blue-500" />
            <span>Beacon GPS Location</span>
          </span>
          <span
            className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
              locationSettings?.sharingEnabled
                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
            }`}
          >
            {locationSettings?.sharingEnabled ? 'SHARING ACTIVE' : 'SHARING OFF'}
          </span>
        </div>

        {locationSettings?.sharingEnabled && locationSettings.lastKnownCoordinates ? (
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-zinc-900 font-mono text-[11px] text-slate-700 dark:text-zinc-300 flex flex-col gap-0.5">
            <div>Lat: {locationSettings.lastKnownCoordinates.latitude.toFixed(5)}°</div>
            <div>Lon: {locationSettings.lastKnownCoordinates.longitude.toFixed(5)}°</div>
            <div className="text-[10px] text-slate-400">
              Acquired: {new Date(locationSettings.lastKnownCoordinates.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-slate-500 dark:text-zinc-400">
            {locationSettings?.sharingEnabled
              ? 'GPS coordinates pending browser acquisition.'
              : 'Location sharing is turned off in Settings.'}
          </p>
        )}
      </Card>
    </div>
  );
};
