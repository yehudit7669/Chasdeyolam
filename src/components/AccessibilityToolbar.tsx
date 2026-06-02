import { useState, useEffect } from 'react';
import {
  Accessibility,
  ZoomIn,
  ZoomOut,
  Contrast,
  Baseline,
  Link as LinkIcon,
  PauseCircle,
  RotateCcw,
  X,
} from 'lucide-react';

const STORAGE_KEY = 'a11y-settings';

interface A11ySettings {
  fontSize: number;       // delta steps: -2..+4
  highContrast: boolean;
  grayscale: boolean;
  underlineLinks: boolean;
  reduceMotion: boolean;
}

const DEFAULTS: A11ySettings = {
  fontSize: 0,
  highContrast: false,
  grayscale: false,
  underlineLinks: false,
  reduceMotion: false,
};

function loadSettings(): A11ySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings(s: A11ySettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function applySettings(s: A11ySettings) {
  const root = document.documentElement;

  // Font size: each step = 10% of base (1rem)
  if (s.fontSize !== 0) {
    root.style.fontSize = `${1 + s.fontSize * 0.1}rem`;
  } else {
    root.style.fontSize = '';
  }

  // CSS classes on <html>
  root.classList.toggle('a11y-high-contrast', s.highContrast);
  root.classList.toggle('a11y-grayscale', s.grayscale);
  root.classList.toggle('a11y-underline-links', s.underlineLinks);
  root.classList.toggle('a11y-reduce-motion', s.reduceMotion);
}

export default function AccessibilityToolbar() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<A11ySettings>(loadSettings);

  // Apply on mount and whenever settings change
  useEffect(() => {
    applySettings(settings);
    saveSettings(settings);
  }, [settings]);

  const update = (patch: Partial<A11ySettings>) =>
    setSettings(prev => ({ ...prev, ...patch }));

  const reset = () => setSettings({ ...DEFAULTS });

  const isModified =
    settings.fontSize !== 0 ||
    settings.highContrast ||
    settings.grayscale ||
    settings.underlineLinks ||
    settings.reduceMotion;

  return (
    <>
      {/* Floating trigger button */}
      <button
        aria-label="כלי נגישות"
        title="כלי נגישות"
        onClick={() => setOpen(v => !v)}
        className={`fixed bottom-5 left-5 z-[9999] w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0B3C5D] ${
          open
            ? 'bg-[#0B3C5D] text-white'
            : isModified
            ? 'bg-[#626D58] text-white'
            : 'bg-white text-[#0B3C5D] border border-[#E5E1D8] hover:bg-[#F7F5F0]'
        }`}
      >
        <Accessibility size={22} />
      </button>

      {/* Panel */}
      {open && (
        <div
          role="dialog"
          aria-label="הגדרות נגישות"
          dir="rtl"
          className="fixed bottom-20 left-5 z-[9998] w-64 bg-white rounded-2xl shadow-2xl border border-[#E5E1D8] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#0B3C5D] text-white">
            <span className="text-sm font-semibold">נגישות</span>
            <button
              aria-label="סגור תפריט נגישות"
              onClick={() => setOpen(false)}
              className="p-0.5 rounded-lg hover:bg-white/20 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-3 space-y-1.5">
            {/* Font size */}
            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#F7F5F0]">
              <span className="text-sm font-medium text-[#33332D]">גודל טקסט</span>
              <div className="flex items-center gap-2">
                <button
                  aria-label="הקטן גודל טקסט"
                  onClick={() => update({ fontSize: Math.max(-2, settings.fontSize - 1) })}
                  disabled={settings.fontSize <= -2}
                  className="w-7 h-7 rounded-lg flex items-center justify-center border border-[#E5E1D8] bg-white text-[#33332D] hover:bg-[#E5E1D8] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ZoomOut size={14} />
                </button>
                <span className="text-xs font-semibold text-[#626D58] w-6 text-center tabular-nums">
                  {settings.fontSize > 0 ? `+${settings.fontSize}` : settings.fontSize}
                </span>
                <button
                  aria-label="הגדל גודל טקסט"
                  onClick={() => update({ fontSize: Math.min(4, settings.fontSize + 1) })}
                  disabled={settings.fontSize >= 4}
                  className="w-7 h-7 rounded-lg flex items-center justify-center border border-[#E5E1D8] bg-white text-[#33332D] hover:bg-[#E5E1D8] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ZoomIn size={14} />
                </button>
              </div>
            </div>

            {/* Toggle rows */}
            {([
              { key: 'highContrast',  label: 'ניגודיות גבוהה',  Icon: Contrast     },
              { key: 'grayscale',     label: 'גווני אפור',       Icon: Baseline     },
              { key: 'underlineLinks',label: 'הדגש קישורים',    Icon: LinkIcon     },
              { key: 'reduceMotion',  label: 'עצור אנימציות',   Icon: PauseCircle  },
            ] as const).map(({ key, label, Icon }) => (
              <button
                key={key}
                role="switch"
                aria-checked={settings[key]}
                onClick={() => update({ [key]: !settings[key] })}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors text-sm font-medium ${
                  settings[key]
                    ? 'bg-[#0B3C5D] text-white'
                    : 'bg-[#F7F5F0] text-[#33332D] hover:bg-[#E5E1D8]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon size={15} />
                  <span>{label}</span>
                </div>
                <div
                  style={{ height: '18px' }}
                  className={`w-8 rounded-full relative transition-colors ${
                    settings[key] ? 'bg-white/30' : 'bg-[#D4CFC6]'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all ${
                      settings[key] ? 'bg-white right-0.5' : 'bg-white left-0.5'
                    }`}
                  />
                </div>
              </button>
            ))}

            {/* Reset */}
            {isModified && (
              <button
                onClick={reset}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors mt-0.5"
              >
                <RotateCcw size={14} />
                <span>איפוס הגדרות</span>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
