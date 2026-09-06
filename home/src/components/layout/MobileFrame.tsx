/**
 * GOATEST Mobile Frame Container
 * 
 * Enforces mobile-first viewport design.
 * On desktop previews: renders a clean centered mobile device viewport.
 * On mobile devices: seamlessly expands to native mobile screen.
 */

import React from 'react';

export interface MobileFrameProps {
  children: React.ReactNode;
}

export const MobileFrame: React.FC<MobileFrameProps> = ({ children }) => {
  return (
    <div className="min-h-[100dvh] w-full bg-black sm:bg-slate-900 flex items-center justify-center sm:p-4 selection:bg-slate-800">
      {/* Centered Mobile Device Frame on Desktop */}
      <div className="w-full sm:max-w-[430px] h-[100dvh] sm:h-[900px] sm:max-h-[95vh] bg-black sm:rounded-[36px] sm:shadow-2xl sm:border-[8px] sm:border-slate-800/80 overflow-hidden flex flex-col relative transition-colors duration-200">
        
        {/* Subtle Speaker / Notch Indicator for Desktop Frame */}
        <div className="hidden sm:flex justify-center pt-2 pb-1 bg-[var(--color-topbar-bg)] shrink-0 z-30">
          <div className="w-20 h-4 bg-slate-900 rounded-full flex items-center justify-end px-2">
            <div className="w-2 h-2 rounded-full bg-slate-800" />
          </div>
        </div>

        {/* Inner Mobile Viewport Screen */}
        <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden pt-[env(safe-area-inset-top)]">
          {children}
        </div>
      </div>
    </div>
  );
};
