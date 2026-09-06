/**
 * GOATEST Home Greeting & Identity Component
 * 
 * Uses real authenticated profile data.
 * Time-of-day contextual greeting.
 * Full universal theme contrast support.
 */

import React from 'react';
import { Badge } from '../ui/Badge';
import type { UserProfile, UserRole } from '../../types';

export interface HomeGreetingProps {
  userProfile: UserProfile | null;
  role: UserRole;
  notificationCount: number;
  onOpenNotifications?: () => void;
}

function getTimeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getFormattedDate(): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date());
}

export const HomeGreeting: React.FC<HomeGreetingProps> = ({
  userProfile,
  role,
}) => {
  const greeting = getTimeOfDayGreeting();
  const displayName = userProfile?.displayName?.trim() || userProfile?.email?.split('@')[0] || 'Member';
  const formattedDate = getFormattedDate();

  return (
    <div className="flex items-start justify-between gap-3 text-left">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#cfd8dc]">
            {formattedDate}
          </span>
          <Badge variant={role === 'CARETAKER' ? 'caretaker' : 'user'} size="sm">
            {role}
          </Badge>
        </div>

        <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">
          {greeting}, <span className="text-[var(--color-accent)]">{displayName}</span>
        </h1>
        <p className="text-xs text-[#cfd8dc] mt-0.5 font-medium">
          {role === 'CARETAKER'
            ? 'Monitored Health Console'
            : 'Personal Physiological Hub'}
        </p>
      </div>

    </div>
  );
};
