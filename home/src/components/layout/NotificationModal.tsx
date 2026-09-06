/**
 * GOATEST Notification Modal / Drawer
 * Full-featured notification center with type categorization, read tracking, and dismissal.
 */

import React from 'react';
import { Dialog } from '../ui/Dialog';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  notificationService,
  type SystemNotification,
  type NotificationType,
} from '../../services/notificationService';
import {
  Bell,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  Bluetooth,
  Clock,
  CheckCheck,
  Trash2,
} from 'lucide-react';
import type { NavigationTab } from '../../types';
import { validateFirestoreReadAuth } from '../../services/firestoreAuthGuard';

export interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  notifications: SystemNotification[];
  isLoading?: boolean;
  error?: string | null;
  onNavigate?: (tab: NavigationTab) => void;
}

const getTypeIcon = (type: NotificationType) => {
  switch (type) {
    case 'TEST_REMINDER':
      return <Clock className="w-4 h-4 text-blue-500 shrink-0" />;
    case 'TEST_COMPLETED':
      return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
    case 'TEST_MISSED':
    case 'QA_MISSED':
      return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
    case 'DEVICE':
      return <Bluetooth className="w-4 h-4 text-indigo-500 shrink-0" />;
    case 'QA_PENDING':
      return <Calendar className="w-4 h-4 text-purple-500 shrink-0" />;
    case 'TEST_REPORT_READY':
    case 'DAY_REPORT_READY':
    case 'WEEK_REPORT_READY':
    case 'MONTH_REPORT_READY':
      return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
    case 'QA_REQUIRED':
      return <Calendar className="w-4 h-4 text-purple-500 shrink-0" />;
    case 'ASSESSMENT_MISSED':
      return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
    case 'HEALTH_RISK':
    case 'CRITICAL':
      return <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />;
    case 'EMERGENCY':
      return <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />;
    case 'SYSTEM':
    default:
      return <span aria-label="GOATEST" className="w-6 h-6 rounded-md bg-[#263238] text-white flex items-center justify-center text-[10px] font-black tracking-tight shrink-0">GT</span>;
  }
};

const getTypeLabel = (type: NotificationType): string => {
  switch (type) {
    case 'TEST_REMINDER':
      return 'Reminder';
    case 'TEST_COMPLETED':
      return 'Assessment';
    case 'TEST_MISSED':
      return 'Missed';
    case 'QA_PENDING':
      return 'QA Schedule';
    case 'QA_MISSED':
      return 'QA Alert';
    case 'DEVICE':
      return 'Device';
    case 'TEST_REPORT_READY':
      return 'TEST report';
    case 'DAY_REPORT_READY':
      return 'DAY report';
    case 'WEEK_REPORT_READY':
      return 'WEEK report';
    case 'MONTH_REPORT_READY':
      return 'MONTH report';
    case 'QA_REQUIRED':
      return 'Daily Q/A';
    case 'ASSESSMENT_MISSED':
      return 'Assessment missed';
    case 'HEALTH_RISK':
      return 'Health risk';
    case 'CRITICAL':
      return 'Critical';
    case 'EMERGENCY':
      return 'Emergency';
    case 'SYSTEM':
    default:
      return 'System';
  }
};

const notificationTitle = (item: SystemNotification) => {
  if (item.title && item.title !== 'Notification' && item.title !== 'System') return item.title;
  const prefix = item.recipientRole === 'CARETAKER' ? 'MONITORED USER ' : '';
  return `${prefix}${getTypeLabel(item.type).toUpperCase()}`;
};

