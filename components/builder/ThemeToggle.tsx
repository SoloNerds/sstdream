'use client';

import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('sstdream.theme', next ? 'dark' : 'light');
    } catch {
      // ignore storage failures
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle theme"
      className="rounded-md border border-neutral-300 px-2 py-1 text-sm leading-none hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
    >
      {dark ? '☀️' : '🌙'}
    </button>
  );
}
