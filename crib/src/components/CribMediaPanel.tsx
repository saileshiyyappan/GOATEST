import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Radio,
  Video,
  Music,
  TvMinimalPlay,
  AlertCircle,
  X,
} from 'lucide-react';
import { CribMediaState, CribMode } from '../types/crib';
import { CRIB_THEMES } from '../themes/cribThemes';

interface CribMediaPanelProps {
  mediaState: CribMediaState;
  mode: CribMode;
  onUpdateMediaState?: (updates: Partial<CribMediaState>) => void;
  onOpenSettings?: () => void;
}

export const CribMediaPanel: React.FC<CribMediaPanelProps> = ({
  mediaState,
  mode,
  onUpdateMediaState,
  onOpenSettings,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(mediaState.isPlaying);
  const [isMuted, setIsMuted] = useState<boolean>(mediaState.isMuted);
  const [volume, setVolume] = useState<number>(mediaState.volume);
  const [currentTime, setCurrentTime] = useState<number>(mediaState.currentTime || 0);
  const [duration, setDuration] = useState<number>(mediaState.duration || 0);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const theme = CRIB_THEMES[mode];

  // Sync internal state when external mediaState prop changes
  useEffect(() => {
    setIsPlaying(mediaState.isPlaying);
    setIsMuted(mediaState.isMuted);
    setVolume(mediaState.volume);
    setMediaError(null);
  }, [mediaState.url, mediaState.type]);

  const togglePlay = () => {
    const mediaEl = mediaState.type === 'video' ? videoRef.current : audioRef.current;
    if (!mediaEl) return;

    if (isPlaying) {
      mediaEl.pause();
      setIsPlaying(false);
      onUpdateMediaState?.({ isPlaying: false });
    } else {
      mediaEl
        .play()
        .then(() => {
          setIsPlaying(true);
          onUpdateMediaState?.({ isPlaying: true });
        })
        .catch((err) => {
          console.warn('Media playback prevented or failed:', err);
        });
    }
  };

  const toggleMute = () => {
    const mediaEl = mediaState.type === 'video' ? videoRef.current : audioRef.current;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (mediaEl) {
      mediaEl.muted = newMuted;
    }
    onUpdateMediaState?.({ isMuted: newMuted });
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    const mediaEl = mediaState.type === 'video' ? videoRef.current : audioRef.current;
    if (mediaEl) {
      mediaEl.volume = newVol;
      if (newVol === 0) {
        setIsMuted(true);
        mediaEl.muted = true;
      } else if (isMuted) {
        setIsMuted(false);
        mediaEl.muted = false;
      }
    }
    onUpdateMediaState?.({ volume: newVol, isMuted: newVol === 0 });
  };

  const handleTimeUpdate = () => {
    const mediaEl = mediaState.type === 'video' ? videoRef.current : audioRef.current;
    if (mediaEl) {
      setCurrentTime(mediaEl.currentTime);
      setDuration(mediaEl.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    const mediaEl = mediaState.type === 'video' ? videoRef.current : audioRef.current;
    if (mediaEl) {
      mediaEl.currentTime = newTime;
    }
  };

  // Container-level expansion (strictly within CRIB application viewport)
  const toggleExpand = () => {
    setIsExpanded((prev) => !prev);
  };

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const hasActiveMedia = Boolean(mediaState.url) && mediaState.type !== 'none';

  return (
    <section
      id="crib-media-panel"
      aria-label="CRIB Emergency Media and Guidance Video Feed"
      className={
        isExpanded
          ? 'fixed inset-2 sm:inset-4 z-50 rounded-2xl overflow-hidden border border-white/20 bg-neutral-950/95 backdrop-blur-xl shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200'
          : `relative w-full rounded-xl overflow-hidden border ${theme.panelBorder} ${theme.panelBg} transition-all duration-300 shadow-md flex flex-col shrink-0`
      }
    >
      {/* Top Media Header / Status Indicator */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-black/75 border-b border-white/10 text-[10px] sm:text-[11px] font-mono text-neutral-300 select-none shrink-0">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            {hasActiveMedia && isPlaying ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            )}
          </span>
          <span className="font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
            {mediaState.type === 'video' && <Video className="w-3.5 h-3.5 text-blue-400" />}
            {mediaState.type === 'audio' && <Music className="w-3.5 h-3.5 text-purple-400" />}
            {mediaState.type === 'none' && <Radio className="w-3.5 h-3.5 text-neutral-400" />}
            {mediaState.type === 'none' ? 'MEDIA STANDBY' : `${mediaState.type.toUpperCase()} FEED`}
          </span>
          {isExpanded && (
            <span className="px-1.5 py-0.5 rounded bg-blue-600/30 border border-blue-500/40 text-blue-200 text-[9px] font-bold uppercase tracking-wider">
              EXPANDED VIEW
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasActiveMedia && (
            <span className="text-[10px] text-neutral-300 font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          )}
          <span className="text-[9px] tracking-widest px-1.5 py-0.5 rounded bg-white/10 text-neutral-300 uppercase font-semibold">
            {hasActiveMedia ? 'LIVE FEED' : 'NO SOURCE'}
          </span>
          {isExpanded && (
            <button
              id="crib-media-close-expanded-btn"
              type="button"
              onClick={toggleExpand}
              aria-label="Close Expanded Media View"
              className="p-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-neutral-200 hover:text-white transition-colors flex items-center gap-1 text-[10px] font-mono"
            >
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">CLOSE</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Video/Audio Viewport Container */}
      <div
        className={
          isExpanded
            ? 'relative flex-1 w-full bg-black flex items-center justify-center overflow-hidden min-h-0'
            : 'relative w-full h-[120px] xs:h-[135px] sm:h-[175px] md:h-[195px] bg-black flex items-center justify-center overflow-hidden'
        }
      >
        {/* HTML Video Element - Keep mounted to preserve playback */}
        <video
          ref={videoRef}
          src={hasActiveMedia && mediaState.type === 'video' ? mediaState.url || undefined : undefined}
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleTimeUpdate}
          onError={() => setMediaError('Unable to load video source stream')}
          className={
            hasActiveMedia && mediaState.type === 'video'
              ? 'w-full h-full object-contain bg-black'
              : 'hidden'
          }
        />

        {/* HTML Audio Element - Keep mounted to preserve playback */}
        <audio
          ref={audioRef}
          src={hasActiveMedia && mediaState.type === 'audio' ? mediaState.url || undefined : undefined}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleTimeUpdate}
          onError={() => setMediaError('Unable to load audio source stream')}
        />

        {/* Audio Visualizer Mode */}
        {hasActiveMedia && mediaState.type === 'audio' && (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-b from-neutral-900 via-purple-950/40 to-neutral-950 select-none">
            <div className="flex items-center gap-1.5 h-12 sm:h-16 mb-3">
              {[40, 70, 95, 60, 85, 30, 75, 90, 50, 65, 80, 45, 90, 70, 35, 60, 85, 40].map(
                (height, i) => (
                  <div
                    key={i}
                    className={`w-1.5 rounded-full transition-all duration-150 ${
                      isPlaying ? 'bg-purple-400 animate-pulse' : 'bg-purple-800/60'
                    }`}
                    style={{
                      height: isPlaying ? `${height}%` : '20%',
                      animationDelay: `${i * 65}ms`,
                    }}
                  />
                )
              )}
            </div>
            <p className="text-xs sm:text-sm font-bold tracking-wider text-purple-200 uppercase flex items-center gap-2 font-mono">
              <Music className="w-4 h-4 text-purple-400" />
              EMERGENCY AUDIO STREAM ACTIVE
            </p>
          </div>
        )}

        {/* Clean Empty Media State */}
        {!hasActiveMedia && (
          <div
            id="crib-empty-media-state"
            className="w-full h-full flex flex-col items-center justify-center p-2 text-center text-neutral-400 bg-neutral-950/90 select-none"
          >
            <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-1">
              <TvMinimalPlay className="w-4 h-4 text-neutral-500" aria-hidden="true" />
            </div>
            <p className="text-xs font-bold tracking-widest text-neutral-200 uppercase font-mono">
              NO ACTIVE MEDIA STREAM
            </p>
            <p className="text-[10px] text-neutral-500 max-w-xs mt-0.5">
              Emergency video pipeline is in standby.
            </p>
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="mt-1 px-2.5 py-1 text-[10px] font-mono rounded bg-white/10 hover:bg-white/20 text-neutral-200 border border-white/15 transition-colors focus:outline-none focus:ring-1 focus:ring-red-400"
              >
                Configure Feed
              </button>
            )}
          </div>
        )}

        {/* Media Error Overlay */}
        {mediaError && (
          <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-2 text-center z-20">
            <AlertCircle className="w-5 h-5 text-red-400 mb-1" />
            <p className="text-xs text-red-200 font-semibold">{mediaError}</p>
            <p className="text-[10px] text-neutral-400">Verify media source URL in console settings.</p>
          </div>
        )}
      </div>

      {/* Media Controls Bar */}
      <div
        id="crib-media-controls"
        className="w-full px-2.5 py-1.5 bg-black/90 border-t border-white/10 flex flex-col gap-1 z-10 shrink-0 select-none"
      >
        {/* Progress Bar Scrubber */}
        <div className="w-full flex items-center">
          <input
            id="crib-media-progress"
            type="range"
            min="0"
            max={duration || 100}
            value={currentTime}
            disabled={!hasActiveMedia || duration === 0}
            onChange={handleSeek}
            aria-label="Media playback progress"
            className="w-full h-1.5 bg-neutral-800 rounded appearance-none cursor-pointer accent-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
          />
        </div>

        {/* Action Controls Row */}
        <div className="flex items-center justify-between text-white">
          {/* Left Controls: Play/Pause, Mute/Unmute, Volume */}
          <div className="flex items-center gap-2">
            <button
              id="crib-media-play-btn"
              type="button"
              onClick={togglePlay}
              disabled={!hasActiveMedia}
              aria-label={isPlaying ? 'Pause media' : 'Play media'}
              title={isPlaying ? 'Pause' : 'Play'}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 text-white disabled:opacity-30 disabled:hover:bg-white/10 transition-colors focus:outline-none focus:ring-1 focus:ring-red-400"
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5 text-white" />
              ) : (
                <Play className="w-3.5 h-3.5 text-white fill-white" />
              )}
            </button>

            <div className="flex items-center gap-1.5">
              <button
                id="crib-media-mute-btn"
                type="button"
                onClick={toggleMute}
                disabled={!hasActiveMedia}
                aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
                title={isMuted ? 'Unmute' : 'Mute'}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 transition-colors focus:outline-none focus:ring-1 focus:ring-red-400"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-3.5 h-3.5 text-red-400" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-white" />
                )}
              </button>

              <input
                id="crib-media-volume"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                disabled={!hasActiveMedia}
                onChange={handleVolumeChange}
                aria-label="Media volume level"
                title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
                className="w-16 sm:w-24 h-1.5 bg-neutral-800 rounded appearance-none cursor-pointer accent-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Right Controls: Container-Level Fullscreen / Minimize */}
          <div className="flex items-center gap-2">
            <button
              id="crib-media-fullscreen-btn"
              type="button"
              onClick={toggleExpand}
              aria-label={isExpanded ? 'Minimize media within console' : 'Expand media within console'}
              title={isExpanded ? 'Minimize Media' : 'Expand Media'}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors focus:outline-none focus:ring-1 focus:ring-red-400 flex items-center gap-1 text-[10px] font-mono font-semibold"
            >
              {isExpanded ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-white" />
                  <span className="hidden sm:inline">MINIMIZE</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-white" />
                  <span className="hidden sm:inline">EXPAND</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
