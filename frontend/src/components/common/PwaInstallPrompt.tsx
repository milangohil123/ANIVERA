import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Check } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('anivera_pwa_prompt_dismissed') === 'true';
    } catch {
      return false;
    }
  });
  const [showIosGuide, setShowIosGuide] = useState<boolean>(false);
  const [isInstalledSuccess, setIsInstalledSuccess] = useState<boolean>(false);

  useEffect(() => {
    // Check if running in standalone mode (already installed as PWA)
    const checkStandalone = () => {
      const isDisplayStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isNavigatorStandalone = (window.navigator as any).standalone === true;
      setIsStandalone(Boolean(isDisplayStandalone || isNavigatorStandalone));
    };

    checkStandalone();

    // Listen for beforeinstallprompt on Chromium / Android
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for appinstalled
    const handleAppInstalled = () => {
      setIsInstalledSuccess(true);
      setDeferredPrompt(null);
      setTimeout(() => setIsInstalledSuccess(false), 5000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const isIos = typeof window !== 'undefined' && /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());

  // If already standalone or user dismissed in this session, do not render banner
  if (isStandalone || isDismissed) {
    return null;
  }

  // If install succeeded recently
  if (isInstalledSuccess) {
    return (
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 bg-[#135D43] text-white p-3.5 rounded-xl shadow-2xl border border-emerald-400 flex items-center gap-3 animate-fade-in text-xs">
        <Check className="w-5 h-5 text-emerald-300 shrink-0" />
        <span className="font-medium">ANIVERA સફળતાપૂર્વક તમારા ફોનમાં ઇન્સ્ટોલ થઈ ગયું છે!</span>
      </div>
    );
  }

  // Show if Chromium deferred prompt is available OR if on iOS Safari
  if (!deferredPrompt && !isIos) {
    return null;
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else if (isIos) {
      setShowIosGuide((prev) => !prev);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem('anivera_pwa_prompt_dismissed', 'true');
    } catch {}
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 bg-white/95 backdrop-blur-md border border-slate-200 shadow-2xl rounded-2xl p-3.5 text-xs text-slate-800 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#135D43] flex items-center justify-center text-white shrink-0 shadow-xs">
            <Smartphone className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-sm leading-tight">ANIVERA એપ ઇન્સ્ટોલ કરો</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">મોબાઇલ હોમ સ્ક્રીન પર ઉમેરો અને ઑફલાઇન વાપરો</p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="બંધ કરો"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {showIosGuide && (
        <div className="mt-2.5 p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 space-y-1">
          <p className="font-semibold">iOS Safari પર ઇન્સ્ટોલ કરવા માટે:</p>
          <p>૧. નીચે શેર બટન (Share Icon) પર ટેપ કરો.</p>
          <p>૨. મેનૂમાંથી <span className="font-bold">&quot;Add to Home Screen&quot;</span> પસંદ કરો.</p>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={handleInstallClick}
          className="flex-1 bg-[#135D43] hover:bg-[#0f4a35] text-white font-semibold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-xs"
        >
          <Download className="w-4 h-4 text-emerald-300" />
          <span>{isIos ? 'કેવી રીતે ઇન્સ્ટોલ કરવું?' : 'ઇન્સ્ટોલ કરો (Install)'}</span>
        </button>
        <button
          onClick={handleDismiss}
          className="px-3 py-2 text-slate-500 hover:text-slate-700 font-medium rounded-xl hover:bg-slate-100 transition-colors"
        >
          પછીથી
        </button>
      </div>
    </div>
  );
};
