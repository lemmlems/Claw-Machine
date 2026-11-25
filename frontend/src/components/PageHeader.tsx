import type { ReactNode } from 'react';
import { ThemeToggle } from '../theme';

export function PageHeader({ children }: { children?: ReactNode }) {
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';

  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Regency Drawing Room</p>
        <h1>The Lady Whistledown's Ledger</h1>
      </div>
      <nav className="page-nav" aria-label="Host pages">
        <a href="/" className={currentPath === '/' ? 'active' : ''}>Guest Ledger</a>
        <a href="/claw-admin" className={currentPath === '/claw-admin' ? 'active' : ''}>Promenade Claw (Admin)</a>
        <a href="/claw" target="_blank" rel="noopener noreferrer">Promenade Claw (Users)</a>
        <ThemeToggle />
        {children}
      </nav>
    </header>
  );
}
