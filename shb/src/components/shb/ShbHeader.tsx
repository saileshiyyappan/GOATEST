import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useShbTheme } from '../../theme/shbTheme';
import { OrganCategory, ShbSessionPhase } from '../../types/shb';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export interface ShbHeaderProps {
  phase: ShbSessionPhase;
  selectedOrgan: OrganCategory | null;
  onExit: () => void;
  onBackToOrganSelect?: () => void;
  onNext?: () => void;
  isNextEnabled?: boolean;
  lockedCount?: number;
}

export const ShbHeader: React.FC<ShbHeaderProps> = ({
  phase,
  selectedOrgan,
  onExit,
  onBackToOrganSelect,
  onNext,
  isNextEnabled = false,
}) => {
  const { shb_color } = useShbTheme();
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const handleBack = () => {
    if (phase === 'LIVE_SHB') {
      setShowExitConfirm(true);
    } else if (phase === 'COMPARE_LOADING') {
      if (onBackToOrganSelect) {
        onBackToOrganSelect();
      } else {
        onExit();
      }
    } else {
      onExit();
    }
  };

  return (
    <>
      <div
        className="px-4 pt-3 pb-1 flex items-center justify-between relative w-full shrink-0"
        style={{ backgroundColor: '#000000' }}
      >
        {/* Left: Back Button */}
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-1 py-1.5 px-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95 hover:opacity-80 shrink-0 z-10"
          style={{
            backgroundColor: shb_color.panel,
            color: shb_color.textPrimary,
            border: `1px solid ${shb_color.panelBorder}`,
          }}
          aria-label="Back"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        {/* Center: Target Scope Indicator (e.g. OVERALL) */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none">
          {phase === 'LIVE_SHB' && selectedOrgan && (
            <span
              className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg shadow-sm"
              style={{
                backgroundColor: shb_color.accentBgLight,
                color: shb_color.accent,
                border: `1px solid ${shb_color.accentRing}`,
              }}
            >
              {selectedOrgan.name}
            </span>
          )}
        </div>

        {/* Right: Next > Navigation Button */}
        {phase === 'LIVE_SHB' ? (
          <div className="flex items-center gap-1.5 shrink-0 z-10">
            <button
              onClick={isNextEnabled && onNext ? onNext : undefined}
              disabled={!isNextEnabled}
              className="inline-flex items-center gap-1 py-1.5 px-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
              style={{
                backgroundColor: isNextEnabled ? shb_color.accent : shb_color.panel,
                color: isNextEnabled ? '#ffffff' : shb_color.textMuted,
                border: isNextEnabled ? `1px solid ${shb_color.accent}` : `1px solid ${shb_color.panelBorder}`,
                opacity: isNextEnabled ? 1 : 0.45,
                cursor: isNextEnabled ? 'pointer' : 'not-allowed',
              }}
              aria-label="Next"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="w-12" />
        )}
      </div>

      {/* Exit Confirmation Modal for Live Session */}
      <Modal
        isOpen={showExitConfirm}
        onClose={() => setShowExitConfirm(false)}
        title="Exit Active Assessment?"
      >
        <div className="space-y-4 text-sm text-zinc-300">
          <p className="text-xs text-zinc-300 leading-relaxed">
            An active sensor assessment is in progress. Exiting will cancel the current session and return to organ selection.
          </p>
          <div className="flex gap-2 justify-end pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExitConfirm(false)}
              className="text-xs"
            >
              Stay
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setShowExitConfirm(false);
                if (onBackToOrganSelect) {
                  onBackToOrganSelect();
                } else {
                  onExit();
                }
              }}
              className="text-xs"
            >
              Exit Session
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
