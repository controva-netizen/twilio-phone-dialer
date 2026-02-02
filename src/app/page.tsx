'use client';

import { useState } from 'react';
import { Phone } from '@/components/Phone';
import { AccessibilityPanel } from '@/components/AccessibilityPanel';
import styles from './page.module.css';

export default function Home() {
  const [showAccessibility, setShowAccessibility] = useState(false);

  return (
    <main className={styles.main}>
      {/* Accessibility Button */}
      <button
        className={styles.a11yButton}
        onClick={() => setShowAccessibility(!showAccessibility)}
        aria-label="Accessibility settings"
        title="Accessibility settings"
      >
        <AccessibilityIcon />
      </button>

      {/* Accessibility Panel */}
      {showAccessibility && (
        <AccessibilityPanel onClose={() => setShowAccessibility(false)} />
      )}

      {/* Phone Component */}
      <Phone />
    </main>
  );
}

function AccessibilityIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path d="M12 8v4" />
      <path d="M9 12h6" />
      <path d="M9 16l3-4 3 4" />
    </svg>
  );
}
