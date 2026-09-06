import React, { useState, useEffect } from 'react';
import {
  X,
  PhoneCall,
  Bell,
  MapPin,
  Volume2,
  Sliders,
  Radio,
  Video,
  Music,
  Check,
  Layers,
  FlaskConical,
  UserCheck,
} from 'lucide-react';
import { CribMode, CribSettingsState, CribMediaState } from '../types/crib';
import { CribPermissionMap, CaretakerContact } from '../types/cribEvents';
import { CRIB_THEMES } from '../themes/cribThemes';
import { CribPermissionManager } from '../services/crib/events/cribPermissionManager';
import { CribLocationService } from '../services/crib/events/cribLocationService';
import { CribAudioService } from '../services/crib/events/cribAudioService';
import { CribCallService } from '../services/crib/events/cribCallService';

interface CribSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode: CribMode;
  onSelectMode: (mode: CribMode) => void;
  settings: CribSettingsState;
  onUpdateSettings: (newSettings: Partial<CribSettingsState>) => void;
  mediaState: CribMediaState;
  onUpdateMediaState: (updates: Partial<CribMediaState>) => void;
  isTestTelemetryActive: boolean;
  onToggleTestTelemetry: (active: boolean) => void;
}

export const CribSettingsModal: React.FC<CribSettingsModalProps> = ({
  isOpen,
  onClose,
  currentMode,
  onSelectMode,
  settings,
  onUpdateSettings,
  mediaState,
  onUpdateMediaState,
  isTestTelemetryActive,
  onToggleTestTelemetry,
}) => {
  const [customMediaUrl, setCustomMediaUrl] = useState(mediaState.url || '');
  const [selectedMediaType, setSelectedMediaType] = useState<'video' | 'audio' | 'none'>(
    mediaState.type
  );
  const [permissions, setPermissions] = useState<CribPermissionMap>(
    CribPermissionManager.getAllPermissions()
  );
  const [caretakerPhone, setCaretakerPhone] = useState<string>(
    CribCallService.getCaretaker()?.phone || '+1 (555) 019-2834'
  );
  const [caretakerName, setCaretakerName] = useState<string>(
    CribCallService.getCaretaker()?.name || 'Primary Caretaker'
  );
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);

  useEffect(() => {
    const unsub = CribPermissionManager.subscribe((map) => {
      setPermissions(map);
    });
    return unsub;
  }, []);

  if (!isOpen) return null;

  const currentTheme = CRIB_THEMES[currentMode];

  const handleApplyMedia = () => {
    if (selectedMediaType === 'none' || !customMediaUrl.trim()) {
      onUpdateMediaState({
        type: 'none',
        url: null,
        title: 'NO ACTIVE MEDIA STREAM',
        isPlaying: false,
      });
      onUpdateSettings({ mediaType: 'none' });
    } else {
      onUpdateMediaState({
        type: selectedMediaType,
        url: customMediaUrl.trim(),
        title: selectedMediaType === 'video' ? 'Live Video Dispatch Feed' : 'Emergency Audio Radio',
        isPlaying: false,
      });
      onUpdateSettings({ mediaType: selectedMediaType });
    }
  };

  const handleLoadSampleVideo = () => {
    const sampleUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    setCustomMediaUrl(sampleUrl);
    setSelectedMediaType('video');
    onUpdateMediaState({
      type: 'video',
      url: sampleUrl,
      title: 'Emergency Medical Telemetry Protocol Video',
      isPlaying: false,
    });
    onUpdateSettings({ mediaType: 'video' });
  };

  const handleLoadSampleAudio = () => {
    const sampleAudioUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
    setCustomMediaUrl(sampleAudioUrl);
    setSelectedMediaType('audio');
    onUpdateMediaState({
      type: 'audio',
      url: sampleAudioUrl,
      title: 'Emergency Dispatch Audio Channel',
      isPlaying: false,
    });
    onUpdateSettings({ mediaType: 'audio' });
  };

  const handleClearMedia = () => {
    setCustomMediaUrl('');
    setSelectedMediaType('none');
    onUpdateMediaState({
      type: 'none',
      url: null,
      title: 'NO ACTIVE MEDIA STREAM',
      isPlaying: false,
    });
    onUpdateSettings({ mediaType: 'none' });
  };

  const handleRequestPermission = async (type: 'NOTIFICATIONS' | 'LOCATION' | 'AUDIO' | 'CALL') => {
    if (type === 'LOCATION') {
      setIsRequestingLocation(true);
      await CribLocationService.requestCurrentLocation();
      setIsRequestingLocation(false);
    } else if (type === 'AUDIO') {
      await CribAudioService.resumeAudioContext();
      await CribPermissionManager.requestPermission('AUDIO');
    } else {
      await CribPermissionManager.requestPermission(type);
    }
  };

  const handleSaveCaretaker = () => {
    if (caretakerPhone.trim()) {
      const contact: CaretakerContact = {
        id: 'caretaker-1',
        name: caretakerName.trim() || 'Emergency Contact',
        phone: caretakerPhone.trim(),
        relationship: 'Primary Caretaker',
        isPrimary: true,
      };
      CribCallService.setCaretaker(contact);
    } else {
      CribCallService.setCaretaker(null);
    }
  };

  const getLocationStatusBadge = () => {
    const locStatus = CribLocationService.getLastStatus();
    if (locStatus === 'LOCATION_READY') {
      return { text: 'LOCATION READY', color: 'bg-emerald-950 text-emerald-300 border-emerald-700' };
    }
    if (locStatus === 'LOCATION_PERMISSION_DENIED' || permissions.LOCATION === 'DENIED') {
      return { text: 'LOCATION PERMISSION DENIED', color: 'bg-red-950 text-red-300 border-red-700' };
    }
    if (locStatus === 'LOCATION_UNAVAILABLE' || permissions.LOCATION === 'UNAVAILABLE') {
      return { text: 'LOCATION UNAVAILABLE', color: 'bg-neutral-800 text-neutral-400 border-neutral-600' };
    }
    return { text: 'NOT REQUESTED', color: 'bg-blue-950 text-blue-300 border-blue-800' };
  };

  const getAudioStatusBadge = () => {
    const audioState = CribAudioService.getAudioState();
    if (audioState.audioStatus === 'AUDIO_READY') {
      return { text: 'AUDIO READY', color: 'bg-emerald-950 text-emerald-300 border-emerald-700' };
    }
    if (audioState.audioStatus === 'AUDIO_ACTION_REQUIRED') {
      return { text: 'AUDIO ACTION REQUIRED', color: 'bg-amber-950 text-amber-300 border-amber-700' };
    }
    if (audioState.audioStatus === 'AUDIO_MUTED') {
      return { text: 'MUTED', color: 'bg-neutral-800 text-neutral-400 border-neutral-600' };
    }
    return { text: 'UNAVAILABLE', color: 'bg-neutral-800 text-neutral-400 border-neutral-600' };
  };

  const locBadge = getLocationStatusBadge();
  const audBadge = getAudioStatusBadge();

  return (
    <div
      id="crib-settings-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crib-settings-modal-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div
        id="crib-settings-modal-content"
        className="w-full max-w-2xl bg-neutral-900 border border-white/20 rounded-2xl shadow-2xl overflow-hidden text-neutral-100 animate-in fade-in zoom-in-95 duration-200 my-auto"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-black/60 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-red-400" />
            <div>
              <h2 id="crib-settings-modal-title" className="text-base font-black uppercase tracking-wider text-white">
                CRIB Emergency Console Settings
              </h2>
              <p className="text-xs text-neutral-400 font-mono">
                Universal frame mode selection & device permission architecture
              </p>
            </div>
          </div>
          <button
            id="crib-settings-close-btn"
            type="button"
            onClick={onClose}
            aria-label="Close Settings"
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body content */}
        <div className="p-5 space-y-6 max-h-[75vh] overflow-y-auto font-sans">
          {/* SECTION 1: Mode Selector */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-4 h-4 text-neutral-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-neutral-300">
                1. Universal CRIB Emergency Mode
              </h3>
            </div>
            <p className="text-xs text-neutral-400 mb-3">
              Switch operational frame mode. The universal frame persists while colors and telemetry contexts adapt.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* SDCU */}
              <button
                type="button"
                onClick={() => onSelectMode('SDCU')}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  currentMode === 'SDCU'
                    ? 'border-red-500 bg-red-950/60 ring-2 ring-red-500/50 shadow-lg shadow-red-950/50'
                    : 'border-white/10 bg-black/40 hover:bg-black/60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-red-900/60 text-red-100 border border-red-700">
                    SDCU
                  </span>
                  {currentMode === 'SDCU' && <Check className="w-4 h-4 text-red-400" />}
                </div>
                <div>
                  <p className="text-xs font-bold text-white uppercase">Critical Urgency</p>
                  <p className="text-[11px] text-red-200/70 mt-0.5">High-contrast Red Theme</p>
                </div>
              </button>

              {/* SSB */}
              <button
                type="button"
                onClick={() => onSelectMode('SSB')}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  currentMode === 'SSB'
                    ? 'border-amber-500 bg-purple-950/60 ring-2 ring-purple-500/50 shadow-lg shadow-purple-950/50'
                    : 'border-white/10 bg-black/40 hover:bg-black/60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-purple-900/60 text-amber-200 border border-amber-600">
                    SSB
                  </span>
                  {currentMode === 'SSB' && <Check className="w-4 h-4 text-amber-400" />}
                </div>
                <div>
                  <p className="text-xs font-bold text-white uppercase">Unconscious State</p>
                  <p className="text-[11px] text-purple-200/70 mt-0.5">Organ / Neuro Theme</p>
                </div>
              </button>

              {/* DIAG */}
              <button
                type="button"
                onClick={() => onSelectMode('DIAG')}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  currentMode === 'DIAG'
                    ? 'border-cyan-500 bg-blue-950/60 ring-2 ring-cyan-500/50 shadow-lg shadow-blue-950/50'
                    : 'border-white/10 bg-black/40 hover:bg-black/60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-900/60 text-blue-100 border border-cyan-500">
                    DIAG
                  </span>
                  {currentMode === 'DIAG' && <Check className="w-4 h-4 text-cyan-400" />}
                </div>
                <div>
                  <p className="text-xs font-bold text-white uppercase">Diagnostic Console</p>
                  <p className="text-[11px] text-blue-200/70 mt-0.5">Cool Blue Telemetry Theme</p>
                </div>
              </button>
            </div>
          </div>

          {/* SECTION 2: Emergency Permissions Framework */}
          <div className="pt-4 border-t border-white/10">
            <h3 className="text-xs font-black uppercase tracking-wider text-neutral-300 mb-3">
              2. Emergency Permissions & Device Integration
            </h3>

            <div className="space-y-3">
              {/* Call Permission */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white/5 text-neutral-300">
                    <PhoneCall className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-white uppercase">CALL</p>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border bg-emerald-950 text-emerald-300 border-emerald-800">
                        {permissions.CALL}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      Emergency dialer dispatch to registered caretaker
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = permissions.CALL === 'GRANTED' ? 'DENIED' : 'GRANTED';
                    CribPermissionManager.updatePermission('CALL', next);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors ${
                    permissions.CALL === 'GRANTED'
                      ? 'bg-emerald-900/60 border-emerald-500 text-emerald-200'
                      : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white'
                  }`}
                >
                  {permissions.CALL === 'GRANTED' ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>

              {/* Notifications */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white/5 text-neutral-300">
                    <Bell className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-white uppercase">NOTIFICATIONS</p>
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                          permissions.NOTIFICATIONS === 'GRANTED'
                            ? 'bg-amber-950 text-amber-300 border-amber-800'
                            : permissions.NOTIFICATIONS === 'DENIED'
                            ? 'bg-red-950 text-red-300 border-red-800'
                            : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                        }`}
                      >
                        {permissions.NOTIFICATIONS}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      Real browser emergency push and caretaker alarm alerts
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRequestPermission('NOTIFICATIONS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors ${
                    permissions.NOTIFICATIONS === 'GRANTED'
                      ? 'bg-amber-900/60 border-amber-500 text-amber-200'
                      : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                  }`}
                >
                  {permissions.NOTIFICATIONS === 'GRANTED' ? 'GRANTED' : 'REQUEST PERMISSION'}
                </button>
              </div>

              {/* Location */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white/5 text-neutral-300">
                    <MapPin className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-white uppercase">LOCATION</p>
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${locBadge.color}`}>
                        {locBadge.text}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      Acquires real GPS coordinates upon emergency escalation (no visual map)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isRequestingLocation}
                  onClick={() => handleRequestPermission('LOCATION')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors ${
                    permissions.LOCATION === 'GRANTED'
                      ? 'bg-blue-900/60 border-blue-500 text-blue-200'
                      : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                  }`}
                >
                  {isRequestingLocation ? 'CHECKING...' : permissions.LOCATION === 'GRANTED' ? 'READY' : 'REQUEST GPS'}
                </button>
              </div>

              {/* Audio Emergency Tone Engine */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white/5 text-neutral-300">
                    <Volume2 className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-white uppercase">AUDIO</p>
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${audBadge.color}`}>
                        {audBadge.text}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      Emergency chimes & guidance audio tones (Web Audio API)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRequestPermission('AUDIO')}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300"
                >
                  {audBadge.text === 'AUDIO ACTION REQUIRED' ? 'ENABLE AUDIO' : 'TEST TONE'}
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 3: Caretaker Profile Configuration */}
          <div className="pt-4 border-t border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="w-4 h-4 text-neutral-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-neutral-300">
                3. Primary Caretaker Contact
              </h3>
            </div>
            <p className="text-xs text-neutral-400 mb-3">
              Designated caretaker receiving structured emergency notifications & calls during SDCU/SSB escalations.
            </p>

            <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-mono text-neutral-400 block mb-1">Caretaker Name</label>
                  <input
                    type="text"
                    value={caretakerName}
                    onChange={(e) => setCaretakerName(e.target.value)}
                    placeholder="e.g. Dr. Sarah Jenkins"
                    className="w-full bg-black/60 border border-white/20 rounded-lg px-3 py-1.5 text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-red-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-neutral-400 block mb-1">Caretaker Phone Number</label>
                  <input
                    type="tel"
                    value={caretakerPhone}
                    onChange={(e) => setCaretakerPhone(e.target.value)}
                    placeholder="e.g. +1 555 019 2834"
                    className="w-full bg-black/60 border border-white/20 rounded-lg px-3 py-1.5 text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-red-400"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] font-mono text-neutral-400">
                  Status: {caretakerPhone.trim() ? 'CARETAKER CONFIGURED' : 'NO CARETAKER CONFIGURED'}
                </span>
                <button
                  type="button"
                  onClick={handleSaveCaretaker}
                  className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-mono text-white border border-white/15"
                >
                  Save Caretaker
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 4: Media Source Configuration */}
          <div className="pt-4 border-t border-white/10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-neutral-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-neutral-300">
                  4. Video / Audio Source Feed
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-neutral-300 uppercase">
                MP4 / MP3 SUPPORT
              </span>
            </div>
            <p className="text-xs text-neutral-400 mb-3">
              Configure active emergency feed stream. Empty state is displayed if no stream is configured.
            </p>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedMediaType('video')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 border ${
                    selectedMediaType === 'video'
                      ? 'bg-blue-600/40 border-blue-500 text-blue-100'
                      : 'bg-black/40 border-white/10 text-neutral-400 hover:text-white'
                  }`}
                >
                  <Video className="w-3.5 h-3.5" /> Video (MP4)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMediaType('audio')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 border ${
                    selectedMediaType === 'audio'
                      ? 'bg-purple-600/40 border-purple-500 text-purple-100'
                      : 'bg-black/40 border-white/10 text-neutral-400 hover:text-white'
                  }`}
                >
                  <Music className="w-3.5 h-3.5" /> Audio (MP3)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMediaType('none')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 border ${
                    selectedMediaType === 'none'
                      ? 'bg-neutral-700/60 border-neutral-500 text-neutral-100'
                      : 'bg-black/40 border-white/10 text-neutral-400 hover:text-white'
                  }`}
                >
                  Standby (None)
                </button>
              </div>

              {selectedMediaType !== 'none' && (
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={customMediaUrl}
                    onChange={(e) => setCustomMediaUrl(e.target.value)}
                    placeholder={
                      selectedMediaType === 'video'
                        ? 'Enter video stream URL (e.g. https://.../stream.mp4)'
                        : 'Enter audio stream URL (e.g. https://.../stream.mp3)'
                    }
                    className="flex-1 bg-black/60 border border-white/20 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-red-400"
                  />
                  <button
                    type="button"
                    onClick={handleApplyMedia}
                    className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-mono border border-white/15 transition-colors"
                  >
                    Apply
                  </button>
                </div>
              )}

              {/* Quick test media presets */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] text-neutral-500 font-mono">Test Presets:</span>
                <button
                  type="button"
                  onClick={handleLoadSampleVideo}
                  className="px-2 py-1 rounded text-[11px] font-mono bg-white/5 hover:bg-white/15 border border-white/10 text-neutral-300 transition-colors"
                >
                  Load Sample MP4
                </button>
                <button
                  type="button"
                  onClick={handleLoadSampleAudio}
                  className="px-2 py-1 rounded text-[11px] font-mono bg-white/5 hover:bg-white/15 border border-white/10 text-neutral-300 transition-colors"
                >
                  Load Sample MP3
                </button>
                <button
                  type="button"
                  onClick={handleClearMedia}
                  className="px-2 py-1 rounded text-[11px] font-mono bg-red-950/40 hover:bg-red-900/60 border border-red-800 text-red-300 transition-colors"
                >
                  Reset to Standby (Empty)
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 5: Developer QA Telemetry Input Preview Toggle */}
          <div className="pt-4 border-t border-white/10">
            <div className="p-3 rounded-xl bg-neutral-950/80 border border-dashed border-white/15 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white/5">
                  <FlaskConical className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-neutral-200 uppercase font-mono">
                    QA SIMULATED TELEMETRY PACKET
                  </p>
                  <p className="text-[11px] text-neutral-400">
                    Previews how incoming CONDITION / VITALS packets bind to the frame.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onToggleTestTelemetry(!isTestTelemetryActive)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors ${
                  isTestTelemetryActive
                    ? 'bg-purple-900/60 border-purple-500 text-purple-200'
                    : 'bg-black/40 border-white/15 text-neutral-400 hover:text-white'
                }`}
              >
                {isTestTelemetryActive ? 'SIMULATION ACTIVE' : 'NO DATA (DEFAULT)'}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-black/60 border-t border-white/10 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white ${currentTheme.buttonPrimary} focus:outline-none focus:ring-2 focus:ring-red-400`}
          >
            Apply & Return to CRIB
          </button>
        </div>
      </div>
    </div>
  );
};

