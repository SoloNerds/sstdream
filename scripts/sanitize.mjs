// Secret redaction for the SSTDREAM import collector. Strips secret VALUES from
// pasted SST infra while preserving the structural `new sst.aws.X("Name", {...})`
// calls the diagram needs. Philosophy: OVER-REDACT. Blanking a non-secret is a
// cosmetic annoyance; leaking a real one into a browser paste is a breach.
//
// Hardened against an adversarial corpus (keys, connection strings incl. Prisma
// ?api_key= + JDBC params, PEM blocks, base64-encoded creds, and secrets split
// across string fragments). Resource NAMES (`new sst.Secret("ApiToken")`) are never
// touched — only assigned VALUES.

const R = '<REDACTED>';

// Connection-string userinfo: keep scheme + host, drop the user:pass credentials.
const CONN_STRING =
  /\b((?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis|rediss|amqp|amqps|https?|ftp):\/\/)[^\s:'"`@/]+:[^\s:'"`@/]+@/gi;

// Credentials carried in a URL QUERY/PROPERTY param (Prisma ?api_key=, JDBC ;password=, …).
const QUERY_CREDS =
  /([?&;](?:api[_-]?key|apikey|password|pwd|token|secret|access[_-]?token|auth|sig)=)([^&;"'`\s]+)/gi;

// Known secret VALUE shapes — the whole match is blanked.
const VALUE_PATTERNS = [
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, // AWS access key id
  /\bAC[0-9a-fA-F]{32}\b/g, // Twilio Account SID
  /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g, // Stripe key
  /\bwhsec_[A-Za-z0-9]{16,}\b/g, // Stripe webhook signing secret
  /\bsk-[A-Za-z0-9_-]{20,}\b/g, // OpenAI / Anthropic (sk-, sk-ant-, sk-proj-)
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/g, // GitHub token
  /\bgithub_pat_[A-Za-z0-9_]{40,}\b/g, // GitHub fine-grained PAT
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, // Slack
  /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g, // SendGrid
  /\bAIza[0-9A-Za-z_-]{30,}/g, // Google API key
  /\b[0-9]+-[a-z0-9]{32}\.apps\.googleusercontent\.com\b/g, // Google OAuth client id
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{6,}\b/g, // JWT
  /-----BEGIN [^-\n]+-----[\s\S]*?-----END [^-\n]+-----/g, // any PEM block (key/cert)
  /\b[A-Za-z0-9+/]{120,}={0,2}/g, // long base64 blob (encoded creds / cert body)
];

// Field/var names whose assigned VALUE is sensitive (substring, case-insensitive).
const SECRET_NAME =
  /(secret|pass(?:word|wd|phrase)?|token|api[_-]?key|access[_-]?key|secret[_-]?key|private[_-]?key|credential|client[_-]?secret|signing[_-]?key|auth[_-]?token|session[_-]?secret|encryption[_-]?key|webhook[_-]?secret|service[_-]?account|connection[_-]?string|database[_-]?url|\bdsn\b)/i;

// A value that's a string literal, a `"a" + "b"` concatenation, or a `["a","b"]` array.
const STRINGY_VALUE =
  /(\[[^\][]*\]|(?:["'`](?:\\.|[^"'`\\])*["'`]\s*\+\s*)*["'`](?:\\.|[^"'`\\])*["'`])/;

/** Redact secret values from a chunk of source. @returns {{ text: string, redactions: number }} */
export function sanitize(input) {
  let text = String(input);
  let redactions = 0;

  // 1) Connection-string userinfo — preserve scheme + host, drop user:pass.
  text = text.replace(CONN_STRING, (_m, scheme) => {
    redactions += 1;
    return `${scheme}${R}:${R}@`;
  });

  // 2) Credentials in URL query/property params (keep the param name).
  text = text.replace(QUERY_CREDS, (_m, key) => {
    redactions += 1;
    return `${key}${R}`;
  });

  // 3) `new sst.Secret("Name", "fallback")` — keep the NAME, redact the fallback VALUE.
  text = text.replace(
    /(\bnew\s+sst\.Secret\s*\(\s*["'`][^"'`]*["'`]\s*,\s*)(["'`])(?:\\.|(?!\2)[\s\S])*\2/g,
    (_m, head) => {
      redactions += 1;
      return `${head}"${R}"`;
    },
  );

  // 4) Known secret value shapes.
  for (const re of VALUE_PATTERNS) {
    text = text.replace(re, () => {
      redactions += 1;
      return R;
    });
  }

  // 4) Name heuristic: a secret-named field assigned a string / concat / array value.
  const NAMED = new RegExp(`([A-Za-z_$][\\w$]*)(\\s*[:=]\\s*)${STRINGY_VALUE.source}`, 'g');
  text = text.replace(NAMED, (full, name, mid, value) => {
    if (!SECRET_NAME.test(name)) return full;
    if (/process\.env|import\.meta/.test(value)) return full; // env ref, not a literal
    if (value === `"${R}"` || value === `'${R}'`) return full; // already redacted
    redactions += 1;
    return `${name}${mid}"${R}"`;
  });

  return { text, redactions };
}
