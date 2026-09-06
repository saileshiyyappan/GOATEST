/**
 * GOATEST Edit Profile Modal
 * 
 * Allows users to:
 * - Update their Display Name / User Name
 * - Select from emoji/sticker avatars
 * - Submit and persist changes directly to Firestore & Firebase Auth
 */

import React, { useRef, useState } from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  User,
  Check,
  Loader2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { profileImageStorage } from '../../services/profileImageStorage';

export interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Non-human profile stickers. These are persisted in Firestore, not Firebase Auth photoURL.
export const PRESET_AVATARS = [
  { id: 'sticker-sun', label: 'Sun', value: '☀️' },
  { id: 'sticker-leaf', label: 'Leaf', value: '🌿' },
  { id: 'sticker-heart', label: 'Heart', value: '💙' },
  { id: 'sticker-star', label: 'Star', value: '⭐' },
  { id: 'sticker-moon', label: 'Moon', value: '🌙' },
  { id: 'sticker-sparkle', label: 'Sparkle', value: '✨' },
];

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const { userProfile, currentUser, updateUserProfile } = useAuth();
  const { addToast } = useToast();

  const currentDisplayName = userProfile?.displayName || currentUser?.displayName || '';
  const storedAvatar = userProfile?.photoURL || '';
  const currentPhotoURL = storedAvatar && !/^https?:\/\//i.test(storedAvatar) ? storedAvatar : '';

  const [displayName, setDisplayName] = useState<string>(currentDisplayName);
  const [photoURL, setPhotoURL] = useState<string>(currentPhotoURL);
  const [devicePreview, setDevicePreview] = useState<string>('');
  const [deviceFileName, setDeviceFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);


  // Sync state whenever modal opens
  React.useEffect(() => {
    if (isOpen) {
      setDisplayName(userProfile?.displayName || currentUser?.displayName || '');
      const stored = userProfile?.photoURL || '';
      setPhotoURL(stored && !/^https?:\/\//i.test(stored) ? stored : '');
      setDevicePreview('');
      setDeviceFileName('');
      setErrorMessage(null);
      if (currentUser?.uid) void profileImageStorage.load(currentUser.uid).then((image) => { if (image) setDevicePreview(image); });
    }
  }, [isOpen, userProfile, currentUser]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = displayName.trim();

    if (!cleanName) {
      setErrorMessage('User name cannot be empty.');
      return;
    }

    if (cleanName.length < 2) {
      setErrorMessage('User name must be at least 2 characters.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const remotePhotoUrl = devicePreview && currentUser?.uid
        ? await profileImageStorage.commit(currentUser.uid, devicePreview)
        : null;
      await updateUserProfile({
        displayName: cleanName,
        photoURL: remotePhotoUrl || (devicePreview ? '' : photoURL || ''),
      });

      addToast({
        title: 'Profile Updated',
        description: devicePreview ? (remotePhotoUrl ? 'Profile image saved to your account.' : 'Profile image saved on this device.') : 'Your user name and profile sticker were saved.',
        type: 'success',
      });

      onClose();
    } catch (err) {
      console.error('[EditProfileModal] Save error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to update profile';
      setErrorMessage(`Saved on this device; cloud sync is pending. ${msg}`);
      addToast({
        title: 'Saved on This Device',
        description: 'The image remains available offline; cloud sync could not be completed.',
        type: 'info',
      });
      if (devicePreview) onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const userInitial = displayName.trim().charAt(0).toUpperCase() || 'U';

  const handleDeviceImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrorMessage('Choose a JPG, PNG, or WebP image.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDevicePreview(reader.result);
        setDeviceFileName(file.name);
        setErrorMessage(null);
        if (currentUser?.uid) void profileImageStorage.savePending(currentUser.uid, reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Profile"
      description="Update your user name and profile picture stored in the database."
      maxWidth="md"
    >
      <form onSubmit={handleSave} className="flex flex-col gap-5 text-left">
        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-900/30 border border-red-500/50 flex items-start gap-2.5 text-xs text-red-200">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Emoji/sticker avatar manager: no human images or Firebase Auth photo URLs. */}
        <div className="flex flex-col gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-[#263238]">Profile Sticker</label>
          <div className="flex items-center gap-4 p-3 rounded-2xl bg-[#78909c] border border-[#263238]">
            <div className="shrink-0 w-20 h-20 rounded-2xl bg-[#90a4ae] border-2 border-[#263238] flex items-center justify-center shadow-md">
              {devicePreview ? <img src={devicePreview} alt="Selected local profile preview" className="w-full h-full rounded-2xl object-cover" /> : <span className="text-4xl" aria-label="Selected profile sticker">{photoURL || userInitial}</span>}
            </div>
            <p className="text-[11px] text-[#263238] font-medium leading-tight">Choose a sticker or preview an image from this device. Remote image storage is not configured, so local images are not uploaded.</p>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {PRESET_AVATARS.map((preset) => {
              const isSelected = photoURL === preset.value;
              return <button key={preset.id} type="button" onClick={() => { setPhotoURL(preset.value); setDevicePreview(''); setDeviceFileName(''); setErrorMessage(null); }} title={preset.label} aria-label={preset.label} className={`relative w-full aspect-square rounded-xl border-2 text-2xl transition-all cursor-pointer ${isSelected ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)] scale-105' : 'border-[#263238] hover:border-white'}`}>
                {preset.value}{isSelected && <span className="absolute inset-0 bg-[var(--color-accent)]/30 flex items-center justify-center"><Check className="w-4 h-4 text-white" /></span>}
              </button>;
            })}
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleDeviceImage} className="hidden" />
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="bg-[#90a4ae] text-[#263238] border-[#263238] font-bold">
            Choose From Device
          </Button>
          {deviceFileName && <span className="text-[10px] text-[#37474f] font-medium break-words">Preview: {deviceFileName} (not uploaded)</span>}
        </div>

        {/* Display Name / User Name Input */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="profile-display-name-input"
            className="text-xs font-bold uppercase tracking-wider text-[#263238]"
          >
            User Name / Display Name
          </label>

          <Input
            id="profile-display-name-input"
            type="text"
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              setErrorMessage(null);
            }}
            placeholder="e.g. Dr. Alex Vance, Jane Doe"
            leftIcon={<User className="w-4 h-4 text-[#263238]" />}
            required
            className="bg-white text-zinc-900 border border-[#263238] font-bold"
          />

          <span className="text-[11px] text-[#37474f] font-medium">
            This name will be displayed across your greeting console, test records, and reports.
          </span>
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-[#263238] flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => { if (currentUser?.uid) void profileImageStorage.discardPending(currentUser.uid); onClose(); }}
            disabled={isSaving}
            className="bg-[#78909c] text-[#263238] border-[#263238] font-bold"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={isSaving || !displayName.trim()}
            leftIcon={
              isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Sparkles className="w-4 h-4 text-white" />
              )
            }
            className="bg-[#263238] text-white hover:bg-[#1f292e] border border-[#263238] font-bold min-w-[140px]"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
