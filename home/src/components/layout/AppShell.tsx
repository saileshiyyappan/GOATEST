/**
 * GOATEST Universal App Shell
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { TopNavigation } from './TopNavigation';
import { BottomNavigation } from './BottomNavigation';
import { ToastContainer } from '../ui/Toast';
import { NotificationModal } from './NotificationModal';
import { DeviceConnectionModal } from '../home/DeviceConnectionModal';
import { useDevice } from '../../../../shb/src/context/DeviceContext';
import { notificationService, type SystemNotification } from '../../services/notificationService';
import { androidNotificationService } from '../../services/androidNotificationService';
import { scheduleService } from '../../services/scheduleService';
import type { NavigationTab, DeviceInfo } from '../../types';

const initializedScheduleUsers = new Set<string>();

export interface AppShellProps {
  activeTab: NavigationTab;
  onNavigate: (tab: NavigationTab) => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeTab,
  onNavigate,
  children,
}) => {
  const { userProfile, currentUser } = useAuth();
  const { status: bleStatus, device: bleDevice } = useDevice();
  const userId = currentUser?.uid || '';

  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);

  const deviceInfo: DeviceInfo = {
    connected: ['CONNECTED', 'NOTIFYING', 'STREAMING'].includes(bleStatus),
    status: bleStatus === 'NOT_SUPPORTED' ? 'NOT_AVAILABLE' : bleStatus === 'CONNECTING' ? 'CONNECTING' : ['CONNECTED', 'NOTIFYING', 'STREAMING'].includes(bleStatus) ? 'CONNECTED' : 'DISCONNECTED',
    deviceName: bleDevice?.name || null,
    batteryLevel: bleDevice?.batteryLevel ?? null,
    lastConnectedAt: bleDevice?.connectedAt ? new Date(bleDevice.connectedAt).toISOString() : null,
  };

  useEffect(() => {
    const openDeviceModal = () => setIsDeviceModalOpen(true);
    window.addEventListener('goatest:open-device-modal', openDeviceModal);
    return () => window.removeEventListener('goatest:open-device-modal', openDeviceModal);
  }, []);

  useEffect(() => {
    setNotifications([]);
    setNotificationsError(null);
    if (!userId) return;
    let mounted = true;
    setNotificationsLoading(true);
    const unsubscribe = notificationService.subscribeFirestore(userId, (updated, addedNotificationIds = []) => {
      if (!mounted) return;
      setNotifications(updated);
      setNotificationsLoading(false);
      // Firestore notifications populate the in-app drawer only. Native
      // schedule alerts are created exclusively by scheduleService.
    });
    return () => { mounted = false; unsubscribe(); };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    if (initializedScheduleUsers.has(userId)) return;
    initializedScheduleUsers.add(userId);
    void androidNotificationService.initialize().catch((error) => console.warn('[AndroidNotification] permission/channel unavailable:', error));
    void Promise.all([
      scheduleService.syncNativeSchedules(userId),
      scheduleService.reconcileMissedAssessments(userId),
    ]).catch((error) => {
      initializedScheduleUsers.delete(userId);
      console.error('[Schedule] initialization failed:', error);
    });
  }, [userId]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div data-home-active-tab={activeTab} className="w-full h-full flex flex-col min-h-0 bg-black relative">
      {/* Toast Notification Container */}
      <ToastContainer />

      {/* Reusable Fixed Top Navigation */}
      <TopNavigation
        activeTab={activeTab}
        onNavigate={onNavigate}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenDeviceStatus={() => setIsDeviceModalOpen(true)}
        unreadCount={unreadCount}
      />

      {/* Independently Scrollable Main Viewport Content */}
      <main className="flex-1 overflow-y-auto min-h-0 px-4 py-4 select-text overscroll-contain bg-[#191616]">
        {children}
      </main>

      {/* Reusable Fixed Bottom Navigation */}
      <BottomNavigation
        activeTab={activeTab}
        onNavigate={onNavigate}
        onEmergencyClick={() => onNavigate('emergency')}
      />

      {/* Notifications Drawer Modal */}
      <NotificationModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        userId={userId}
        notifications={notifications}
        isLoading={notificationsLoading}
        error={notificationsError}
        onNavigate={onNavigate}
      />

      <DeviceConnectionModal
        isOpen={isDeviceModalOpen}
        onClose={() => setIsDeviceModalOpen(false)}
        deviceInfo={deviceInfo}
        onStatusChanged={() => undefined}
      />
    </div>
  );
};
