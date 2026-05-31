'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';


type Theme = 'dark' | 'light';

function applyTheme(t: Theme) {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  if (t === 'light') html.classList.add('light');
  else html.classList.remove('light');
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const stored = (localStorage.getItem('cac:theme') as Theme | null) ?? 'dark';
    setTheme(stored);
    applyTheme(stored);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
    localStorage.setItem('cac:theme', next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Cambiar tema"
      title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-[rgba(212,175,55,0.25)] text-brand-muted transition hover:border-brand-gold hover:text-brand-gold active:bg-[#1a1a1a]"
    >
      {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
