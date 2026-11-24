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
        <a href="/rsvp" className={currentPath === '/rsvp' ? 'active' : ''}>RSVP</a>
        <a href="/claw" className={currentPath === '/claw' ? 'active' : ''}>The Promenade Claw</a>
        <ThemeToggle />
        {children}
      </nav>
    </header>
  );
}
