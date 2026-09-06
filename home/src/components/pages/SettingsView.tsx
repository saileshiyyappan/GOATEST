/**
 * GOATEST Settings View
 * 
 * Clean settings view with:
 * - Color Picker for custom accent color
 * - Caretaker management (when role is Caretaker)
 * - Account Profile & Sign Out
 * - Clean UI without internal database configuration controls
 */

import React, { useEffect, useState, useRef } from 'react';
import { useTheme, ACCENT_PRESETS, getAccessibleTextColor } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PageHeader, SectionHeader } from '../ui/PageHeader';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { EmergencyContactsSection } from '../settings/EmergencyContactsSection';
import { LocationSettingsSection } from '../settings/LocationSettingsSection';
import { NotificationSettingsSection } from '../settings/NotificationSettingsSection';
import { ScheduleSettingsSection } from '../settings/ScheduleSettingsSection';
import { AiConfigurationSection } from '../settings/AiConfigurationSection';
import { userService } from '../../services/userService';
import type { CaretakerConnection } from '../../types';
import {
  Palette,
  LogOut,
  RotateCcw,
  Check,
  Pipette,
  User,
} from 'lucide-react';

export interface SettingsViewProps {
  onSignOut: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onSignOut,
}) => {
  const { accentColor, setAccentColor, setPrimaryColor, resetToDefaults } = useTheme();
  const { userProfile, role, currentUser, reloadProfile } = useAuth();
  const { addToast } = useToast();

  const [selectedColor, setSelectedColor] = useState<string>(accentColor);
  const [caretakerId, setCaretakerId] = useState('');
  const [caretakerName, setCaretakerName] = useState('');
  const [isBondingCaretaker, setIsBondingCaretaker] = useState(false);
  const [linkedCaretakers, setLinkedCaretakers] = useState<CaretakerConnection[]>([]);
  const [caretakerRefreshError, setCaretakerRefreshError] = useState(false);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const refreshCaretakerLinks = async (options?: {
    preserve?: CaretakerConnection[];
    excludePublicIds?: Set<string>;
  }): Promise<boolean> => {
    if (role !== 'USER' || !currentUser) return false;
    try {
      const refreshed = (await userService.getCaretakerLinks(currentUser.uid))
        .filter((item) => !options?.excludePublicIds?.has(item.caretakerPublicId?.toUpperCase() || ''));
      if (refreshed.length > 0 || !options?.preserve?.length) {
        setLinkedCaretakers(refreshed);
        setCaretakerRefreshError(false);
      } else {
        setCaretakerRefreshError(true);
      }
      return true;
    } catch {
      if (options?.preserve?.length) setLinkedCaretakers(options.preserve);
      setCaretakerRefreshError(true);
      return false;
    }
  };

  useEffect(() => { void refreshCaretakerLinks(); }, [currentUser?.uid, role]);

  const handleAddCaretaker = async () => {
    if (!currentUser) return;
    if (!caretakerName.trim()) {
      addToast({ title: 'Caretaker Not Added', description: 'Enter a caretaker name.', type: 'error' });
      return;
    }
    setIsBondingCaretaker(true);
    try {
      const linked = await userService.linkCaretakerByPublicId(currentUser.uid, caretakerId, caretakerName);
      setCaretakerId('');
      setCaretakerName('');
      const canonicalRows = linkedCaretakers.some((item) => item.caretakerUid === linked.caretakerUid)
        ? linkedCaretakers
        : [...linkedCaretakers, linked];
      setLinkedCaretakers(canonicalRows);
      setCaretakerRefreshError(false);
      await refreshCaretakerLinks({ preserve: canonicalRows });
      addToast({ title: 'Caretaker Added', description: `${linked.caretakerName} can now view your authorized reports.`, type: 'success' });
    } catch (error) {
      addToast({ title: 'Caretaker Not Added', description: error instanceof Error ? error.message : 'Check the six-character caretaker ID and try again.', type: 'error' });
    } finally { setIsBondingCaretaker(false); }
  };

  const handleRemoveCaretaker = async () => {
    if (!currentUser) return;
    setIsBondingCaretaker(true);
    try {
      await userService.unlinkCaretakerByPublicId(currentUser.uid, caretakerId);
      const removedPublicId = caretakerId.trim().toUpperCase();
      setCaretakerId('');
      setLinkedCaretakers((current) => current.filter((item) => item.caretakerPublicId?.toUpperCase() !== removedPublicId));
      await refreshCaretakerLinks({ excludePublicIds: new Set([removedPublicId]) });
      addToast({ title: 'Caretaker Removed', description: 'The caretaker can no longer access your reports.', type: 'success' });
    } catch (error) {
      addToast({ title: 'Caretaker Not Removed', description: error instanceof Error ? error.message : 'Check the caretaker ID and try again.', type: 'error' });
    } finally { setIsBondingCaretaker(false); }
  };

  const handleRemoveCaretakerById = async (publicId: string) => {
    if (!currentUser) return;
    setIsBondingCaretaker(true);
    try {
      await userService.unlinkCaretakerByPublicId(currentUser.uid, publicId);
      const removedPublicId = publicId.trim().toUpperCase();
      setLinkedCaretakers((current) => current.filter((item) => item.caretakerPublicId?.toUpperCase() !== removedPublicId));
      await refreshCaretakerLinks({ excludePublicIds: new Set([removedPublicId]) });
      addToast({ title: 'Caretaker Removed', description: 'The caretaker can no longer access your reports.', type: 'success' });
    } catch (error) {
      addToast({ title: 'Caretaker Not Removed', description: error instanceof Error ? error.message : 'Caretaker removal failed.', type: 'error' });
    } finally { setIsBondingCaretaker(false); }
  };

  const handleApplyColor = (colorToApply: string) => {
    setAccentColor(colorToApply);
    addToast({
      title: 'Color Applied',
      description: 'Accent color updated globally.',
      type: 'success',
    });
  };

  return (
    <div className="flex flex-col gap-5 text-left pb-6">
      <PageHeader
        title="SETTINGS"
        subtitle="Colors & account preferences"
      />

      <AiConfigurationSection />

      {/* Custom Accent Color */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionHeader title="Accent Color" className="mb-0" />
          <button
            type="button"
            onClick={resetToDefaults}
            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>

        <Card padding="md" className="flex flex-col gap-3.5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Select an accent color for buttons, navigation, and highlights:
          </p>

          {/* Preset Swatches */}
          <div className="grid grid-cols-7 gap-2">
            {ACCENT_PRESETS.map((preset) => {
              const isSelected = accentColor.toLowerCase() === preset.accent.toLowerCase();
              return (
                <button
                  type="button"
                  key={preset.id}
                  onClick={() => {
                    setSelectedColor(preset.accent);
                    setAccentColor(preset.accent);
                    setPrimaryColor(preset.primary);
                  }}
                  title={preset.name}
                  className={`h-10 rounded-xl flex items-center justify-center transition-all ${
                    isSelected
                      ? 'ring-2 ring-offset-2 ring-slate-800 dark:ring-white scale-105 shadow-md'
                      : 'hover:scale-95'
                  }`}
                  style={{ backgroundColor: preset.accent }}
                >
                  {isSelected && (
                    <Check
                      className="w-4 h-4"
                      style={{ color: getAccessibleTextColor(preset.accent) }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Custom Color Selector */}
          <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {/* Visible Swatch with overlaid input */}
              <div
                className="relative w-9 h-9 rounded-xl shadow-xs border border-slate-200 dark:border-zinc-700 flex items-center justify-center cursor-pointer overflow-hidden"
                style={{ backgroundColor: selectedColor }}
                title="Choose custom color"
              >
                <Pipette className="w-4 h-4 pointer-events-none" style={{ color: getAccessibleTextColor(selectedColor) }} />
                <input
                  ref={colorInputRef}
                  type="color"
                  value={selectedColor}
                  onChange={(e) => {
                    setSelectedColor(e.target.value);
                    setAccentColor(e.target.value);
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer p-0 m-0 border-0"
                  aria-label="Custom color picker"
                />
              </div>

              {/* Choose Color Button with overlaid input */}
              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  leftIcon={<Palette className="w-3.5 h-3.5" />}
                  className="text-xs pointer-events-none"
                >
                  Choose Color
                </Button>
                <input
                  type="color"
                  value={selectedColor}
                  onChange={(e) => {
                    setSelectedColor(e.target.value);
                    setAccentColor(e.target.value);
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer p-0 m-0 border-0"
                  aria-label="Choose color"
                />
              </div>

              <span className="text-[11px] font-mono font-semibold text-slate-600 dark:text-zinc-400">
                {selectedColor.toUpperCase()}
              </span>
            </div>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => handleApplyColor(selectedColor)}
              className="text-xs font-semibold shrink-0"
            >
              Apply
            </Button>
          </div>
        </Card>
      </div>

      {/* Section 3: Emergency Contacts (PMT-6 Part 4) */}
      {currentUser && (
        <div>
          <EmergencyContactsSection userId={currentUser.uid} />
        </div>
      )}

      {/* Section 4: Location & GPS (PMT-6 Part 5) */}
      {currentUser && (
        <div>
          <LocationSettingsSection userId={currentUser.uid} />
        </div>
      )}

      {/* Section 5: Notification Preferences (PMT-6 Part 6 & 7) */}
      {currentUser && (
        <div>
          <NotificationSettingsSection userId={currentUser.uid} />
        </div>
      )}

      {/* Section 6: Assessment Schedules (PMT-6 Part 8) */}
      {currentUser && (
        <div>
          <ScheduleSettingsSection userId={currentUser.uid} />
        </div>
      )}

      {/* Section 7: User-initiated caretaker bond. */}
      {role === 'USER' && (
        <div>
          <SectionHeader title="Caretaker Access" />
          <Card padding="md" className="flex flex-col gap-2.5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Add a caretaker using their six-character account ID. Only you can initiate or remove this access.</p>
            <div className="flex flex-col gap-2">
              <Input label="Caretaker ID" aria-label="Caretaker account ID" placeholder="ABC234" value={caretakerId} maxLength={6} onChange={(event) => setCaretakerId(event.target.value.toUpperCase())} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void handleAddCaretaker(); } }} className="uppercase font-mono tracking-widest" />
              <Input label="Caretaker Name" aria-label="Caretaker name" placeholder="Enter caretaker name" value={caretakerName} maxLength={80} onChange={(event) => setCaretakerName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void handleAddCaretaker(); } }} />
              <div className="flex gap-2">
                <Button type="button" variant="primary" size="sm" onClick={() => void handleAddCaretaker()} disabled={caretakerId.trim().length !== 6 || isBondingCaretaker} isLoading={isBondingCaretaker}>Add Caretaker</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => void handleRemoveCaretaker()} disabled={caretakerId.trim().length !== 6 || isBondingCaretaker}>Remove</Button>
              </div>
            </div>
            {linkedCaretakers.length > 0 && (
              <div className="mt-1 flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Connected caretakers</span>
                {linkedCaretakers.map((caretaker) => (
                  <div key={caretaker.caretakerUid} className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-slate-500 dark:text-slate-400">caretaker : {caretaker.caretakerPublicId || 'ID unavailable'}</div>
                      <div className="font-medium text-slate-800 dark:text-slate-200">Name: {caretaker.caretakerName || 'Name unavailable'}</div>
                    </div>
                    {caretaker.caretakerPublicId && <Button type="button" variant="outline" size="sm" onClick={() => void handleRemoveCaretakerById(caretaker.caretakerPublicId!)} disabled={isBondingCaretaker}>Remove</Button>}
                  </div>
                ))}
              </div>
            )}
            {caretakerRefreshError && (
              <p role="status" className="text-[11px] text-amber-700 dark:text-amber-300">Unable to refresh caretaker connections.</p>
            )}
          </Card>
        </div>
      )}

      {/* Section 8: Caretaker Connections (read-only; bonds are user-initiated) */}
      {role === 'CARETAKER' && (
        <div>
          <SectionHeader title="Caretaker Connections" />
          <Card padding="md" className="flex flex-col gap-2.5">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Users add or remove caretaker access from their own Settings. Your authorized connections appear here.
            </p>
            {(userProfile?.monitoredUsers || []).length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {(userProfile?.monitoredUsers || []).map((monitoredUser) => (
                  <div key={monitoredUser.firebaseUid || monitoredUser.uniqueId} className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{monitoredUser.name || 'User'}</span>
                    <span className="font-mono text-slate-500 dark:text-slate-400">{monitoredUser.uniqueId}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">No users have authorized this account yet.</p>
            )}
          </Card>
        </div>
      )}

      {/* Section 9: Account & Sign Out */}
      <div>
        <SectionHeader title="Account" />
        <Card padding="md" className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              <span>Signed in as:</span>
            </div>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {currentUser?.email || userProfile?.email || 'User'}
            </span>
          </div>

          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={onSignOut}
            leftIcon={<LogOut className="w-3.5 h-3.5" />}
            className="mt-2"
          >
            Sign Out
          </Button>
        </Card>
      </div>
    </div>
  );
};
