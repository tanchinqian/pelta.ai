'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

export default function SeedButton() {
  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await fetch('/api/seed', { method: 'POST' });
      window.location.reload();
    } catch {
      setSeeding(false);
    }
  };

  return (
    <button
      onClick={handleSeed}
      disabled={seeding}
      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono text-text-tertiary border border-border hover:bg-surface-hover hover:text-text-secondary transition-colors cursor-pointer disabled:opacity-40"
      title="Reset all data to seed state"
    >
      <RefreshCw size={10} className={seeding ? 'animate-spin' : ''} />
      Reset
    </button>
  );
}
