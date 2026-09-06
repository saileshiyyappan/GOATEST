/**
 * GOATEST Application Opening / Splash Screen
 * 
 * Authoritative Home Web startup splash screen.
 * - Deep black background (#09090b / bg-zinc-950)
 * - Centered GOATEST branding (GOA in white, TEST in orange)
 * - Premium sequential letter-formation animation from left to right (G O A T E S T -> GOATEST)
 * - Micro-fragment convergence, smooth easing, and subtle glow during formation
 * - No user tap required
 * - Lasts ~2.2 seconds minimum before continuing automatically to Home
 * - Respects prefers-reduced-motion
 */

import React, { useEffect, useState, useMemo } from 'react';
import logoUrl from '../../assets/goatest-logo.png';

export interface OpeningViewProps {
  onComplete: () => void;
  isConfigured?: boolean;
  isFirebaseReady?: boolean;
  isAuthPending?: boolean;
}

interface LetterConfig {
  char: string;
  colorClass: string;
  glowAnimation: string;
  fragments: Array<{ fx: number; fy: number; delay: number; size: number }>;
}

export const OpeningView: React.FC<OpeningViewProps> = ({
  onComplete,
  isAuthPending = false,
}) => {
  const [animationSettled, setAnimationSettled] = useState<boolean>(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);

  // Check for prefers-reduced-motion
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mediaQuery.matches);

      const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, []);

  // Letters specification: GOA in white, TEST in orange
  const letters: LetterConfig[] = useMemo(() => [
    {
      char: 'G',
      colorClass: 'text-white',
      glowAnimation: 'whiteGlowPulse',
      fragments: [
        { fx: -14, fy: -10, delay: 0.15, size: 2 },
        { fx: 12, fy: 14, delay: 0.22, size: 2.5 },
      ],
    },
    {
      char: 'O',
      colorClass: 'text-white',
      glowAnimation: 'whiteGlowPulse',
      fragments: [
        { fx: -10, fy: 16, delay: 0.31, size: 2 },
        { fx: 14, fy: -12, delay: 0.38, size: 2 },
      ],
    },
    {
      char: 'A',
      colorClass: 'text-white',
      glowAnimation: 'whiteGlowPulse',
      fragments: [
        { fx: -12, fy: -14, delay: 0.47, size: 2.5 },
        { fx: 10, fy: 12, delay: 0.54, size: 2 },
      ],
    },
    {
      char: 'T',
      colorClass: 'text-orange-500',
      glowAnimation: 'orangeGlowPulse',
      fragments: [
        { fx: -16, fy: 10, delay: 0.63, size: 2 },
        { fx: 12, fy: -15, delay: 0.70, size: 2.5 },
      ],
    },
    {
      char: 'E',
      colorClass: 'text-orange-500',
      glowAnimation: 'orangeGlowPulse',
      fragments: [
        { fx: -12, fy: -12, delay: 0.79, size: 2 },
        { fx: 15, fy: 11, delay: 0.86, size: 2 },
      ],
    },
    {
      char: 'S',
      colorClass: 'text-orange-500',
      glowAnimation: 'orangeGlowPulse',
      fragments: [
        { fx: -14, fy: 14, delay: 0.95, size: 2.5 },
        { fx: 11, fy: -13, delay: 1.02, size: 2 },
      ],
    },
    {
      char: 'T',
      colorClass: 'text-orange-500',
      glowAnimation: 'orangeGlowPulse',
      fragments: [
        { fx: -10, fy: -16, delay: 1.11, size: 2 },
        { fx: 14, fy: 12, delay: 1.18, size: 2.5 },
      ],
    },
  ], []);

  // Animation timeline coordinator
  useEffect(() => {
    if (prefersReducedMotion) {
      setAnimationSettled(true);
      const minTimer = setTimeout(() => {
        if (!isAuthPending) {
          onComplete();
        }
      }, 2000);
      return () => clearTimeout(minTimer);
    }

    // Step 1: Lock wordmark when all letters have formed (~1.6s)
    const settleTimer = setTimeout(() => {
      setAnimationSettled(true);
    }, 1600);

    // Step 2: Total duration of 2.2s minimum, then proceed to Home
    const finishTimer = setTimeout(() => {
      if (!isAuthPending) {
        onComplete();
      }
    }, 2250);

    return () => {
      clearTimeout(settleTimer);
      clearTimeout(finishTimer);
    };
  }, [prefersReducedMotion, isAuthPending, onComplete]);

  // If animation is settled and auth finished later, trigger onComplete
  useEffect(() => {
    if (animationSettled && !isAuthPending) {
      const graceTimer = setTimeout(() => {
        onComplete();
      }, 200);
      return () => clearTimeout(graceTimer);
    }
  }, [animationSettled, isAuthPending, onComplete]);

  return (
    <div
      className="w-full h-full min-h-screen flex flex-col items-center justify-between p-8 bg-[#09090b] text-center select-none overflow-hidden relative"
      style={{
        animation: prefersReducedMotion ? 'none' : 'splashFadeIn 0.4s ease-out forwards',
      }}
    >
      {/* Top Balanced Space */}
      <div className="w-full h-12" />

      {/* Center Wordmark Animation Container */}
      <div className="flex flex-col items-center justify-center my-auto relative">
        <img src={logoUrl} alt="" aria-hidden="true" className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl object-contain mb-5" />
        <h1
          className={`flex items-center justify-center text-4xl sm:text-5xl font-extrabold uppercase font-mono leading-none tracking-[0.2em] select-none ${
            animationSettled && !prefersReducedMotion ? 'animate-[wordmarkLock_0.4s_ease-out_forwards]' : ''
          } ${prefersReducedMotion ? 'reduced-motion-static' : ''}`}
          aria-label="GOATEST"
        >
          {letters.map((item, index) => {
            const letterDelay = 0.2 + index * 0.16; // 0.20s, 0.36s, 0.52s, 0.68s, 0.84s, 1.00s, 1.16s
            return (
              <span
                key={`${item.char}-${index}`}
                className="relative inline-flex items-center justify-center"
                style={{
                  minWidth: '0.62em',
                }}
              >
                {/* Micro-fragments converging into letter */}
                {!prefersReducedMotion && !animationSettled &&
                  item.fragments.map((frag, fIdx) => (
                    <span
                      key={`frag-${fIdx}`}
                      className="absolute rounded-full pointer-events-none"
                      style={{
                        width: `${frag.size}px`,
                        height: `${frag.size}px`,
                        backgroundColor: index < 3 ? 'rgba(255, 255, 255, 0.75)' : 'rgba(249, 115, 22, 0.85)',
                        boxShadow: index < 3 ? '0 0 6px rgba(255,255,255,0.8)' : '0 0 8px rgba(249,115,22,0.9)',
                        animation: `letterFragmentConverge 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards`,
                        animationDelay: `${frag.delay}s`,
                        opacity: 0,
                        '--fx': `${frag.fx}px`,
                        '--fy': `${frag.fy}px`,
                      } as React.CSSProperties}
                    />
                  ))}

                {/* Letter glyph */}
                <span
                  className={`inline-block ${item.colorClass} ${
                    prefersReducedMotion ? 'reduced-motion-static' : ''
                  }`}
                  style={
                    prefersReducedMotion
                      ? { opacity: 1 }
                      : {
                          opacity: 0,
                          animation: `letterGlideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${letterDelay}s forwards, ${item.glowAnimation} 0.6s ease-out ${letterDelay}s forwards`,
                        }
                  }
                >
                  {item.char}
                </span>
              </span>
            );
          })}
        </h1>
      </div>

      {/* Minimal Bottom Footer */}
      <div
        className={`text-[11px] text-zinc-500 tracking-[0.25em] uppercase font-medium pb-2 ${
          prefersReducedMotion ? 'reduced-motion-static' : ''
        }`}
        style={
          prefersReducedMotion
            ? { opacity: 1 }
            : {
                opacity: 0,
                animation: 'splashFooterIn 0.8s ease-out 0.4s forwards',
              }
        }
      >
        HEALTH MONITORING PLATFORM
      </div>
    </div>
  );
};
