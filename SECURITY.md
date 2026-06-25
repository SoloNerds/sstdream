# Security Policy

## The short version

SSTDREAM runs **entirely in your browser**. It never deploys anything, never asks for or
stores cloud credentials, and makes no network calls with your design. The most security-
relevant surface is therefore the **generated output**: the files this tool emits must be
correct and must not introduce an injection or misconfiguration into your project.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem. Instead:

- Use GitHub's **private vulnerability reporting** (Security → Report a vulnerability), or
- Contact the maintainers at @Nimdy.

Please include a description, reproduction steps, and (if relevant) the design that
triggers it. We'll acknowledge your report and work with you on a fix and disclosure
timeline.

## What counts as a vulnerability here

- **Generated-code injection** — a resource name or prop that escapes string position and
  injects executable code into an emitted file. (The export gate blocks the known classes;
  a bypass is a vulnerability.)
- **Silently broken/misconfigured output** that a user would deploy believing it is
  correct (e.g. a public resource emitted where a private one was intended).
- **Dependency vulnerabilities** in the builder itself.

## What is out of scope

- The security of the AWS/Vercel infrastructure you deploy from the generated files — that
  is yours to review before running `sst deploy` / `vercel`. The generated `README.md` and
  the Infrastructure view's audit surface the notable defaults (public Function URLs, NAT,
  etc.) to help.
