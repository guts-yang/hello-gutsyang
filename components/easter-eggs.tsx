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
  useMouseTrail();
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
    el.textContent = '✦ Konami unlocked · theme flipped';
    el.style.cssText =
      'position:fixed;left:50%;top:24px;transform:translateX(-50%);z-index:9999;padding:8px 14px;border-radius:9999px;background:rgba(124,58,237,.85);color:#fff;font-size:12px;font-weight:500;backdrop-filter:blur(8px);pointer-events:none;';
    document.body.appendChild(el);
    return () => {
      el.remove();
    };
  }, [showHint]);
}

function useMouseTrail() {
  React.useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    if (reduce || coarse) return;

    const colors = ['#a78bfa', '#22d3ee', '#f472b6', '#34d399'];
    let lastSpawn = 0;

    const handler = (e: MouseEvent) => {
      const now = performance.now();
      if (now - lastSpawn < 35) return;
      lastSpawn = now;
      const dot = document.createElement('div');
      const size = 8 + Math.random() * 6;
      dot.style.cssText = `position:fixed;left:${e.clientX - size / 2}px;top:${e.clientY - size / 2}px;width:${size}px;height:${size}px;border-radius:9999px;background:${colors[Math.floor(Math.random() * colors.length)]};pointer-events:none;z-index:9998;mix-blend-mode:screen;filter:blur(2px);transition:transform .8s ease-out, opacity .8s ease-out;`;
      document.body.appendChild(dot);
      requestAnimationFrame(() => {
        dot.style.transform = `translate(${(Math.random() - 0.5) * 60}px, ${(Math.random() - 0.5) * 60}px) scale(0.2)`;
        dot.style.opacity = '0';
      });
      setTimeout(() => dot.remove(), 850);
    };

    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);
}