const notificationBody = (item: SystemNotification) => {
  if (item.body?.trim()) return item.body;
  const subject = item.recipientRole === 'CARETAKER'
    ? item.sourceUserName || item.sourceUserPublicId || 'The monitored user'
    : 'Your';
  switch (item.type) {
    case 'TEST_COMPLETED':
    case 'TEST_REPORT_READY': return `${subject} physiological assessment was completed.`;
    case 'DAY_REPORT_READY': return `${subject} daily health report is ready to review.`;
    case 'WEEK_REPORT_READY': return `${subject} week report is ready to review.`;
    case 'MONTH_REPORT_READY': return `${subject} month report is ready to review.`;
    case 'QA_REQUIRED': return 'Three tests were completed today. Complete the daily Q/A to generate the day assessment.';
    case 'QA_PENDING': return 'Your daily Q/A session is waiting for completion.';
    case 'TEST_MISSED': return "Today's scheduled assessment was not completed on time.";
    case 'ASSESSMENT_MISSED': return item.body || "You missed your scheduled assessment.";
    default: return 'A new health monitoring event is available to review.';
  }
};

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  userId,
  notifications,
  onNavigate,
  isLoading = false,
  error = null,
}) => {
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = () => {
    void notificationService.markAllFirestoreAsRead(userId, notifications);
  };

  const handleDelete = (item: SystemNotification) => {
    notificationService.deleteNotification(userId, item.id);
  };

  const handleItemClick = async (item: SystemNotification) => {
    if (!item.read) {
      void notificationService.markFirestoreAsRead(userId, item.id);
    }
    const isBondNotification = item.type === 'SYSTEM' && item.title === 'Caretaker Connection' && item.actionTab === 'settings';
    const isCaretakerNotification = !isBondNotification && item.recipientRole === 'CARETAKER' && Boolean(item.sourceUserUid);
    if (isCaretakerNotification) {
      const authorization = validateFirestoreReadAuth('reports', item.sourceUserUid!);
      if (!authorization.allowed) {
        onClose();
        return;
      }
      if (typeof window !== 'undefined') window.sessionStorage.setItem('goatest:pending-report-source-uid', item.sourceUserUid!);
    }
    const tab = (isBondNotification
      ? 'settings'
      : isCaretakerNotification
      ? item.type === 'EMERGENCY' ? 'emergency' : item.type === 'ASSESSMENT_MISSED' ? 'home' : 'reports'
      : item.actionTab || ({ QA_REQUIRED: 'home', DAY_REPORT_READY: 'reports', TEST_REPORT_READY: 'reports', WEEK_REPORT_READY: 'reports', MONTH_REPORT_READY: 'reports', HEALTH_RISK: 'reports', CRITICAL: 'emergency', EMERGENCY: 'emergency' } as Record<string, NavigationTab>)[item.type]) as NavigationTab | undefined;
    if (item.type === 'QA_REQUIRED' && !isCaretakerNotification) window.dispatchEvent(new CustomEvent('goatest:open-daily-qa', { detail: { dayId: item.metadata?.dayId || item.metadata?.observationId } }));
    if (item.type === 'QA_REQUIRED' && !isCaretakerNotification && typeof window !== 'undefined') {
      window.sessionStorage.setItem('goatest:pending-qa-day-id', item.metadata?.dayId || item.metadata?.observationId || '');
    }
    if (item.reportId && typeof window !== 'undefined') {
      window.sessionStorage.setItem('goatest:pending-report-id', item.reportId);
    }
    if (tab && onNavigate) onNavigate(tab);
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="NOTIFICATIONS"
      description={unreadCount > 0 ? `${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
    >
      <div className="flex flex-col gap-3 py-1 text-left max-h-[60vh] overflow-y-auto">
        {/* Actions bar */}
        {notifications.length > 0 && (
          <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800 text-xs">
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium transition-colors cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>
          </div>
        )}

        {/* List of notifications */}
        {isLoading ? (
          <div className="py-8 text-center text-xs text-zinc-400">Loading notifications...</div>
        ) : error ? (
          <div className="py-8 text-center text-xs text-zinc-400">Notifications are temporarily unavailable.</div>
        ) : notifications.length === 0 ? (
          <div className="py-8 text-center flex flex-col items-center justify-center gap-2 text-zinc-400">
            <Bell className="w-8 h-8 opacity-30" />
            <p className="text-xs">No notifications</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  item.read
                    ? 'bg-zinc-100/60 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800/80 opacity-75'
                    : 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 shadow-xs'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5">{getTypeIcon(item.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h5 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                        {notificationTitle(item)}
                      </h5>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-zinc-400 font-medium">{getTypeLabel(item.type)}</span>
                        <button type="button" aria-label={`Delete ${notificationTitle(item)}`} title="Delete notification" onClick={(event) => { event.stopPropagation(); handleDelete(item); }} className="min-w-11 min-h-11 flex items-center justify-center rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      {notificationBody(item)}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-400">
                      <span>{item.read ? 'Read' : 'Unread'} · {new Date(item.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      {!item.read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
