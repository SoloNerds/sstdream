'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

/** A copy-to-clipboard button that flips to "Copied ✓" briefly. */
export function CopyButton({
  text,
  label = 'Copy',
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          /* clipboard blocked — no-op */
        }
      }}
    >
      {copied ? 'Copied ✓' : label}
    </Button>
  );
}
