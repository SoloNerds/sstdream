// Security & ops findings derived from the blueprint + its physical expansion.
// Advisory (not an export gate) — surfaced on the Infrastructure view.

export interface SecurityFinding {
  level: 'info' | 'warn';
  title: string;
  detail: string;
  /** Logical resource this is about, if any. */
  resourceId?: string;
}
