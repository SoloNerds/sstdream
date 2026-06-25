#!/usr/bin/env node
// SSTDREAM import collector. Run this in your SST project; it bundles every
// resource-defining file (sst.config.ts + your packages/infra/*.ts modules, wherever
// they live) into ONE blob you paste into the builder's "From code" import — because
// the browser builder can't read your filesystem.
//
// SAFETY: it runs entirely on YOUR machine and SANITIZES secrets before writing — it
// never reads .env files, and redacts hardcoded keys/tokens/passwords/connection
// strings (over-redacting on purpose). Review the output before pasting; nothing is
// uploaded anywhere by this script.
//
// Usage:  node sstdream-collect.mjs [projectDir]
//   (defaults to the current directory; output -> sstdream-import.txt)

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, sep, basename } from 'node:path';

const root = process.argv[2] ? process.argv[2] : process.cwd();

// Dirs we never descend into (heavy, generated, or secret-bearing).
const SKIP_DIRS = new Set([
  'node_modules',
  '.sst',
  '.git',
  '.next',
  'dist',
  'build',
  'out',
  '.turbo',
  '.vercel',
  'coverage',
  '.cache',
]);
const MAX_FILES = 200;
const MAX_BYTES = 600_000; // keep the paste manageable

/** Recursively list .ts/.tsx files, skipping heavy dirs and any .env / .d.ts. */
function listSourceFiles(dir) {
  let out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) out = out.concat(listSourceFiles(p));
    } else if (
      /\.(ts|tsx)$/.test(e.name) &&
      !e.name.endsWith('.d.ts') &&
      !/^\.env/i.test(e.name) // never touch env files
    ) {
      out.push(p);
    }
  }
  return out;
}

// A file matters if it DEFINES infrastructure (or is the app config). Resource usage
// (`Resource.Foo`) in a handler doesn't — we only want `new sst.*` / `$config`.
const DEFINES_INFRA = /(\bnew\s+sst\.|sst\.Linkable\b|\$config\s*\(|export\s+default\s+\$config)/;

function main() {
  const all = listSourceFiles(root);
  const infra = all.filter((f) => {
    try {
      return DEFINES_INFRA.test(readFileSync(f, 'utf8'));
    } catch {
      return false;
    }
  });

  if (infra.length === 0) {
    console.error(
      'No SST resource files found (looked for `new sst.*` / `$config`).\n' +
        'Run this from your SST project root (where sst.config.ts lives).',
    );
    process.exit(1);
  }

  // config first, then the rest sorted — stable, readable output.
  infra.sort((a, b) => {
    const ca = /sst\.config\.tsx?$/.test(a) ? 0 : 1;
    const cb = /sst\.config\.tsx?$/.test(b) ? 0 : 1;
    return ca - cb || a.localeCompare(b);
  });

  let blob = '';
  let totalRedactions = 0;
  let used = 0;
  let truncated = false;
  for (const f of infra) {
    if (used >= MAX_FILES || blob.length >= MAX_BYTES) {
      truncated = true;
      break;
    }
    const rel = relative(root, f).split(sep).join('/');
    const { text, redactions } = sanitize(readFileSync(f, 'utf8'));
    totalRedactions += redactions;
    blob += `// ===== FILE: ${rel} =====\n${text}\n\n`;
    used += 1;
  }

  const outPath = join(process.cwd(), 'sstdream-import.txt');
  writeFileSync(outPath, blob);

  console.log(
    `\n✓ Collected ${used} infra file(s)${truncated ? ' (truncated — large project)' : ''}.`,
  );
  console.log(`✓ Redacted ${totalRedactions} potential secret value(s).`);
  console.log(`\n→ Wrote ${basename(outPath)}. REVIEW it, then paste its contents into`);
  console.log(`  the builder's "From code" import (AWS lane).`);
  if (totalRedactions > 0) {
    console.log(`\n  Note: secret values were replaced with <REDACTED>. The diagram only`);
    console.log(`  needs your resources + links, not their secret values.`);
  }
  if (truncated) {
    console.log(`\n  Large project: only the first ${used} files were included. The diagram`);
    console.log(`  will show what was captured; the rest will be listed as "not recognized".`);
  }
}

import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

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
