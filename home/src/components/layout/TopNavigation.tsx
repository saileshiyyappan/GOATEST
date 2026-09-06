/**
 * GOATEST Reusable Top Navigation
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Bell, User as UserIcon, Bluetooth } from 'lucide-react';
import { BrandLogo } from '../ui/BrandLogo';
import type { NavigationTab } from '../../types';
import { profileImageStorage } from '../../services/profileImageStorage';

export interface TopNavigationProps {
  activeTab: NavigationTab;
  onNavigate: (tab: NavigationTab) => void;
  onOpenNotifications?: () => void;
  onOpenDeviceStatus?: () => void;
  unreadCount?: number;
}

export const TopNavigation: React.FC<TopNavigationProps> = ({
  activeTab,
  onNavigate,
  onOpenNotifications,
  onOpenDeviceStatus,
  unreadCount = 0,
}) => {
  const { userProfile, currentUser } = useAuth();
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);
  useEffect(() => {
    const uid = currentUser?.uid;
    if (!uid) return;
    void profileImageStorage.load(uid).then(setLocalPhoto);
    return profileImageStorage.subscribe(uid, setLocalPhoto);
  }, [currentUser?.uid]);
  const profilePhoto = localPhoto || userProfile?.photoURL || currentUser?.photoURL || '';

  const getInitials = () => {
    if (userProfile?.displayName && userProfile.displayName.trim() !== 'User') {
      const parts = userProfile.displayName.trim().split(/\s+/);
      if (parts.length >= 2 && parts[0] && parts[1]) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      if (parts[0]) {
        return parts[0].slice(0, 2).toUpperCase();
      }
    }
    return null;
  };

  const initials = getInitials();

  return (
    <header className="shrink-0 min-h-14 h-14 px-4 bg-[#141517] border-b border-[var(--color-border)] flex items-center justify-between z-20 select-none transition-colors">
      {/* Brand Title */}
      <button
        type="button"
        className="flex items-center gap-2 text-left focus:outline-none cursor-pointer"
        onClick={() => onNavigate('home')}
      >
        <BrandLogo size="md" />
      </button>

      {/* Action Badges & Buttons */}
      <div className="flex items-center gap-2">
        {/* Device Status Indicator */}
        <button
          type="button"
          onClick={onOpenDeviceStatus}
          title="Device Status"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#90a4ae] text-[#263238] border border-[#263238] text-xs font-semibold hover:bg-[#78909c] transition-colors"
        >
          <Bluetooth className="w-3.5 h-3.5 text-[#263238]" />
          <span className="text-[10px] uppercase font-bold tracking-wider">BLE</span>
        </button>

        {/* Notification Bell */}
        {onOpenNotifications && (
          <button
            type="button"
            onClick={onOpenNotifications}
          className="w-11 h-11 rounded-xl flex items-center justify-center text-[#eceff1] hover:bg-[#90a4ae]/20 transition-colors relative"
            title="Notifications"
          >
            <Bell className="w-4 h-4 text-[#eceff1]" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-3.5 h-3.5 px-0.5 rounded-full bg-[var(--color-accent)] text-[#070606] text-[9px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        )}

        {/* Profile Button */}
        <button
          type="button"
          onClick={() => onNavigate('profile')}
          className={`w-11 h-11 rounded-xl flex items-center justify-center border transition-all overflow-hidden ${
            activeTab === 'profile'
              ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white font-bold'
              : 'border-[#263238] bg-[#90a4ae] text-[#263238] hover:bg-[#78909c]'
          }`}
          title="Profile"
        >
          {/^(https?:\/\/|data:image\/)/i.test(profilePhoto) ? (
            <img
              src={profilePhoto}
              alt="Profile"
              className="w-full h-full rounded-xl object-cover"
            />
          ) : profilePhoto && !/^https?:\/\//i.test(profilePhoto) ? (
            <span className="text-lg" aria-label="Profile sticker">{profilePhoto}</span>
          ) : initials ? (
            <span className="text-[10px] font-bold tracking-tight">
              {initials}
            </span>
          ) : (
            <UserIcon className="w-4 h-4 text-[#263238]" />
          )}
        </button>
      </div>
    </header>
  );
};
