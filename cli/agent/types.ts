// The agent's honest output contract + the BYO-model seam. Every answer is four sections;
// "Known facts" is a CITATION-ONLY slot (each fact points at a graph node or a verified
// doc). The model (later) may only narrate over facts the deterministic layer produced —
// it can never invent a Known fact. NoAI is the default and renders the deterministic
// facts with the model seam unplugged.

// One egress vocabulary across the whole product — defined in the plugin host, aliased below for
// the AI seam. (Type-only; erased at build, so the agent bundle is unaffected.)
import type { Egress } from '@/lib/plugin-host/manifest';

export interface Cited {
  text: string;
  source: string; // a graph node id, or a verified doc + section
}

export interface AgentAnswer {
  title: string;
  knownFacts: Cited[]; // grounded in the graph / source — every fact cited
  likelyCauses: string[]; // inference (empty without a model)
  suggestedChecks: string[];
  unknowns: string[]; // the scan's honest gaps, verbatim — never a silent drop
  grounding: string; // e.g. "the scanned graph + SST docs (docs/sst-v4-target.md)"
}

export type ProviderEgress = Egress;

// The BYO-model seam. NoAI (egress 'none') is the default; local (Ollama/OpenAI-compatible)
// and hosted adapters implement this later. Context MUST pass through the sanitizer before
// reaching any provider whose egress !== 'none' (enforced at the single call seam).
export interface ChatProvider {
  readonly id: string;
  readonly egress: ProviderEgress;
  complete(system: string, user: string): Promise<string>;
}

/** Render an answer as plain text (the four sections, empty ones omitted). */
export function renderAnswer(a: AgentAnswer): string {
  const out: string[] = [`# ${a.title}`, ''];
  if (a.knownFacts.length) {
    out.push('## Known facts');
    for (const f of a.knownFacts) out.push(`- ${f.text}  [${f.source}]`);
    out.push('');
  }
  if (a.likelyCauses.length) {
    out.push('## Likely causes');
    for (const c of a.likelyCauses) out.push(`- ${c}`);
    out.push('');
  }
  if (a.suggestedChecks.length) {
    out.push('## Suggested checks');
    for (const c of a.suggestedChecks) out.push(`- ${c}`);
    out.push('');
  }
  out.push('## Unknowns');
  if (a.unknowns.length) for (const u of a.unknowns) out.push(`- ${u}`);
  else out.push('- (nothing the scan flagged as unmodeled)');
  out.push('');
  out.push(`_Grounded in ${a.grounding}. Read-only — this never writes infrastructure._`);
  return out.join('\n') + '\n';
}
