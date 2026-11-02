'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Full-screen "please wait" modal with a spinner. Rendered into <body> so it is never clipped
// by a table cell or card, and it blocks clicks (no double submits) until the save finishes.
export default function BusyModal({ open, title, detail }: { open: boolean; title: string; detail?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const blockKeys = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === 'Escape') e.preventDefault(); };
    window.addEventListener('keydown', blockKeys, true);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', blockKeys, true);
    };
  }, [open]);

  if (!mounted || !open) return null;
  return createPortal(
    <div className="bm-backdrop" role="alertdialog" aria-modal="true" aria-busy="true" aria-labelledby="bm-title" aria-describedby="bm-detail">
      <div className="bm-card">
        <div className="bm-spinner" aria-hidden="true" />
        <div className="bm-title" id="bm-title">{title}</div>
        <div className="bm-detail" id="bm-detail">{detail ?? 'Please wait, this only takes a moment.'}</div>
        <div className="bm-bar" aria-hidden="true"><i /></div>
      </div>
    </div>,
    document.body,
  );
}
