/**
 * GOATEST Profile View
 * 
 * Clean & minimal profile screen:
 * - Display Name
 * - Email Address
 * - 6-character User ID (e.g. A7K29Q)
 * - Role (USER / CARETAKER)
 * - PHB actions: [ Generate PHB ], [ View PHB ] (when verified)
 * - Account Actions: Settings, Sign Out
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { phbService } from '../../services/phbService';
import { PageHeader, SectionHeader } from '../ui/PageHeader';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { PhbDetailModal } from './PhbDetailModal';
import { EditProfileModal } from '../profile/EditProfileModal';
import { profileImageStorage } from '../../services/profileImageStorage';
import {
  FileSpreadsheet,
  ExternalLink,
  Eye,
  LogOut,
  Settings,
  Copy,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Loader2,
  Edit2,
  Camera,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import type { NavigationTab } from '../../types';

export interface ProfileViewProps {
  onNavigate: (tab: NavigationTab) => void;
  onSignOut: () => void;
  onOpenPhbSetup?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  onNavigate,
  onSignOut,
  onOpenPhbSetup,
}) => {
  const { currentUser, userProfile, role, phbRecord, isPhbLoading, phbError, refreshPhb } = useAuth();
  const { addToast } = useToast();
  const [isPhbDetailOpen, setIsPhbDetailOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);
  useEffect(() => {
    const uid = currentUser?.uid;
    if (!uid) return;
    void profileImageStorage.load(uid).then(setLocalPhoto);
    return profileImageStorage.subscribe(uid, setLocalPhoto);
  }, [currentUser?.uid]);

  const isPhbAvailable = Boolean(phbRecord);
  const userDisplayId = userProfile?.displayId || '------';
  const profilePhoto = localPhoto || userProfile?.photoURL || currentUser?.photoURL;
  const displayName = userProfile?.displayName || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';

  const handleCopyId = () => {
    navigator.clipboard?.writeText(userDisplayId);
    addToast({
      title: 'User ID Copied',
      description: `Copied ${userDisplayId} to clipboard.`,
      type: 'success',
    });
  };

  const handleUpdatePhb = () => {
    phbService.openPhbWebApp();
  };

  const handleViewPhb = () => {
    setIsPhbDetailOpen(true);
  };

  const handleRetryPhb = async () => {
    await refreshPhb();
  };

  return (
    <div className="flex flex-col gap-4 text-left pb-6">
      <PageHeader
        title="USER PROFILE"
        subtitle="Account information & preferences"
      />

      {/* Main Profile Info Card */}
      <Card padding="lg" className="flex flex-col gap-4">
        <div className="flex items-center gap-3.5">
          {/* Avatar with click-to-edit */}
          <div className="relative group shrink-0 w-16 h-16 rounded-2xl bg-[#90a4ae] text-[#263238] border-2 border-[#263238] overflow-hidden flex items-center justify-center font-black text-2xl shadow-sm">
            {profilePhoto && /^(https?:\/\/|data:image\/)/i.test(profilePhoto) ? (
              <img
                src={profilePhoto}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            ) : profilePhoto ? (
              <span className="text-4xl" aria-label="Profile sticker">{profilePhoto}</span>
            ) : (
              <span>{displayName.charAt(0).toUpperCase()}</span>
            )}

            {/* Hover / Tap Edit Overlay */}
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer"
              title="Edit Profile Picture"
            >
              <Camera className="w-5 h-5" />
              <span className="text-[9px] font-bold mt-0.5">Edit</span>
            </button>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                {displayName}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="shrink-0 px-2 py-0.5 rounded-md bg-[#6d6969] text-[#e6ecef] border border-[#263238] hover:bg-[#5a5656] text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                title="Edit User Name & Avatar"
              >
                <Edit2 className="w-3 h-3 text-[var(--color-accent)]" />
                <span className="text-[#e6ecef]">Edit</span>
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {currentUser?.email || userProfile?.email || 'user@domain.com'}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant={role === 'CARETAKER' ? 'caretaker' : 'user'} size="sm">
                {role === 'CARETAKER' ? 'Caretaker' : 'User'}
              </Badge>
            </div>
          </div>
        </div>

        {/* 6-Character User ID & Details */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">User ID</span>
            <button
              type="button"
              onClick={handleCopyId}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-mono font-bold text-xs text-slate-900 dark:text-slate-100 transition-colors cursor-pointer"
              title="Click to copy User ID"
            >
              <span>{userDisplayId}</span>
              <Copy className="w-3 h-3 text-slate-400" />
            </button>
          </div>

          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span>Member Since</span>
            <span className="text-slate-800 dark:text-slate-200 font-medium">
              {userProfile?.createdAt
                ? new Date(userProfile.createdAt).toLocaleDateString()
                : 'Active Member'}
            </span>
          </div>

          {role === 'CARETAKER' && (
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span>Monitored Users</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {userProfile?.monitoredUserIds?.length || 0} Connected
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Personal Health Baseline (PHB) Section */}
      <SectionHeader title="Personal Health Baseline (PHB)" />
      <Card padding="md" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Personal Health Baseline
            </span>
          </div>

          {/* Status Indicator */}
          <div className="inline-flex items-center gap-1 text-[11px] font-semibold">
            {isPhbLoading ? (
              <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--color-accent)]" />
                <span>Loading PHB...</span>
              </span>
            ) : phbError && !isPhbAvailable ? (
              <span className="inline-flex items-center gap-1 text-rose-500">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Unable to load PHB</span>
              </span>
            ) : isPhbAvailable ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>PHB available</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-slate-400 dark:text-slate-500">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>PHB not created</span>
              </span>
            )}
          </div>
        </div>

        {/* State Description */}
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {isPhbLoading
            ? 'Fetching Personal Health Baseline from database...'
            : phbError && !isPhbAvailable
            ? 'Could not connect to the database to load your Personal Health Baseline.'
            : isPhbAvailable
            ? `Baseline status: ${phbRecord?.status || 'ACTIVE'}. Reference established for physiological monitoring pipelines.`
            : 'Personal Health Baseline has not been created yet for this account.'}
        </p>

        {isPhbAvailable && phbRecord?.baselineFocus && (
          <div className="flex flex-wrap gap-1.5 py-1">
            {phbRecord.baselineFocus.map((focus) => (
              <span
                key={focus}
                className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300"
              >
                {focus}
              </span>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1">
          {isPhbLoading ? (
            <Button
              variant="outline"
              size="sm"
              disabled
              leftIcon={<Loader2 className="w-3.5 h-3.5 animate-spin" />}
              className="text-xs flex-1"
            >
              Loading PHB...
            </Button>
          ) : phbError && !isPhbAvailable ? (
            <Button
              variant="primary"
              size="sm"
              onClick={handleRetryPhb}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              className="text-xs flex-1"
            >
              Retry
            </Button>
          ) : isPhbAvailable ? (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={handleViewPhb}
                leftIcon={<Eye className="w-3.5 h-3.5" />}
                className="text-xs flex-1"
              >
                View PHB
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleUpdatePhb}
                leftIcon={<ExternalLink className="w-3.5 h-3.5" />}
                className="text-xs flex-1"
              >
                Update PHB
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleUpdatePhb}
              leftIcon={<ExternalLink className="w-3.5 h-3.5" />}
              className="text-xs flex-1"
            >
              Update PHB
            </Button>
          )}
        </div>
      </Card>

      {/* Account Actions */}
      <SectionHeader title="Account Actions" />
      <div className="flex flex-col gap-2">
        <Button
          variant="secondary"
          size="md"
          onClick={() => onNavigate('settings')}
          leftIcon={<Settings className="w-4 h-4" />}
          fullWidth
        >
          Settings
        </Button>

        <Button
          variant="danger"
          size="md"
          onClick={onSignOut}
          leftIcon={<LogOut className="w-4 h-4" />}
          fullWidth
        >
          Sign Out
        </Button>
      </div>

      {/* In-App PHB Viewer Modal */}
      <PhbDetailModal
        isOpen={isPhbDetailOpen}
        onClose={() => setIsPhbDetailOpen(false)}
        phbRecord={phbRecord}
        isLoading={isPhbLoading}
        error={phbError}
        onRetry={handleRetryPhb}
        onUpdatePhb={handleUpdatePhb}
      />

      {/* Edit Profile Modal (User Name & Profile Picture) */}
      <EditProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
      />
    </div>
  );
};
