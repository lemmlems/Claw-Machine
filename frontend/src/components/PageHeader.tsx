import type { ReactNode } from 'react';
import { ThemeToggle } from '../theme';

export function PageHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Regency Drawing Room</p>
        <h1>The Lady Whistledown's Ledger</h1>
      </div>
      <nav className="page-nav" aria-label="Host pages">
        <a href="/">Guest Ledger</a>
        <a href="/claw">The Promenade Claw</a>
        <ThemeToggle />
        {children}
      </nav>
    </header>
  );
}
