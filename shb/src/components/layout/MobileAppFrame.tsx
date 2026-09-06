import React, { ReactNode } from 'react';
import { useTheme } from '../../context/ThemeContext';

export interface MobileAppFrameProps {
  children: ReactNode;
}

export const MobileAppFrame: React.FC<MobileAppFrameProps> = ({ children }) => {
  const { mode } = useTheme();

  let outerBg = 'bg-[#14161a]';
  let innerBg = 'bg-[#1e2025] text-zinc-100';

  if (mode === 'WHITE') {
    outerBg = 'bg-slate-200';
    innerBg = 'bg-slate-50 text-slate-900';
  } else if (mode === 'DARK') {
    outerBg = 'bg-[#09090b]';
    innerBg = 'bg-[#121214] text-zinc-100';
  }

  return (
    <div className={`h-[100dvh] max-h-[100dvh] w-full flex justify-center ${outerBg} antialiased font-sans select-none transition-colors duration-200 overflow-hidden`}>
      <div className={`w-full max-w-md h-[100dvh] max-h-[100dvh] flex flex-col relative shadow-2xl ${innerBg} border-x border-zinc-800/30 overflow-hidden`}>
        {children}
      </div>
    </div>
  );
};
