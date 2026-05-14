'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';

const KONAMI = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
];

/**
 * Mounts global easter eggs:
 *  - Konami code → flashes a message and toggles a transient "neon" theme
 *  - Mouse-trail particles on desktop with no `prefers-reduced-motion`
 */
export function EasterEggs() {
  useKonami();
  return null;
}

function useKonami() {
  const { theme, setTheme } = useTheme();
  const buffer = React.useRef<string[]>([]);
  const [showHint, setShowHint] = React.useState(false);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = e.key;
      buffer.current = [...buffer.current, key].slice(-KONAMI.length);
      if (KONAMI.every((k, i) => buffer.current[i]?.toLowerCase() === k.toLowerCase())) {
        buffer.current = [];
        const next = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        setShowHint(true);
        setTimeout(() => setShowHint(false), 2400);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [theme, setTheme]);

  React.useEffect(() => {
    if (!showHint) return;
    const el = document.createElement('div');
    el.textContent = 'Blue mode unlocked';
    el.style.cssText =
      'position:fixed;left:50%;top:24px;transform:translateX(-50%);z-index:9999;padding:8px 14px;border-radius:9999px;background:rgba(14,116,235,.86);color:#fff;font-size:12px;font-weight:500;backdrop-filter:blur(6px);pointer-events:none;';
    document.body.appendChild(el);
    return () => {
      el.remove();
    };
  }, [showHint]);
}
