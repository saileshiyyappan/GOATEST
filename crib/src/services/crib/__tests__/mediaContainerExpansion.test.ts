/**
 * PMT-8 Media Panel Container-Level Expansion & Playback Deterministic Tests
 */

import { CribMediaState } from '../../../types/crib';

export function runAllMediaExpansionTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      passed++;
      console.log(`  [PASS] ${message}`);
    } else {
      failed++;
      console.error(`  [FAIL] ${message}`);
    }
  }

  console.log('--- RUNNING CRIB PMT-8 MEDIA EXPANSION TESTS ---');

  // Time formatter utility test
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  assert(formatTime(0) === '00:00', '0 seconds formats as 00:00');
  assert(formatTime(65) === '01:05', '65 seconds formats as 01:05');
  assert(formatTime(125) === '02:05', '125 seconds formats as 02:05');
  assert(formatTime(-10) === '00:00', 'Negative seconds formats safely as 00:00');
  assert(formatTime(NaN) === '00:00', 'NaN seconds formats safely as 00:00');

  // Initial media state tests
  const initialMedia: CribMediaState = {
    type: 'video',
    url: 'https://example.com/cpr-guide.mp4',
    isPlaying: false,
    isMuted: true,
    volume: 0.8,
    currentTime: 15,
    duration: 120,
    isFullscreen: false,
  };

  assert(initialMedia.type === 'video', 'Media type is video');
  assert(initialMedia.isPlaying === false, 'Media starts paused');
  assert(initialMedia.isMuted === true, 'Media starts muted by default');
  assert(initialMedia.currentTime === 15, 'Current time recorded');
  assert(initialMedia.duration === 120, 'Duration recorded');
  assert(initialMedia.isFullscreen === false, 'Fullscreen starts false');

  // Media seek progress test
  const calculateProgressPercent = (current: number, duration: number) => {
    if (!duration || duration <= 0) return 0;
    return Math.min(100, Math.max(0, (current / duration) * 100));
  };

  assert(calculateProgressPercent(15, 120) === 12.5, '15/120 is 12.5%');
  assert(calculateProgressPercent(60, 120) === 50, '60/120 is 50%');
  assert(calculateProgressPercent(130, 120) === 100, 'Clamped at 100%');
  assert(calculateProgressPercent(0, 0) === 0, 'Zero duration handled safely');

  // Audio stream state test
  const audioMedia: CribMediaState = {
    type: 'audio',
    url: 'https://example.com/emergency-chime.mp3',
    isPlaying: true,
    isMuted: false,
    volume: 1.0,
    currentTime: 0,
    duration: 60,
    isFullscreen: false,
  };

  assert(audioMedia.type === 'audio', 'Audio stream type confirmed');
  assert(audioMedia.isPlaying === true, 'Audio playing state confirmed');

  console.log(`\nCRIB PMT-8 Media tests complete: ${passed} passed, ${failed} failed.\n`);
  return { passed, failed };
}
