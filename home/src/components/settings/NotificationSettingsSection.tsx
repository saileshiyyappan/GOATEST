/**
 * GOATEST Notification Settings Section
 * PMT-6 Part 6 & 7: Notification preferences & Browser permission controls.
 */

import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useToast } from '../../context/ToastContext';
import { userService } from '../../services/userService';
import { notificationService } from '../../services/notificationService';
import type { NotificationSettings } from '../../types';
import {
  Bell,
  BellRing,
  CheckCircle2,
  AlertCircle,
  Clock,
  Activity,
  FileText,
  Users,
  ShieldAlert,
} from 'lucide-react';

export interface NotificationSettingsSectionProps {
  userId: string;
}

export const NotificationSettingsSection: React.FC<NotificationSettingsSectionProps> = ({ userId }) => {
  const { addToast } = useToast();
  const [settings, setSettings] = useState<NotificationSettings>({
    assessmentReminders: true,
    testCompletedAlerts: true,
    reportReadyAlerts: true,
    c50ConditionAlerts: true,
    caretakerNotifications: true,
    emergencyAlerts: true,
    browserPermission: 'default',
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!userId) return;
      try {
        const data = await userService.getNotificationSettings(userId);
        if (isMounted) {
          setSettings(data);
        }
      } catch (err) {
        console.warn('[NotificationSettings] Load error:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const handleToggle = async (key: keyof Omit<NotificationSettings, 'browserPermission'>) => {
    const nextVal = !settings[key];
    const updated = { ...settings, [key]: nextVal };
    setSettings(updated);
    try {
      await userService.updateNotificationSettings(userId, { [key]: nextVal });
      addToast({
        title: 'Preference Updated',
        description: `${key} is now ${nextVal ? 'enabled' : 'disabled'}.`,
        type: 'info',
      });
    } catch {
      addToast({
        title: 'Error',
        description: 'Failed to update notification settings.',
        type: 'error',
      });
    }
  };

  const handleRequestBrowserPermission = async () => {
    const perm = await notificationService.requestBrowserNotificationPermission();
    const updated = { ...settings, browserPermission: perm };
    setSettings(updated);
    if (perm === 'granted') {
      notificationService.sendBrowserNotification('GOATEST Notifications Enabled', {
        body: 'You will receive assessment reminders and important health alerts.',
      });
      addToast({
        title: 'Notifications Granted',
        description: 'Browser alerts are active for GOATEST.',
        type: 'success',
      });
    } else if (perm === 'denied') {
      addToast({
        title: 'Notifications Denied',
        description: 'Notifications have been blocked in your browser settings.',
        type: 'warning',
      });
    }
  };

  const getPermissionBadge = () => {
    switch (settings.browserPermission) {
      case 'granted':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> GRANTED
          </span>
        );
      case 'denied':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> BLOCKED
          </span>
        );
      case 'unsupported':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
            UNSUPPORTED
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            DEFAULT
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-purple-500" />
          <span className="text-xs font-bold text-white uppercase tracking-wide">
            Notifications & Alerts
          </span>
        </div>
        {getPermissionBadge()}
      </div>

      <Card padding="md" className="flex flex-col gap-3.5">
        {/* Browser Permission Request Prompt if not granted */}
        {settings.browserPermission === 'default' && (
          <div className="p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <BellRing className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-purple-900 dark:text-purple-200">
                  Enable System Alerts
                </span>
                <span className="text-[11px] text-purple-700 dark:text-purple-300">
                  Receive real-time assessment reminders on your device.
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleRequestBrowserPermission}
              className="text-xs shrink-0"
            >
              Allow
            </Button>
          </div>
        )}

        {settings.browserPermission === 'denied' && (
          <div className="p-3 rounded-xl bg-red-50/70 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-[11px] text-red-700 dark:text-red-300">
            Browser alerts are blocked. In-app notifications remain available; update your browser site settings if you want system alerts.
          </div>
        )}

        {/* Toggles */}
        <div className="flex flex-col gap-2.5">
          {/* Assessment Reminders */}
          <div className="flex items-center justify-between gap-3 py-1">
            <div className="flex items-start gap-2 text-left">
              <Clock className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                  Assessment Schedule Reminders
                </span>
                <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                  Prompts when an assessment slot or daily Q/A is due.
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.assessmentReminders}
              onChange={() => handleToggle('assessmentReminders')}
              className="w-4 h-4 rounded text-[var(--color-accent)] cursor-pointer"
            />
          </div>

          {/* Test Completed Alerts */}
          <div className="flex items-center justify-between gap-3 py-1 border-t border-slate-100 dark:border-zinc-800/80">
            <div className="flex items-start gap-2 text-left">
              <Activity className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                  Test Completion Alerts
                </span>
                <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                  Notifies when raw sensor comparison and C50 pipeline conclude.
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.testCompletedAlerts}
              onChange={() => handleToggle('testCompletedAlerts')}
              className="w-4 h-4 rounded text-[var(--color-accent)] cursor-pointer"
            />
          </div>

          {/* Report Ready Alerts */}
          <div className="flex items-center justify-between gap-3 py-1 border-t border-slate-100 dark:border-zinc-800/80">
            <div className="flex items-start gap-2 text-left">
              <FileText className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                  Derived Report Ready
                </span>
                <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                  Alerts when daily, weekly, or monthly reports are compiled.
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.reportReadyAlerts}
              onChange={() => handleToggle('reportReadyAlerts')}
              className="w-4 h-4 rounded text-[var(--color-accent)] cursor-pointer"
            />
          </div>

          {/* Caretaker Notifications */}
          <div className="flex items-center justify-between gap-3 py-1 border-t border-slate-100 dark:border-zinc-800/80">
            <div className="flex items-start gap-2 text-left">
              <Users className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                  Caretaker Event Dispatch
                </span>
                <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                  Relays completed assessments to linked caretakers automatically.
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.caretakerNotifications}
              onChange={() => handleToggle('caretakerNotifications')}
              className="w-4 h-4 rounded text-[var(--color-accent)] cursor-pointer"
            />
          </div>

          {/* Emergency Alert Broadcasts */}
          <div className="flex items-center justify-between gap-3 py-1 border-t border-slate-100 dark:border-zinc-800/80">
            <div className="flex items-start gap-2 text-left">
              <ShieldAlert className="w-4 h-4 text-[var(--color-emergency)] shrink-0 mt-0.5" />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                  Emergency Broadcasts
                </span>
                <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                  High-priority alerts sent to primary emergency contacts.
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.emergencyAlerts}
              onChange={() => handleToggle('emergencyAlerts')}
              className="w-4 h-4 rounded text-[var(--color-accent)] cursor-pointer"
            />
          </div>
        </div>
      </Card>
    </div>
  );
};
