#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// cli/index.ts
import { writeFileSync } from "node:fs";
import { join as join2, resolve } from "node:path";

// cli/scan.ts
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

// lib/targets/aws-sst-v4/edges.ts
var AWS_EDGE_INTENTS = [
  {
    intent: "uploadsTo",
    label: "uploads to",
    description: "App writes objects to a bucket (signed-URL upload). Adds link + S3 helper.",
    from: ["nextjs", "worker", "service", "task"],
    to: ["bucket"]
  },
  {
    intent: "readsFrom",
    label: "reads from",
    description: "Reads from a bucket / table. Adds link + read helper.",
    from: ["nextjs", "worker", "service", "task"],
    to: ["bucket", "dynamo"]
  },
  {
    intent: "writesTo",
    label: "writes to",
    description: "Writes items to a Dynamo table. Adds link + Dynamo helper.",
    from: ["nextjs", "worker", "service", "task"],
    to: ["dynamo"]
  },
  {
    intent: "publishesTo",
    label: "publishes to",
    description: "Sends messages/events to a queue, bus, or topic. Adds link + send helper.",
    from: ["nextjs", "worker", "service", "task"],
    to: ["queue", "bus", "snstopic"]
  },
  {
    intent: "subscribesTo",
    label: "subscribes to",
    description: "A worker consumes a queue/bus/topic, or a Dynamo table stream (generates the subscribe() call; Dynamo needs stream enabled).",
    from: ["worker"],
    to: ["queue", "bus", "snstopic", "dynamo"]
  },
  {
    intent: "invokes",
    label: "invokes",
    description: "Cron triggers a worker/function on a schedule.",
    from: ["cron"],
    to: ["worker"]
  },
  {
    intent: "handlesRoute",
    label: "handles route on",
    description: "A worker handles an HTTP API route (api.route('METHOD /path', handler)).",
    from: ["worker"],
    to: ["apigatewayv2"]
  },
  {
    intent: "handlesBucketEvents",
    label: "handles events of",
    description: "A worker runs on S3 object events (bucket.notify \u2014 e.g. process uploads).",
    from: ["worker"],
    to: ["bucket"]
  },
  {
    intent: "routesBucket",
    label: "routes to bucket",
    description: "A Router serves a bucket at a path (router.routeBucket). Needs access: cloudfront.",
    from: ["router"],
    to: ["bucket"]
  },
  {
    intent: "routedBy",
    label: "routed by",
    description: "A static site is served under a Router at a path (router option).",
    from: ["staticsite"],
    to: ["router"]
  },
  {
    intent: "deadLettersTo",
    label: "dead-letters to",
    description: "Messages that fail repeatedly land in this queue (dlq: <queue>.arn).",
    from: ["queue"],
    to: ["queue"]
  },
  {
    intent: "usesSecret",
    label: "uses secret",
    description: "A component links a secret (Resource.<Secret>.value).",
    from: ["nextjs", "worker", "cron", "service", "task"],
    to: ["secret"]
  },
  {
    intent: "usesAI",
    label: "uses AI",
    description: "App/worker calls Claude; links the Anthropic API-key secret (apps also get a chat route).",
    from: ["nextjs", "worker", "service", "task"],
    to: ["ai"]
  },
  {
    intent: "queriesDb",
    label: "queries",
    description: "App/worker connects to RDS Postgres / Aurora (link + pg pool helper).",
    from: ["nextjs", "worker", "service", "task"],
    to: ["postgres", "aurora"]
  },
  {
    intent: "consumesGraphQL",
    label: "queries GraphQL",
    description: "App consumes an AppSync GraphQL endpoint (link \u2192 Resource.<Api>.url + a gql helper).",
    from: ["nextjs"],
    to: ["appsync"]
  },
  {
    intent: "resolvesFrom",
    label: "resolves from",
    description: "An AppSync resolver Lambda reads/writes a Dynamo table (data source link).",
    from: ["appsync"],
    to: ["dynamo"]
  },
  {
    intent: "usesCache",
    label: "caches in",
    description: "App/worker reads/writes ElastiCache Redis (link + ioredis Cluster helper). Joins the VPC.",
    from: ["nextjs", "worker", "service", "task"],
    to: ["redis"]
  },
  {
    intent: "runsTask",
    label: "runs task",
    description: "App runs a one-off Fargate Task via task.run() (links the task + emits a server action).",
    from: ["nextjs"],
    to: ["task"]
  },
  {
    intent: "usesRealtime",
    label: "streams via",
    description: "App publishes/serves WebSocket messages over IoT Realtime (link + IoT publish helper).",
    from: ["nextjs", "service"],
    to: ["realtime"]
  },
  {
    intent: "startsWorkflow",
    label: "starts",
    description: "App starts a Step Functions execution (links the state machine + emits a start action).",
    from: ["nextjs", "worker"],
    to: ["stepFunctions"]
  },
  {
    intent: "sendsEmail",
    label: "sends email through",
    description: "App/worker sends email via SES (link + SESv2 helper).",
    from: ["nextjs", "worker", "service", "task"],
    to: ["email"]
  },
  {
    intent: "usesStripe",
    label: "uses Stripe",
    description: "App integrates Stripe \u2014 webhook route + lib/stripe.ts + env keys.",
    from: ["nextjs"],
    to: ["stripe"]
  },
  {
    intent: "queriesMongo",
    label: "queries Mongo",
    description: "App/worker connects to MongoDB via DATABASE_URL (lib/mongo.ts).",
    from: ["nextjs", "worker", "service", "task"],
    to: ["mongodb"]
  },
  {
    intent: "callsApi",
    label: "calls",
    description: "App/worker calls an external API (lib helper + base-url/key env).",
    from: ["nextjs", "worker", "service", "task"],
    to: ["externalApi"]
  },
  {
    intent: "usesCognito",
    label: "authenticates with",
    description: "App/worker uses a Cognito user pool; apps get NEXT_PUBLIC_COGNITO_* injected.",
    from: ["nextjs", "worker", "service", "task"],
    to: ["cognito"]
  },
  {
    intent: "usesAuth",
    label: "authenticates with",
    description: "App uses Clerk \u2014 generates middleware.ts + Clerk env keys.",
    from: ["nextjs"],
    to: ["clerk"]
  },
  {
    intent: "usesOpenAuth",
    label: "authenticates with",
    description: "App uses a self-hosted OpenAuth issuer (sst.aws.Auth) \u2014 links it + generates the issuer/client/callback flow.",
    from: ["nextjs"],
    to: ["openauth"]
  }
];
var INTENT_BY_PAIR = {
  "nextjs>bucket": "uploadsTo",
  "worker>bucket": "readsFrom",
  "nextjs>dynamo": "writesTo",
  "worker>dynamo": "writesTo",
  "nextjs>queue": "publishesTo",
  "worker>queue": "subscribesTo",
  "nextjs>bus": "publishesTo",
  "worker>bus": "subscribesTo",
  "nextjs>snstopic": "publishesTo",
  "worker>snstopic": "subscribesTo",
  "cron>worker": "invokes",
  "queue>queue": "deadLettersTo",
  "worker>apigatewayv2": "handlesRoute",
  "router>bucket": "routesBucket",
  "staticsite>router": "routedBy",
  "nextjs>secret": "usesSecret",
  "worker>secret": "usesSecret",
  "cron>secret": "usesSecret",
  "nextjs>ai": "usesAI",
  "worker>ai": "usesAI",
  "nextjs>postgres": "queriesDb",
  "worker>postgres": "queriesDb",
  "nextjs>aurora": "queriesDb",
  "worker>aurora": "queriesDb",
  "nextjs>appsync": "consumesGraphQL",
  "appsync>dynamo": "resolvesFrom",
  "nextjs>redis": "usesCache",
  "worker>redis": "usesCache",
  "service>dynamo": "writesTo",
  "service>bucket": "readsFrom",
  "service>postgres": "queriesDb",
  "service>aurora": "queriesDb",
  "service>redis": "usesCache",
  "service>queue": "publishesTo",
  "service>bus": "publishesTo",
  "service>snstopic": "publishesTo",
  "service>secret": "usesSecret",
  "service>email": "sendsEmail",
  "nextjs>task": "runsTask",
  "task>dynamo": "writesTo",
  "task>bucket": "readsFrom",
  "task>postgres": "queriesDb",
  "task>aurora": "queriesDb",
  "task>redis": "usesCache",
  "task>queue": "publishesTo",
  "task>bus": "publishesTo",
  "task>snstopic": "publishesTo",
  "task>secret": "usesSecret",
  "task>email": "sendsEmail",
  "nextjs>realtime": "usesRealtime",
  "service>realtime": "usesRealtime",
  "nextjs>stepFunctions": "startsWorkflow",
  "worker>stepFunctions": "startsWorkflow",
  "nextjs>email": "sendsEmail",
  "worker>email": "sendsEmail",
  "nextjs>stripe": "usesStripe",
  "nextjs>mongodb": "queriesMongo",
  "worker>mongodb": "queriesMongo",
  "nextjs>externalApi": "callsApi",
  "worker>externalApi": "callsApi",
  "nextjs>cognito": "usesCognito",
  "worker>cognito": "usesCognito",
  "nextjs>clerk": "usesAuth",
  "nextjs>openauth": "usesOpenAuth"
};
function awsDefaultIntent(fromKind, toKind) {
  return INTENT_BY_PAIR[`${fromKind}>${toKind}`] ?? null;
}

// lib/targets/aws-sst-v4/reverse.ts
var COMPONENT_KIND = {
  Nextjs: "nextjs",
  StaticSite: "staticsite",
  Bucket: "bucket",
  Dynamo: "dynamo",
  Postgres: "postgres",
  Aurora: "aurora",
  Redis: "redis",
  Queue: "queue",
  Bus: "bus",
  SnsTopic: "snstopic",
  Realtime: "realtime",
  ApiGatewayV2: "apigatewayv2",
  AppSync: "appsync",
  Router: "router",
  Function: "worker",
  CronV2: "cron",
  Cron: "cron",
  // deprecated alias of CronV2 — same scheduled-function kind
  Email: "email",
  Service: "service",
  Task: "task",
  StepFunctions: "stepFunctions",
  CognitoUserPool: "cognito",
  Auth: "openauth",
  // sst.aws.Auth (self-hosted OpenAuth issuer)
  Secret: "secret"
  // sst.Secret (also how `ai` is rendered)
};
var GENERIC_KIND = "unknown";
var SKIP = /* @__PURE__ */ new Set(["Vpc", "Cluster"]);
var SCALAR_PROPS = {
  postgres: ["nat"],
  aurora: ["nat"],
  redis: ["engine"],
  stepFunctions: ["type"],
  service: ["cpu", "memory", "public"],
  task: ["cpu", "memory"]
};
function balancedRange(src, openIdx, open, close) {
  let depth = 0;
  let inStr = null;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (ch === "\\") i++;
      else if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") inStr = ch;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return { inner: src.slice(openIdx + 1, i), end: i };
    }
  }
  return { inner: src.slice(openIdx + 1), end: src.length };
}
function firstStringArg(args) {
  const m = args.match(/^\s*["'`]([^"'`]+)["'`]/);
  return m ? m[1] : null;
}
function splitTopLevel(s) {
  const out = [];
  let depth = 0;
  let inStr = null;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (ch === "\\") i++;
      else if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") inStr = ch;
    else if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    else if (ch === "," && depth === 0) {
      out.push(s.slice(start, i));
      start = i + 1;
    }
  }
  out.push(s.slice(start));
  return out.map((t) => t.trim()).filter(Boolean);
}
function linkTokens(args) {
  const idx = args.search(/\blink\s*:\s*\[/);
  if (idx === -1) return [];
  const bracket = args.indexOf("[", idx);
  return splitTopLevel(balancedRange(args, bracket, "[", "]").inner);
}
function extractScalars(kind, args) {
  const out = {};
  for (const key of SCALAR_PROPS[kind] ?? []) {
    const str2 = args.match(new RegExp(`\\b${key}\\s*:\\s*["'\`]([^"'\`]+)["'\`]`));
    if (str2) out[key] = str2[1];
  }
  if (kind === "service") out.public = /\bloadBalancer\s*:/.test(args) ? "yes" : "no";
  return out;
}
function parseAwsConfig(source) {
  const unrecognized = [];
  const ctors = [];
  const re = /(?:([A-Za-z_$][\w$]*)\s*[:=]\s*)?new\s+sst\.(?:aws\.)?([A-Za-z0-9]+)\s*\(/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const component = m[2];
    if (SKIP.has(component)) continue;
    const ref = m[0].includes("sst.aws.") ? `sst.aws.${component}` : `sst.${component}`;
    const parenIdx = source.indexOf("(", m.index + m[0].length - 1);
    const { inner: args, end } = balancedRange(source, parenIdx, "(", ")");
    ctors.push({
      component,
      ref,
      kind: COMPONENT_KIND[component] ?? GENERIC_KIND,
      name: firstStringArg(args),
      args,
      binding: m[1],
      start: m.index,
      end
    });
  }
  const nodes = [];
  const counters = {};
  const bindToIds = /* @__PURE__ */ new Map();
  for (const c of ctors) {
    if (!c.name) {
      unrecognized.push({
        snippet: `new ${c.ref}(\u2026)`,
        reason: "could not read the resource name (expected a string-literal first argument)"
      });
      continue;
    }
    const n = counters[c.kind] = (counters[c.kind] ?? 0) + 1;
    c.id = `${c.kind}_${n}`;
    nodes.push({
      id: c.id,
      kind: c.kind,
      name: c.name,
      props: c.kind === GENERIC_KIND ? { sstComponent: c.ref } : extractScalars(c.kind, c.args),
      position: { x: 0, y: 0 }
    });
    if (c.binding) bindToIds.set(c.binding, [c.id]);
    if (c.kind === GENERIC_KIND) {
      unrecognized.push({
        snippet: `new ${c.ref}("${c.name}")`,
        reason: `${c.ref} isn't modeled by the builder yet \u2014 shown as a generic node`
      });
    }
  }
  const objToIds = /* @__PURE__ */ new Map();
  const propToId = /* @__PURE__ */ new Map();
  const objRe = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\{/g;
  let o;
  while ((o = objRe.exec(source)) !== null) {
    const objName = o[1];
    const braceIdx = source.indexOf("{", o.index + o[0].length - 1);
    const { end } = balancedRange(source, braceIdx, "{", "}");
    const members = ctors.filter((c) => c.id && c.binding && c.start > braceIdx && c.end < end);
    if (!members.length) continue;
    objToIds.set(
      objName,
      members.map((c) => c.id)
    );
    for (const c of members) propToId.set(`${objName}.${c.binding}`, c.id);
  }
  const resolveRef = (raw) => {
    const token = raw.trim().replace(/^\.\.\.\s*/, "");
    let mm;
    if (mm = token.match(/^Object\.values\(\s*([A-Za-z_$][\w$]*)\s*\)$/)) {
      return objToIds.get(mm[1]) ?? [];
    }
    if (mm = token.match(/^([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)$/)) {
      const id = propToId.get(`${mm[1]}.${mm[2]}`);
      return id ? [id] : [];
    }
    if (token.startsWith("[")) {
      return splitTopLevel(token.slice(1, -1)).flatMap(resolveRef);
    }
    if (/^[A-Za-z_$][\w$]*$/.test(token)) {
      return bindToIds.get(token) ?? objToIds.get(token) ?? [];
    }
    return [];
  };
  const helperRe = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(Object\.values\(\s*[A-Za-z_$][\w$]*\s*\)|\[[^\]]*\])/g;
  let h;
  while ((h = helperRe.exec(source)) !== null) {
    const ids = resolveRef(h[2]);
    if (ids.length) bindToIds.set(h[1], ids);
  }
  for (const c of ctors) {
    if (c.id && c.kind === "cron" && /\b(?:function|job)\s*:/.test(c.args)) {
      const wn = counters.worker = (counters.worker ?? 0) + 1;
      c.fnWorkerId = `worker_${wn}`;
      nodes.push({
        id: c.fnWorkerId,
        kind: "worker",
        name: `${c.name}Handler`,
        props: {},
        position: { x: 0, y: 0 }
      });
    }
  }
  const idToKind = new Map(nodes.map((n) => [n.id, n.kind]));
  const edges = [];
  let edgeN = 0;
  const seen = /* @__PURE__ */ new Set();
  const addEdge = (src, tgt, intent) => {
    const key = `${src}->${tgt}`;
    if (src !== tgt && !seen.has(key)) {
      seen.add(key);
      edges.push({ id: `edge_${++edgeN}`, source: src, target: tgt, intent });
    }
  };
  const linkFrom = (sourceId, sourceKind, sourceName, args) => {
    for (const token of linkTokens(args)) {
      const targets = resolveRef(token);
      if (targets.length === 0) {
        const bare = token.replace(/^\.\.\.\s*/, "");
        if (/^[A-Za-z_$][\w$.]*$/.test(bare)) {
          unrecognized.push({
            snippet: `${sourceName} \u2192 link: [${token}]`,
            reason: `links "${bare}", which wasn't recognized as a resource`
          });
        }
        continue;
      }
      for (const tId of targets) {
        const intent = awsDefaultIntent(sourceKind, idToKind.get(tId));
        if (intent) addEdge(sourceId, tId, intent);
      }
    }
  };
  for (const c of ctors) {
    if (!c.id) continue;
    if (c.fnWorkerId) {
      addEdge(c.id, c.fnWorkerId, "invokes");
      linkFrom(c.fnWorkerId, "worker", c.name, c.args);
    } else {
      linkFrom(c.id, c.kind, c.name, c.args);
    }
  }
  const routeRe = /([A-Za-z_$][\w$]*)\.route\s*\(/g;
  let rt;
  while ((rt = routeRe.exec(source)) !== null) {
    const ids = bindToIds.get(rt[1]);
    if (!ids?.length) continue;
    const parenIdx = source.indexOf("(", rt.index + rt[0].length - 1);
    const { inner } = balancedRange(source, parenIdx, "(", ")");
    const srcId = ids[0];
    linkFrom(srcId, idToKind.get(srcId), rt[1], inner);
  }
  const subRe = /([A-Za-z_$][\w$]*)\.subscribe\(\s*["'`]([^"'`]+)["'`]/g;
  let s;
  while ((s = subRe.exec(source)) !== null) {
    const targetIds = bindToIds.get(s[1]);
    const workerName = s[2];
    if (!targetIds?.length || workerName.includes("/") || workerName.includes(".handler")) continue;
    const wn = counters.worker = (counters.worker ?? 0) + 1;
    const workerId = `worker_${wn}`;
    nodes.push({
      id: workerId,
      kind: "worker",
      name: workerName,
      props: {},
      position: { x: 0, y: 0 }
    });
    idToKind.set(workerId, "worker");
    addEdge(workerId, targetIds[0], "subscribesTo");
  }
  layout(nodes, edges);
  return { nodes, edges, unrecognized };
}
function layout(nodes, edges) {
  const COL = 320;
  const ROW = 120;
  const hasOutgoing = new Set(edges.map((e) => e.source));
  const col = /* @__PURE__ */ new Map();
  for (const n of nodes) col.set(n.id, hasOutgoing.has(n.id) ? 0 : 1);
  const connected = /* @__PURE__ */ new Set([...edges.map((e) => e.source), ...edges.map((e) => e.target)]);
  for (const n of nodes) if (!connected.has(n.id)) col.set(n.id, 0);
  const rowOf = {};
  for (const n of nodes) {
    const c = col.get(n.id) ?? 0;
    const row = (rowOf[c] = (rowOf[c] ?? 0) + 1) - 1;
    n.position = { x: 60 + c * COL, y: 60 + row * ROW };
  }
}

// lib/targets/vercel/edges.ts
var VERCEL_EDGE_INTENTS = [
  {
    intent: "storesFileIn",
    label: "stores files in",
    description: "App uploads to Blob. Generates a Blob helper + upload route.",
    from: ["app"],
    to: ["blob"]
  },
  {
    intent: "writesToService",
    label: "writes to",
    description: "App writes to an external DB / Redis. Generates a client helper + env.",
    from: ["app"],
    to: ["postgres", "redis"]
  },
  {
    intent: "readsFromService",
    label: "reads from",
    description: "App reads from an external DB / Redis. Generates a client helper + env.",
    from: ["app"],
    to: ["postgres", "redis"]
  },
  {
    intent: "enqueuesTo",
    label: "enqueues to",
    description: "App sends messages to a Vercel Queue. Generates a send() producer.",
    from: ["app"],
    to: ["queue"]
  },
  {
    intent: "consumedBy",
    label: "consumed by",
    description: "A consumer processes the queue. Generates a handleCallback route + trigger.",
    from: ["queue"],
    to: ["consumer"]
  },
  {
    intent: "sendsEmailThrough",
    label: "sends email through",
    description: "App sends email via Resend. Generates a Resend helper + env.",
    from: ["app"],
    to: ["email"]
  },
  {
    intent: "readsConfig",
    label: "reads config from",
    description: "App reads low-latency config from Edge Config. Generates a helper + env.",
    from: ["app"],
    to: ["edgeConfig"]
  },
  {
    intent: "callsApi",
    label: "calls",
    description: "App calls a third-party HTTP API. Generates a typed fetch helper + env.",
    from: ["app"],
    to: ["externalApi"]
  },
  {
    intent: "triggersWorkflow",
    label: "triggers",
    description: "App starts a durable Workflow (start() \u2014 non-blocking). Generates a trigger route.",
    from: ["app"],
    to: ["workflow"]
  },
  {
    intent: "readsFlags",
    label: "reads flags from",
    description: "App reads feature flags (flags SDK). Generates flags.ts + a discovery endpoint.",
    from: ["app"],
    to: ["featureFlags"]
  },
  {
    intent: "flagsBackedBy",
    label: "backed by",
    description: "Feature flags read values from Edge Config (switches to the edgeConfigAdapter).",
    from: ["featureFlags"],
    to: ["edgeConfig"]
  },
  {
    intent: "runsCode",
    label: "runs code in",
    description: "App runs untrusted/AI-generated code in an ephemeral Sandbox microVM.",
    from: ["app"],
    to: ["sandbox"]
  }
];
var INTENT_BY_PAIR2 = {
  "app>blob": "storesFileIn",
  "app>postgres": "writesToService",
  "app>redis": "writesToService",
  "app>queue": "enqueuesTo",
  "queue>consumer": "consumedBy",
  "app>email": "sendsEmailThrough",
  "app>edgeConfig": "readsConfig",
  "app>externalApi": "callsApi",
  "app>workflow": "triggersWorkflow",
  "app>featureFlags": "readsFlags",
  "featureFlags>edgeConfig": "flagsBackedBy",
  "app>sandbox": "runsCode"
};
function vercelDefaultIntent(fromKind, toKind) {
  if (fromKind === toKind) return null;
  return INTENT_BY_PAIR2[`${fromKind}>${toKind}`] ?? null;
}

// lib/targets/vercel/reverse.ts
var DEP_KIND = {
  "@vercel/blob": "blob",
  "@neondatabase/serverless": "postgres",
  "@upstash/redis": "redis",
  "@vercel/queue": "queue",
  "@vercel/edge-config": "edgeConfig",
  "@vercel/analytics": "analytics",
  "@vercel/speed-insights": "speedInsights",
  ai: "aiGateway",
  workflow: "workflow",
  flags: "featureFlags",
  "@vercel/firewall": "rateLimit",
  "@vercel/functions": "edgeMiddleware",
  botid: "botId",
  "@vercel/sandbox": "sandbox",
  resend: "email",
  stripe: "webhook"
};
var IGNORED_DEPS = /* @__PURE__ */ new Set([
  "next",
  "react",
  "react-dom",
  "@ai-sdk/react",
  "@flags-sdk/edge-config",
  "zod",
  "typescript"
]);
var DEFAULT_NAME = {
  app: "Web",
  blob: "Files",
  postgres: "Db",
  redis: "Cache",
  queue: "Jobs",
  edgeConfig: "Config",
  analytics: "Analytics",
  speedInsights: "SpeedInsights",
  aiGateway: "Chat",
  workflow: "Workflow",
  featureFlags: "Flags",
  rateLimit: "RateLimit",
  edgeMiddleware: "Proxy",
  botId: "BotId",
  sandbox: "Sandbox",
  email: "Mailer",
  webhook: "Webhook",
  cron: "Daily"
};
function parseVercelConfig(source) {
  const unrecognized = [];
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch {
    return {
      nodes: [],
      edges: [],
      unrecognized: [{ snippet: "(not JSON)", reason: "paste a package.json or vercel.json" }]
    };
  }
  const nodes = [];
  const edges = [];
  const counters = {};
  const add = (kind, name) => {
    const n = counters[kind] = (counters[kind] ?? 0) + 1;
    const id = `${kind}_${n}`;
    nodes.push({
      id,
      kind,
      name: name ?? `${DEFAULT_NAME[kind] ?? kind}${n > 1 ? n : ""}`,
      props: {},
      position: { x: 0, y: 0 }
    });
    return id;
  };
  const deps = parsed.dependencies;
  const crons = parsed.crons;
  if (deps && typeof deps === "object") {
    const appId = add("app");
    const seen = /* @__PURE__ */ new Set();
    for (const dep of Object.keys(deps)) {
      const kind = DEP_KIND[dep];
      if (!kind) {
        if (dep.startsWith("@vercel/") && !IGNORED_DEPS.has(dep)) {
          unrecognized.push({ snippet: dep, reason: `the "${dep}" dependency isn't modeled yet` });
        }
        continue;
      }
      if (seen.has(kind)) continue;
      seen.add(kind);
      const id = add(kind);
      const intent = vercelDefaultIntent("app", kind);
      if (intent) edges.push({ id: `edge_${edges.length + 1}`, source: appId, target: id, intent });
    }
  } else if (Array.isArray(crons)) {
    for (const c of crons) {
      const path = typeof c?.path === "string" ? c.path : void 0;
      add("cron", path ? path.split("/").filter(Boolean).pop() : void 0);
    }
  } else {
    unrecognized.push({
      snippet: "(no dependencies or crons)",
      reason: 'expected a package.json (with "dependencies") or a vercel.json (with "crons")'
    });
  }
  layout2(nodes, edges);
  return { nodes, edges, unrecognized };
}
function layout2(nodes, edges) {
  const COL = 320;
  const ROW = 110;
  const sources = new Set(edges.map((e) => e.source));
  let appRow = 0;
  let intRow = 0;
  for (const n of nodes) {
    const isApp = sources.has(n.id) || n.kind === "app";
    if (isApp) n.position = { x: 60, y: 60 + appRow++ * ROW };
    else n.position = { x: 60 + COL, y: 60 + intRow++ * ROW };
  }
}

// node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});

// node_modules/zod/v3/helpers/util.js
var util;
(function(util2) {
  util2.assertEqual = (_) => {
  };
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};

// node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};
var ZodError = class _ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};

// node_modules/zod/v3/locales/en.js
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
var en_default = errorMap;

// node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map2) {
  overrideErrorMap = map2;
}
function getErrorMap() {
  return overrideErrorMap;
}

// node_modules/zod/v3/helpers/parseUtil.js
var makeIssue = (params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map2 of maps) {
    errorMessage = map2(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
var ParseStatus = class _ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x) => x.status === "aborted";
var isDirty = (x) => x.status === "dirty";
var isValid = (x) => x.status === "valid";
var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;

// node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

// node_modules/zod/v3/types.js
var ParseInputLazyPath = class {
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
var ZodType = class {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
var ZodString = class _ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
var ZodNumber = class _ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodBigInt = class _ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
var ZodBoolean = class extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodDate = class _ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var ZodSymbol = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var ZodUndefined = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var ZodNull = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var ZodAny = class extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var ZodUnknown = class extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var ZodNever = class extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var ZodVoid = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var ZodArray = class _ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
var ZodObject = class _ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") {
      } else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var ZodUnion = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};
var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
var ZodIntersection = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var ZodTuple = class _ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var ZodRecord = class _ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
var ZodMap = class extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var ZodSet = class _ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var ZodFunction = class _ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
var ZodLazy = class extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var ZodLiteral = class extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
var ZodEnum = class _ZodEnum extends ZodType {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var ZodPromise = class extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var ZodEffects = class extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg2) => {
        addIssueToContext(ctx, arg2);
        if (arg2.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
};
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var ZodOptional = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var ZodNullable = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var ZodDefault = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var ZodCatch = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var ZodNaN = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
};
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = Symbol("zod_brand");
var ZodBranded = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline = class _ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new _ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
var ZodReadonly = class extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: (arg2) => ZodString.create({ ...arg2, coerce: true }),
  number: (arg2) => ZodNumber.create({ ...arg2, coerce: true }),
  boolean: (arg2) => ZodBoolean.create({
    ...arg2,
    coerce: true
  }),
  bigint: (arg2) => ZodBigInt.create({ ...arg2, coerce: true }),
  date: (arg2) => ZodDate.create({ ...arg2, coerce: true })
};
var NEVER = INVALID;

// lib/core/blueprint/schema.ts
var BLUEPRINT_VERSION = "0.1.0";
var DeployTargetSchema = external_exports.enum(["aws-sst-v4", "vercel"]);
var PackageManagerSchema = external_exports.enum(["npm", "yarn", "pnpm", "bun"]);
var RemovalSchema = external_exports.enum(["remove", "retain", "retain-all"]);
var PositionSchema = external_exports.object({
  x: external_exports.number(),
  y: external_exports.number()
});
var StagePolicySchema = external_exports.object({
  name: external_exports.string().min(1),
  removal: RemovalSchema.optional(),
  protect: external_exports.boolean().optional()
});
var ResourceSchema = external_exports.object({
  id: external_exports.string().min(1),
  kind: external_exports.string().min(1),
  name: external_exports.string().min(1),
  props: external_exports.record(external_exports.string(), external_exports.unknown()).default({}),
  position: PositionSchema
});
var ConnectionSchema = external_exports.object({
  id: external_exports.string().min(1),
  source: external_exports.string().min(1),
  target: external_exports.string().min(1),
  intent: external_exports.string().min(1)
});
var SecretSchema = external_exports.object({
  id: external_exports.string().min(1),
  name: external_exports.string().min(1)
});
var OutputSchema = external_exports.object({
  id: external_exports.string().min(1),
  name: external_exports.string().min(1),
  /** Resource id + property, e.g. "<resourceId>.url". */
  valueRef: external_exports.string().min(1)
});
var TargetConfigSchema = external_exports.object({
  deploy: DeployTargetSchema,
  iac: external_exports.enum(["sst", "none"]),
  sstMajor: external_exports.number().int().optional(),
  awsProviderMajor: external_exports.number().int().optional(),
  providerModel: external_exports.string().optional()
});
var AppConfigSchema = external_exports.object({
  name: external_exports.string().min(1).regex(/^[a-z][a-z0-9-]*$/, "lowercase letters, numbers and dashes; must start with a letter"),
  framework: external_exports.literal("nextjs"),
  packageManager: PackageManagerSchema,
  region: external_exports.string().min(1),
  stages: external_exports.array(StagePolicySchema).default([])
});
var MetadataSchema = external_exports.object({
  createdAt: external_exports.string(),
  updatedAt: external_exports.string(),
  generatedBy: external_exports.literal("sstdream")
});
var BlueprintSchema = external_exports.object({
  version: external_exports.literal(BLUEPRINT_VERSION),
  target: TargetConfigSchema,
  app: AppConfigSchema,
  resources: external_exports.array(ResourceSchema),
  connections: external_exports.array(ConnectionSchema),
  secrets: external_exports.array(SecretSchema).default([]),
  outputs: external_exports.array(OutputSchema).default([]),
  metadata: MetadataSchema
});

// lib/targets/aws-sst-v4/catalog.ts
var AWS_CATALOG = {
  nextjs: {
    kind: "nextjs",
    label: "Next.js Web",
    defaultName: "Web",
    component: "sst.aws.Nextjs",
    description: "Next.js app on AWS (OpenNext \u2192 Lambda/S3/CloudFront)",
    accent: "bg-neutral-800",
    category: "compute",
    singleton: true,
    props: [
      { key: "path", label: "Path", type: "text", default: ".", placeholder: "." },
      { key: "domain", label: "Custom domain", type: "text", placeholder: "app.example.com" },
      { key: "environment", label: "Environment variables", type: "keyvalue" }
    ]
  },
  staticsite: {
    kind: "staticsite",
    label: "Static Site",
    defaultName: "Site",
    component: "sst.aws.StaticSite",
    description: "Static / SPA site on its own CloudFront (S3 + CDN)",
    accent: "bg-slate-700",
    category: "compute",
    props: [
      { key: "path", label: "Path", type: "text", default: ".", placeholder: "packages/web" },
      { key: "buildCommand", label: "Build command", type: "text", placeholder: "npm run build" },
      { key: "buildOutput", label: "Build output dir", type: "text", placeholder: "dist" },
      {
        key: "routePath",
        label: "Router path (when routed)",
        type: "text",
        placeholder: "/docs",
        help: "Path pattern when a Router serves this site."
      }
    ]
  },
  bucket: {
    kind: "bucket",
    label: "Bucket",
    defaultName: "Bucket",
    component: "sst.aws.Bucket",
    description: "S3 bucket for object storage / uploads",
    accent: "bg-emerald-600",
    category: "storage",
    props: [
      {
        key: "access",
        label: "Public access",
        type: "select",
        default: "none",
        options: [
          { value: "none", label: "Private (default)" },
          { value: "public", label: "Public" },
          { value: "cloudfront", label: "CloudFront" }
        ]
      },
      {
        key: "routePath",
        label: "Router path (when routed)",
        type: "text",
        placeholder: "/files",
        help: "Path pattern when a Router serves this bucket. Requires access: CloudFront."
      }
    ]
  },
  dynamo: {
    kind: "dynamo",
    label: "Dynamo",
    defaultName: "Table",
    component: "sst.aws.Dynamo",
    description: "DynamoDB table",
    accent: "bg-sky-600",
    category: "database",
    props: [
      { key: "hashKey", label: "Partition key", type: "text", default: "pk", placeholder: "pk" },
      {
        key: "rangeKey",
        label: "Sort key",
        type: "text",
        default: "sk",
        placeholder: "sk (optional)"
      },
      {
        key: "gsiName",
        label: "GSI name (optional)",
        type: "text",
        placeholder: "byStatus",
        help: "Adds a global secondary index for querying by a non-key attribute."
      },
      { key: "gsiHashKey", label: "GSI partition key", type: "text", placeholder: "status" },
      {
        key: "gsiRangeKey",
        label: "GSI sort key (optional)",
        type: "text",
        placeholder: "createdAt"
      },
      {
        key: "stream",
        label: "Stream",
        type: "select",
        default: "none",
        options: [
          { value: "none", label: "Off" },
          { value: "new-and-old-images", label: "New + old images" },
          { value: "new-image", label: "New image" },
          { value: "old-image", label: "Old image" },
          { value: "keys-only", label: "Keys only" }
        ],
        help: "Enable a change stream so a Worker can subscribe to inserts/updates/deletes. Auto-enabled when a subscriber is wired."
      }
    ]
  },
  queue: {
    kind: "queue",
    label: "Queue",
    defaultName: "Queue",
    component: "sst.aws.Queue",
    description: "SQS queue with a Lambda subscriber (connect queue \u2192 queue for a DLQ)",
    accent: "bg-amber-600",
    category: "messaging",
    props: [
      { key: "fifo", label: "FIFO queue", type: "boolean", default: false },
      {
        key: "visibilityTimeout",
        label: "Visibility timeout",
        type: "text",
        placeholder: "360 seconds",
        help: "Defaults to 6\xD7 the largest subscriber timeout (AWS requires \u2265 the subscriber timeout). Set to override."
      }
    ]
  },
  bus: {
    kind: "bus",
    label: "Event Bus",
    defaultName: "Bus",
    component: "sst.aws.Bus",
    description: "EventBridge bus \u2014 pub/sub events to Lambda subscribers",
    accent: "bg-amber-500",
    category: "messaging"
  },
  snstopic: {
    kind: "snstopic",
    label: "SNS Topic",
    defaultName: "Topic",
    component: "sst.aws.SnsTopic",
    description: "SNS topic \u2014 fan-out messages to subscribers",
    accent: "bg-rose-500",
    category: "messaging",
    props: [{ key: "fifo", label: "FIFO topic", type: "boolean", default: false }]
  },
  apigatewayv2: {
    kind: "apigatewayv2",
    label: "HTTP API",
    defaultName: "Api",
    component: "sst.aws.ApiGatewayV2",
    description: "HTTP API Gateway \u2014 workers handle routes (METHOD /path)",
    accent: "bg-sky-600",
    category: "network"
  },
  router: {
    kind: "router",
    label: "Router",
    defaultName: "Router",
    component: "sst.aws.Router",
    description: "CloudFront front-door that routes paths to buckets / static sites",
    accent: "bg-indigo-500",
    category: "network",
    props: [{ key: "domain", label: "Custom domain", type: "text", placeholder: "example.com" }]
  },
  worker: {
    kind: "worker",
    label: "Worker",
    defaultName: "Worker",
    component: "sst.aws.Function",
    description: "Lambda function (queue subscriber / job / API route handler)",
    accent: "bg-violet-600",
    category: "compute",
    props: [
      {
        key: "timeout",
        label: "Timeout",
        type: "text",
        default: "60 seconds",
        placeholder: "60 seconds"
      },
      {
        key: "memory",
        label: "Memory",
        type: "text",
        placeholder: "1024 MB",
        help: 'e.g. "1024 MB"'
      },
      {
        key: "route",
        label: "API route (when wired to an HTTP API)",
        type: "text",
        default: "GET /",
        placeholder: "POST /webhooks/stripe"
      }
    ]
  },
  cron: {
    kind: "cron",
    label: "Cron",
    defaultName: "Cron",
    component: "sst.aws.CronV2",
    description: "Scheduled Lambda (CronV2 \u2014 not the deprecated Cron)",
    accent: "bg-rose-600",
    category: "schedule",
    props: [
      {
        key: "schedule",
        label: "Schedule",
        type: "text",
        default: "rate(1 day)",
        placeholder: "rate(1 day) | cron(0 5 * * ? *)"
      }
    ]
  },
  secret: {
    kind: "secret",
    label: "Secret",
    defaultName: "Secret",
    component: "sst.Secret",
    description: "Encrypted secret, set via `sst secret set`",
    accent: "bg-stone-600",
    category: "config"
  },
  postgres: {
    kind: "postgres",
    label: "Postgres",
    defaultName: "Database",
    component: "sst.aws.Postgres",
    description: "RDS Postgres (a VPC is generated automatically)",
    accent: "bg-cyan-700",
    category: "database",
    props: [
      {
        key: "nat",
        label: "NAT (internet from private subnets)",
        type: "select",
        default: "none",
        options: [
          { value: "none", label: "None \u2014 cheapest, no internet egress" },
          { value: "ec2", label: "fck-nat EC2 \u2014 ~$4/mo (\u224810\xD7 cheaper)" },
          { value: "managed", label: "Managed NAT Gateway \u2014 ~$32/mo/AZ" }
        ],
        help: 'SST VPCs have no NAT by default. When app code queries this database it joins the VPC, and the export auto-adds fck-nat (nat: "ec2", ~$4/mo) so those Lambdas keep internet egress. Pick managed only for heavy egress.'
      }
    ]
  },
  aurora: {
    kind: "aurora",
    label: "Aurora",
    defaultName: "Database",
    component: "sst.aws.Aurora",
    description: "Aurora Postgres Serverless v2 (auto-scaling; a VPC is generated)",
    accent: "bg-cyan-800",
    category: "database",
    props: [
      {
        key: "nat",
        label: "NAT (internet from private subnets)",
        type: "select",
        default: "none",
        options: [
          { value: "none", label: "None \u2014 cheapest, no internet egress" },
          { value: "ec2", label: "fck-nat EC2 \u2014 ~$4/mo (\u224810\xD7 cheaper)" },
          { value: "managed", label: "Managed NAT Gateway \u2014 ~$32/mo/AZ" }
        ],
        help: "Same VPC/NAT behavior as Postgres \u2014 no NAT by default; the export auto-adds fck-nat when app code queries this database."
      }
    ]
  },
  redis: {
    kind: "redis",
    label: "Redis",
    defaultName: "Cache",
    component: "sst.aws.Redis",
    description: "ElastiCache Redis/Valkey (in-VPC; cluster-mode; a VPC is generated)",
    accent: "bg-red-700",
    category: "database",
    props: [
      {
        key: "engine",
        label: "Engine",
        type: "select",
        default: "redis",
        options: [
          { value: "redis", label: "Redis (OSS 7.1)" },
          { value: "valkey", label: "Valkey 7.2 \u2014 ~20% cheaper" }
        ],
        help: "ElastiCache engine. Valkey is the AWS/Linux-Foundation Redis fork \u2014 cheaper, wire-compatible. Cluster mode is on by default, so the runtime uses ioredis Cluster + TLS."
      }
    ]
  },
  service: {
    kind: "service",
    label: "Service (Container)",
    defaultName: "Service",
    component: "sst.aws.Service",
    description: "Long-running container on ECS Fargate (a Cluster + VPC are generated)",
    accent: "bg-orange-700",
    category: "compute",
    props: [
      {
        key: "cpu",
        label: "CPU",
        type: "select",
        default: "0.25 vCPU",
        options: [
          { value: "0.25 vCPU", label: "0.25 vCPU" },
          { value: "0.5 vCPU", label: "0.5 vCPU" },
          { value: "1 vCPU", label: "1 vCPU" },
          { value: "2 vCPU", label: "2 vCPU" },
          { value: "4 vCPU", label: "4 vCPU" }
        ],
        help: "Fargate vCPU. Must form a valid CPU/memory pair. Billed per vCPU-second while a task runs (24/7 for an always-on service)."
      },
      {
        key: "memory",
        label: "Memory",
        type: "text",
        default: "0.5 GB",
        placeholder: "0.5 GB",
        help: 'Fargate memory, e.g. "0.5 GB", "2 GB". Constrained by the chosen CPU per Fargate rules.'
      },
      {
        key: "port",
        label: "Container port",
        type: "number",
        default: 3e3,
        placeholder: "3000",
        help: "The port your container listens on. A public service gets an ALB that forwards :80 \u2192 this port."
      },
      {
        key: "public",
        label: "Expose publicly (ALB)",
        type: "select",
        default: "yes",
        options: [
          { value: "yes", label: "Yes \u2014 Application Load Balancer + public URL" },
          { value: "no", label: "No \u2014 private (in-VPC / CloudMap only)" }
        ],
        help: "Public adds an ALB (~$16/mo) and a service.url. Private services are reachable only inside the VPC."
      }
    ]
  },
  task: {
    kind: "task",
    label: "Task (Batch)",
    defaultName: "Task",
    component: "sst.aws.Task",
    description: "One-off / on-demand Fargate job (run via task.run; reuses the Cluster)",
    accent: "bg-amber-700",
    category: "compute",
    props: [
      {
        key: "cpu",
        label: "CPU",
        type: "select",
        default: "0.25 vCPU",
        options: [
          { value: "0.25 vCPU", label: "0.25 vCPU" },
          { value: "0.5 vCPU", label: "0.5 vCPU" },
          { value: "1 vCPU", label: "1 vCPU" },
          { value: "2 vCPU", label: "2 vCPU" },
          { value: "4 vCPU", label: "4 vCPU" }
        ],
        help: "Fargate vCPU for the job. Billed per-run by the second (1-min minimum) \u2014 no idle cost."
      },
      {
        key: "memory",
        label: "Memory",
        type: "text",
        default: "0.5 GB",
        placeholder: "0.5 GB",
        help: 'Fargate memory, e.g. "0.5 GB", "2 GB". Must form a valid CPU/memory pair.'
      }
    ]
  },
  stepFunctions: {
    kind: "stepFunctions",
    label: "Step Functions",
    defaultName: "Workflow",
    component: "sst.aws.StepFunctions",
    description: "Durable, multi-step state machine (the AWS analog to a durable workflow)",
    accent: "bg-fuchsia-700",
    category: "compute",
    props: [
      {
        key: "type",
        label: "Type",
        type: "select",
        default: "standard",
        options: [
          { value: "standard", label: "Standard \u2014 durable, long-running" },
          { value: "express", label: "Express \u2014 high-volume, <5min, at-least-once" }
        ],
        help: "Standard is durable orchestration (per-transition billing). Express runs the whole flow in one Lambda context. Changing this REPLACES the machine (drops in-flight runs)."
      }
    ]
  },
  realtime: {
    kind: "realtime",
    label: "Realtime",
    defaultName: "Realtime",
    component: "sst.aws.Realtime",
    description: "WebSocket pub/sub over AWS IoT (authorizer + publish + subscribe)",
    accent: "bg-sky-700",
    category: "messaging",
    singleton: true
  },
  appsync: {
    kind: "appsync",
    label: "AppSync (GraphQL)",
    defaultName: "Graph",
    component: "sst.aws.AppSync",
    description: "Managed GraphQL API (schema + Lambda resolvers; optional Dynamo data source)",
    accent: "bg-pink-700",
    category: "network"
  },
  email: {
    kind: "email",
    label: "Email",
    defaultName: "Mailer",
    component: "sst.aws.Email",
    description: "Transactional email via Amazon SES",
    accent: "bg-orange-600",
    category: "config",
    props: [
      {
        key: "sender",
        label: "Sender (email or domain)",
        type: "text",
        placeholder: "noreply@example.com"
      }
    ]
  },
  stripe: {
    kind: "stripe",
    label: "Stripe",
    defaultName: "Stripe",
    component: "Stripe (payments + webhook)",
    description: "Stripe payments \u2014 generates a webhook route + env keys",
    accent: "bg-indigo-600",
    category: "config"
  },
  mongodb: {
    kind: "mongodb",
    label: "MongoDB",
    defaultName: "Mongo",
    component: "MongoDB (Atlas)",
    description: "External MongoDB via DATABASE_URL (no AWS infra)",
    accent: "bg-green-700",
    category: "database"
  },
  externalApi: {
    kind: "externalApi",
    label: "External API",
    defaultName: "ExternalApi",
    component: "External API (fetch)",
    description: "Any third-party API \u2014 base URL + API key env vars",
    accent: "bg-teal-600",
    category: "network",
    props: [
      {
        key: "baseUrlEnv",
        label: "Base URL env var",
        type: "text",
        default: "API_BASE_URL",
        placeholder: "API_BASE_URL"
      },
      {
        key: "keyEnv",
        label: "API key env var",
        type: "text",
        default: "API_KEY",
        placeholder: "API_KEY"
      }
    ]
  },
  cognito: {
    kind: "cognito",
    label: "Cognito Auth",
    defaultName: "AuthPool",
    component: "sst.aws.CognitoUserPool",
    description: "AWS Cognito user pool + web client (auth)",
    accent: "bg-amber-700",
    category: "config"
  },
  openauth: {
    kind: "openauth",
    label: "OpenAuth",
    defaultName: "Auth",
    component: "sst.aws.Auth",
    description: "Self-hosted OpenAuth issuer (the modern SST auth \u2014 Lambda + DynamoDB storage)",
    accent: "bg-amber-800",
    category: "config"
  },
  clerk: {
    kind: "clerk",
    label: "Clerk Auth",
    defaultName: "Clerk",
    component: "Clerk (auth)",
    description: "Drop-in auth \u2014 middleware + env keys (easiest for vibe coders)",
    accent: "bg-purple-700",
    category: "config"
  },
  ai: {
    kind: "ai",
    label: "AI Chat",
    defaultName: "AnthropicKey",
    component: "Anthropic (Claude)",
    description: "Streaming Claude chat \u2014 API key stored as an SST secret",
    accent: "bg-fuchsia-700",
    category: "config",
    props: [
      {
        key: "model",
        label: "Model",
        type: "select",
        default: "claude-opus-4-8",
        options: [
          { value: "claude-opus-4-8", label: "Claude Opus 4.8" },
          { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
          { value: "claude-haiku-4-5", label: "Claude Haiku 4.5" }
        ]
      }
    ]
  }
};
var AWS_CATALOG_ORDER = [
  "nextjs",
  "staticsite",
  "bucket",
  "dynamo",
  "postgres",
  "aurora",
  "redis",
  "service",
  "task",
  "queue",
  "bus",
  "snstopic",
  "realtime",
  "stepFunctions",
  "appsync",
  "apigatewayv2",
  "router",
  "worker",
  "cron",
  "secret",
  "email",
  "cognito",
  "openauth",
  "clerk",
  "stripe",
  "mongodb",
  "externalApi",
  "ai"
];

// lib/targets/aws-sst-v4/index.ts
var awsSstV4Target = {
  id: "aws-sst-v4",
  label: "AWS / SST v4",
  catalog: AWS_CATALOG,
  catalogOrder: AWS_CATALOG_ORDER,
  edgeIntents: AWS_EDGE_INTENTS,
  defaultIntent: awsDefaultIntent
};

// lib/targets/vercel/catalog.ts
var VERCEL_CATALOG = {
  app: {
    kind: "app",
    label: "Vercel App",
    defaultName: "Web",
    component: "Vercel Next.js Project",
    description: "Next.js on Vercel (zero-config deploy)",
    accent: "bg-neutral-800",
    category: "compute",
    singleton: true
  },
  blob: {
    kind: "blob",
    label: "Blob",
    defaultName: "Files",
    component: "@vercel/blob",
    description: "Vercel Blob object storage (first-party)",
    accent: "bg-emerald-600",
    category: "storage",
    props: [
      {
        key: "access",
        label: "Access",
        type: "select",
        default: "public",
        options: [
          { value: "public", label: "Public (CDN URLs)" },
          { value: "private", label: "Private (signed access)" }
        ],
        help: "Blob stores have an immutable public|private mode; every method needs a matching access value."
      }
    ]
  },
  postgres: {
    kind: "postgres",
    label: "Postgres",
    defaultName: "Db",
    component: "Neon Postgres",
    description: "External Postgres (Neon / Supabase) via Marketplace",
    accent: "bg-sky-600",
    category: "database"
  },
  redis: {
    kind: "redis",
    label: "Redis",
    defaultName: "Cache",
    component: "Upstash Redis",
    description: "External Redis (Upstash) via Marketplace",
    accent: "bg-rose-600",
    category: "database"
  },
  queue: {
    kind: "queue",
    label: "Queue",
    defaultName: "Jobs",
    component: "@vercel/queue",
    description: "Vercel Queue (native, beta)",
    accent: "bg-amber-600",
    category: "messaging"
  },
  consumer: {
    kind: "consumer",
    label: "Consumer",
    defaultName: "Worker",
    component: "handleCallback",
    description: "Queue consumer (push-mode worker)",
    accent: "bg-violet-600",
    category: "compute",
    props: [
      {
        key: "maxDuration",
        label: "Max duration (seconds)",
        type: "number",
        placeholder: "300",
        help: "Function timeout. Default 300s; Pro/Enterprise up to ~800s. Set in vercel.json."
      }
    ]
  },
  cron: {
    kind: "cron",
    label: "Cron",
    defaultName: "Daily",
    component: "vercel.json crons",
    description: "Scheduled API route (production only)",
    accent: "bg-fuchsia-600",
    category: "schedule",
    props: [
      {
        key: "schedule",
        label: "Schedule (cron)",
        type: "text",
        default: "0 5 * * *",
        placeholder: "0 5 * * *",
        help: "5-field cron, UTC, numeric only (no MON/JAN). Hobby plan: once/day max."
      }
    ]
  },
  webhook: {
    kind: "webhook",
    label: "Webhook",
    defaultName: "Webhook",
    component: "API route",
    description: "Inbound webhook (Stripe or generic HMAC)",
    accent: "bg-orange-600",
    category: "network",
    props: [
      {
        key: "provider",
        label: "Provider",
        type: "select",
        default: "stripe",
        options: [
          { value: "stripe", label: "Stripe" },
          { value: "generic", label: "Generic (HMAC signature)" }
        ],
        help: "Stripe emits Stripe signature verification; Generic emits an HMAC check with a per-hook secret."
      }
    ]
  },
  email: {
    kind: "email",
    label: "Email",
    defaultName: "Mailer",
    component: "Resend",
    description: "Transactional email (Resend)",
    accent: "bg-pink-600",
    category: "config",
    props: [
      {
        key: "from",
        label: "From address",
        type: "text",
        default: "noreply@example.com",
        placeholder: "noreply@yourdomain.com",
        help: "Verified sender for Resend. Must be on a domain you verified."
      }
    ]
  },
  edgeConfig: {
    kind: "edgeConfig",
    label: "Edge Config",
    defaultName: "Config",
    component: "@vercel/edge-config",
    description: "Low-latency global config store (first-party, read-optimized)",
    accent: "bg-cyan-600",
    category: "config"
  },
  externalApi: {
    kind: "externalApi",
    label: "External API",
    defaultName: "Api",
    component: "fetch helper",
    description: "A third-party HTTP API the app calls (base URL + key via env)",
    accent: "bg-teal-600",
    category: "network",
    props: [
      {
        key: "baseUrlEnv",
        label: "Base URL env var",
        type: "text",
        placeholder: "WEATHER_BASE_URL",
        help: "Name of the env var holding the API base URL."
      },
      {
        key: "keyEnv",
        label: "API key env var",
        type: "text",
        placeholder: "WEATHER_API_KEY",
        help: "Name of the env var holding the API key (server-only)."
      }
    ]
  },
  analytics: {
    kind: "analytics",
    label: "Analytics",
    defaultName: "Analytics",
    component: "@vercel/analytics",
    description: "Vercel Web Analytics \u2014 privacy-friendly page/event metrics",
    accent: "bg-blue-600",
    category: "config",
    singleton: true
  },
  speedInsights: {
    kind: "speedInsights",
    label: "Speed Insights",
    defaultName: "SpeedInsights",
    component: "@vercel/speed-insights",
    description: "Vercel Speed Insights \u2014 real-user Core Web Vitals",
    accent: "bg-violet-600",
    category: "config",
    singleton: true
  },
  aiGateway: {
    kind: "aiGateway",
    label: "AI Gateway",
    defaultName: "Chat",
    component: "AI SDK + Vercel AI Gateway",
    description: "Streaming chat route through the Vercel AI Gateway (you run it \u2014 the builder makes no AI calls)",
    accent: "bg-emerald-500",
    category: "compute",
    singleton: true,
    props: [
      {
        key: "model",
        label: "Model (provider/model)",
        type: "text",
        default: "openai/gpt-4o",
        placeholder: "openai/gpt-4o",
        help: "Vercel AI Gateway model string. Swappable \u2014 try anthropic/claude-* or google/gemini-*. Model IDs change; edit freely."
      }
    ]
  },
  ogImage: {
    kind: "ogImage",
    label: "OG Image",
    defaultName: "OgImage",
    component: "next/og ImageResponse",
    description: "Dynamic Open Graph image route (app/api/og) for shareable social cards",
    accent: "bg-amber-500",
    category: "network",
    singleton: true
  },
  workflow: {
    kind: "workflow",
    label: "Workflow",
    defaultName: "Workflow",
    component: "Vercel Workflow (durable)",
    description: "Durable, multi-step function (use workflow / use step) \u2014 pause/retry/resume; zero-config on Vercel",
    accent: "bg-indigo-600",
    category: "compute"
  },
  featureFlags: {
    kind: "featureFlags",
    label: "Feature Flags",
    defaultName: "Flags",
    component: "Vercel Flags SDK",
    description: "Type-safe feature flags (flags SDK) + the Flags Explorer discovery endpoint",
    accent: "bg-lime-600",
    category: "config",
    singleton: true
  },
  rateLimit: {
    kind: "rateLimit",
    label: "Rate Limit",
    defaultName: "RateLimit",
    component: "@vercel/firewall",
    description: "WAF-backed rate limiting (checkRateLimit) \u2014 a reusable guard for your routes",
    accent: "bg-red-600",
    category: "network",
    singleton: true
  },
  afterResponse: {
    kind: "afterResponse",
    label: "Background Task",
    defaultName: "Background",
    component: "after() (next/server)",
    description: "Fire-and-forget work after the response is sent (after()) \u2014 example server action",
    accent: "bg-stone-600",
    category: "compute",
    singleton: true
  },
  edgeMiddleware: {
    kind: "edgeMiddleware",
    label: "Edge Middleware",
    defaultName: "Proxy",
    component: "proxy.ts (Next 16)",
    description: "Routing middleware (proxy.ts) \u2014 geo redirect, auth gate, IP forwarding at the edge",
    accent: "bg-yellow-600",
    category: "network",
    singleton: true
  },
  botId: {
    kind: "botId",
    label: "Bot Protection",
    defaultName: "BotId",
    component: "botid",
    description: "Invisible bot detection (BotID) \u2014 protect routes from automated abuse",
    accent: "bg-zinc-600",
    category: "network",
    singleton: true
  },
  sandbox: {
    kind: "sandbox",
    label: "Sandbox",
    defaultName: "Sandbox",
    component: "@vercel/sandbox",
    description: "Ephemeral microVM to run untrusted / AI-generated code (Sandbox.create + runCommand)",
    accent: "bg-purple-600",
    category: "compute",
    singleton: true
  }
};
var VERCEL_CATALOG_ORDER = [
  "app",
  "blob",
  "edgeConfig",
  "postgres",
  "redis",
  "queue",
  "consumer",
  "workflow",
  "cron",
  "webhook",
  "externalApi",
  "edgeMiddleware",
  "botId",
  "sandbox",
  "featureFlags",
  "rateLimit",
  "afterResponse",
  "email",
  "aiGateway",
  "ogImage",
  "analytics",
  "speedInsights"
];

// lib/targets/vercel/index.ts
var vercelTarget = {
  id: "vercel",
  label: "Vercel",
  catalog: VERCEL_CATALOG,
  catalogOrder: VERCEL_CATALOG_ORDER,
  edgeIntents: VERCEL_EDGE_INTENTS,
  defaultIntent: vercelDefaultIntent
};

// lib/targets/registry.ts
var REGISTRY = {
  "aws-sst-v4": awsSstV4Target,
  vercel: vercelTarget
};
function getTarget(id) {
  const target = REGISTRY[id];
  if (!target) {
    throw new Error(`Unknown or unimplemented deploy target: ${id}`);
  }
  return target;
}
function isTargetImplemented(id) {
  return Boolean(REGISTRY[id]);
}

// lib/core/blueprint/serialize.ts
var TARGET_DEFAULTS = {
  "aws-sst-v4": {
    deploy: "aws-sst-v4",
    iac: "sst",
    sstMajor: 4,
    awsProviderMajor: 7,
    providerModel: "sst-managed-providers"
  },
  vercel: {
    deploy: "vercel",
    iac: "none"
  }
};
function draftBlueprint(snapshot, deploy, app, now, previousCreatedAt) {
  return {
    version: BLUEPRINT_VERSION,
    target: TARGET_DEFAULTS[deploy],
    app: {
      name: app.name,
      framework: "nextjs",
      packageManager: app.packageManager,
      region: app.region,
      stages: [
        { name: "production", removal: "retain", protect: true },
        { name: "dev", removal: "remove", protect: false }
      ]
    },
    resources: snapshot.nodes.map((n) => ({
      id: n.id,
      kind: n.kind,
      name: n.name,
      props: n.props ?? {},
      position: n.position
    })),
    connections: snapshot.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      intent: e.intent
    })),
    secrets: snapshot.secrets ?? [],
    outputs: snapshot.outputs ?? [],
    metadata: {
      createdAt: previousCreatedAt ?? now,
      updatedAt: now,
      generatedBy: "sstdream"
    }
  };
}

// lib/core/codegen/strings.ts
function camelCase(name) {
  if (!name) return name;
  return name[0].toLowerCase() + name.slice(1);
}
function kebabCase(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[\s_]+/g, "-").toLowerCase();
}

// lib/targets/aws-sst-v4/generator/plan.ts
function vpcConsumerIds(bp) {
  const byId = new Map(bp.resources.map((r) => [r.id, r]));
  return new Set(
    bp.connections.filter((c) => {
      const t = byId.get(c.target);
      if (c.intent === "queriesDb") return t?.kind === "postgres" || t?.kind === "aurora";
      if (c.intent === "usesCache") return t?.kind === "redis";
      return false;
    }).map((c) => c.source)
  );
}
function effectiveAwsNat(bp) {
  const vpcResources = bp.resources.filter(
    (r) => r.kind === "postgres" || r.kind === "aurora" || r.kind === "redis" || r.kind === "service" || r.kind === "task"
  );
  if (!vpcResources.length) return "none";
  const vals = vpcResources.map((r) => typeof r.props.nat === "string" ? r.props.nat : "none");
  if (vals.includes("managed")) return "managed";
  if (vals.includes("ec2")) return "ec2";
  const hasContainer = bp.resources.some((r) => r.kind === "service" || r.kind === "task");
  return hasContainer || vpcConsumerIds(bp).size ? "ec2" : "none";
}

// lib/targets/aws-sst-v4/generator/config.ts
function parseSeconds(value) {
  const m = /^(\d+(?:\.\d+)?)\s+(second|minute|hour)s?$/.exec(value ?? "");
  if (!m) return void 0;
  const n = Number(m[1]);
  return m[2] === "hour" ? n * 3600 : m[2] === "minute" ? n * 60 : n;
}

// lib/targets/aws-sst-v4/validation.ts
var NAME_RE = /^[A-Z][A-Za-z0-9]*$/;
var APP_NAME_RE = /^[a-z][a-z0-9-]*$/;
var IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
var SCHEDULE_RE = /^(rate|cron|at)\(.+\)$/;
var ROUTE_RE = /^(GET|POST|PUT|PATCH|DELETE|ANY|OPTIONS|HEAD) \/[\w\-./{}+]*$|^\$default$/;
var ENV_NAME_RE = /^[A-Z_][A-Z0-9_]*$/;
var RESERVED_VARS = /* @__PURE__ */ new Set([
  "vpc",
  "implements",
  "interface",
  "package",
  "private",
  "protected",
  "public",
  "eval",
  "arguments",
  "function",
  "class",
  "const",
  "let",
  "var",
  "return",
  "delete",
  "new",
  "void",
  "this",
  "super",
  "switch",
  "case",
  "catch",
  "finally",
  "for",
  "while",
  "do",
  "if",
  "else",
  "in",
  "instanceof",
  "typeof",
  "export",
  "import",
  "default",
  "extends",
  "static",
  "yield",
  "await",
  "enum",
  "null",
  "true",
  "false",
  "with",
  "debugger",
  "break",
  "continue",
  "throw",
  "try"
]);
var FORM_LOCALS = /* @__PURE__ */ new Set(["router", "pending", "create", "get", "list", "update", "remove"]);
function resourceMap(bp) {
  return new Map(bp.resources.map((r) => [r.id, r]));
}
var AWS_RULES = [
  {
    id: "app-name-valid",
    run: (bp) => APP_NAME_RE.test(bp.app.name) ? [] : [
      {
        rule: "app-name-valid",
        severity: "error",
        message: `App name "${bp.app.name}" is invalid.`,
        hint: "Lowercase letters, numbers and dashes; start with a letter (e.g. ai-processing-app)."
      }
    ]
  },
  {
    id: "empty-design",
    run: (bp) => bp.resources.length === 0 ? [
      {
        rule: "empty-design",
        severity: "warning",
        message: "The design is empty \u2014 add resources before exporting."
      }
    ] : []
  },
  {
    id: "unique-resource-names",
    run: (bp) => {
      const seen = /* @__PURE__ */ new Set();
      const out = [];
      for (const r of bp.resources) {
        if (seen.has(r.name)) {
          out.push({
            rule: "unique-resource-names",
            severity: "error",
            resourceId: r.id,
            message: `Duplicate resource name "${r.name}". SST component names must be unique.`
          });
        }
        seen.add(r.name);
      }
      return out;
    }
  },
  {
    id: "valid-resource-name",
    run: (bp) => bp.resources.filter((r) => !NAME_RE.test(r.name)).map((r) => ({
      rule: "valid-resource-name",
      severity: "error",
      resourceId: r.id,
      message: `Resource name "${r.name}" is not a valid SST component name.`,
      hint: 'Use PascalCase letters/numbers, e.g. "Uploads".'
    }))
  },
  {
    id: "edge-intent-applicability",
    run: (bp, ctx) => {
      const map2 = resourceMap(bp);
      const intents = new Map(ctx.target.edgeIntents.map((i) => [i.intent, i]));
      const out = [];
      for (const c of bp.connections) {
        const meta = intents.get(c.intent);
        if (!meta) {
          out.push({
            rule: "edge-intent-applicability",
            severity: "error",
            connectionId: c.id,
            message: `Unknown connection intent "${c.intent}".`
          });
          continue;
        }
        const src = map2.get(c.source);
        const tgt = map2.get(c.target);
        if (!src || !tgt) {
          out.push({
            rule: "edge-intent-applicability",
            severity: "error",
            connectionId: c.id,
            message: "Connection references a missing resource."
          });
          continue;
        }
        if (meta.from.length && !meta.from.includes(src.kind)) {
          out.push({
            rule: "edge-intent-applicability",
            severity: "error",
            connectionId: c.id,
            message: `"${meta.label}" cannot start from ${src.name} (${src.kind}).`
          });
        }
        if (meta.to.length && !meta.to.includes(tgt.kind)) {
          out.push({
            rule: "edge-intent-applicability",
            severity: "error",
            connectionId: c.id,
            message: `"${meta.label}" cannot point to ${tgt.name} (${tgt.kind}).`
          });
        }
      }
      return out;
    }
  },
  {
    id: "cron-needs-function",
    run: (bp) => bp.resources.filter((r) => r.kind === "cron").filter((c) => !bp.connections.some((e) => e.source === c.id && e.intent === "invokes")).map((c) => ({
      rule: "cron-needs-function",
      severity: "error",
      resourceId: c.id,
      message: `Cron "${c.name}" has no function to invoke.`,
      hint: "Connect Cron \u2192 Worker (invokes)."
    }))
  },
  {
    id: "queue-needs-subscriber",
    run: (bp) => bp.resources.filter((r) => r.kind === "queue" || r.kind === "bus" || r.kind === "snstopic").filter(
      (q) => !bp.connections.some((c) => c.target === q.id && c.intent === "subscribesTo")
    ).filter(
      (q) => !bp.connections.some((c) => c.target === q.id && c.intent === "deadLettersTo")
    ).map((q) => {
      const word = q.kind === "queue" ? "Queue" : q.kind === "bus" ? "Event bus" : "SNS topic";
      return {
        rule: "queue-needs-subscriber",
        severity: "warning",
        resourceId: q.id,
        message: `${word} "${q.name}" has no worker subscribing to it.`,
        hint: "Connect a Worker (subscribesTo), or messages will have no consumer."
      };
    })
  },
  {
    id: "worker-needs-trigger",
    run: (bp) => bp.resources.filter((r) => r.kind === "worker").filter(
      (w) => !bp.connections.some((c) => c.source === w.id && c.intent === "subscribesTo") && !bp.connections.some((c) => c.target === w.id && c.intent === "invokes") && !bp.connections.some((c) => c.source === w.id && c.intent === "handlesRoute") && !bp.connections.some((c) => c.source === w.id && c.intent === "handlesBucketEvents")
    ).map((w) => ({
      rule: "worker-needs-trigger",
      severity: "warning",
      resourceId: w.id,
      message: `Worker "${w.name}" is not triggered by a queue, cron, API route, or bucket event.`,
      hint: "Wire it to a Queue/Bus/Topic (subscribesTo), a Cron (invokes), an HTTP API (handlesRoute), or a Bucket (handlesBucketEvents)."
    }))
  },
  {
    // The generator wires exactly ONE trigger per worker (plan.ts resolves the
    // first match); extra triggers would be silently dropped or cross-wired.
    id: "worker-single-trigger",
    run: (bp) => {
      const out = [];
      for (const w of bp.resources.filter((r) => r.kind === "worker")) {
        const outgoing = bp.connections.filter((c) => c.source === w.id);
        const subs = outgoing.filter((c) => c.intent === "subscribesTo").length;
        const routes = outgoing.filter((c) => c.intent === "handlesRoute").length;
        const buckets = outgoing.filter((c) => c.intent === "handlesBucketEvents").length;
        const cron = bp.connections.some((c) => c.target === w.id && c.intent === "invokes");
        const roles = [subs > 0, routes > 0, buckets > 0, cron].filter(Boolean).length;
        if (roles > 1 || subs > 1 || routes > 1 || buckets > 1) {
          out.push({
            rule: "worker-single-trigger",
            severity: "error",
            resourceId: w.id,
            message: `Worker "${w.name}" has multiple triggers \u2014 the export wires exactly one (subscriber, API route, bucket events, or cron) and would drop the rest.`,
            hint: "Give each trigger its own worker node."
          });
        }
      }
      return out;
    }
  },
  {
    // Resources whose kind isn't in the catalog (hand-edited imports, lane
    // mixups) used to vanish silently from the export.
    id: "known-resource-kind",
    run: (bp, ctx) => bp.resources.filter((r) => !(r.kind in ctx.target.catalog)).map((r) => {
      const sst = typeof r.props?.sstComponent === "string" ? r.props.sstComponent : null;
      if (r.kind === "unknown") {
        return {
          rule: "known-resource-kind",
          severity: "warning",
          resourceId: r.id,
          message: `"${r.name}"${sst ? ` (${sst})` : ""} isn't modeled by the builder \u2014 shown for reference; it won't be in a generated export.`,
          hint: "Leave it as a reference, or re-create it from the palette if you plan to export."
        };
      }
      return {
        rule: "known-resource-kind",
        severity: "error",
        resourceId: r.id,
        message: `"${r.name}" has unknown resource kind "${r.kind}" \u2014 the export would silently drop it.`,
        hint: "Re-create the node from the palette, or fix the kind in the imported design."
      };
    })
  },
  {
    // camelCase(name) becomes a `const` in sst.config.ts: reserved words emit
    // unparseable code; two names that camelCase identically collide.
    id: "var-name-collision",
    run: (bp) => {
      const DECLARED = /* @__PURE__ */ new Set([
        "secret",
        "ai",
        "email",
        "cognito",
        "openauth",
        "bucket",
        "dynamo",
        "postgres",
        "aurora",
        "redis",
        "queue",
        "bus",
        "snstopic",
        "realtime",
        "stepFunctions",
        "appsync",
        "apigatewayv2",
        "router",
        "service",
        "task",
        "nextjs",
        "staticsite"
      ]);
      const isTriggered = (w) => bp.connections.some(
        (c) => c.source === w.id && (c.intent === "subscribesTo" || c.intent === "handlesRoute" || c.intent === "handlesBucketEvents") || c.target === w.id && c.intent === "invokes"
      );
      const declares = (r) => DECLARED.has(r.kind) || r.kind === "worker" && !isTriggered(r);
      const out = [];
      const seen = /* @__PURE__ */ new Map();
      if (bp.resources.some((r) => r.kind === "service" || r.kind === "task")) {
        seen.set("cluster", {
          id: "__cluster__",
          kind: "service",
          name: "the auto-generated Cluster",
          props: {}
        });
      }
      const claim = (v, r) => {
        if (RESERVED_VARS.has(v)) {
          out.push({
            rule: "var-name-collision",
            severity: "error",
            resourceId: r.id,
            message: `"${r.name}" would generate the variable "${v}", which is reserved.`,
            hint: 'Rename the resource (e.g. "ApiFunction" instead of "Function").'
          });
          return;
        }
        const prev = seen.get(v);
        if (prev && prev.id !== r.id) {
          out.push({
            rule: "var-name-collision",
            severity: "error",
            resourceId: r.id,
            message: `"${r.name}" and "${prev.name}" both generate the variable "${v}" \u2014 the export would not compile.`,
            hint: "Rename one of them."
          });
        } else {
          seen.set(v, r);
        }
      };
      for (const r of bp.resources.filter(declares)) {
        const v = camelCase(r.name);
        claim(v, r);
        if (r.kind === "cognito") claim(`${v}Client`, r);
        if (r.kind === "appsync") claim(`${v}Ds`, r);
        if (r.kind === "stepFunctions") {
          claim(`${v}Validate`, r);
          claim(`${v}Process`, r);
          claim(`${v}Done`, r);
        }
      }
      return out;
    }
  },
  {
    // Generated file paths are derived from kebabCase(name): workers
    // (src/workers/<slug>.ts), Dynamo tables (app/actions/<slug>.ts +
    // app/<slug>/page.tsx) and external-API helpers (lib/<slug>.ts).
    // kebabCase is many-to-one ("ProcessJob" and "PROcessJob" both -> "process-job"),
    // so two distinct, individually-valid names can collide on one path and the
    // export silently drops a file (runtime.ts de-dupes by path) or cross-wires.
    // var-name-collision uses camelCase and does NOT catch this.
    id: "kebab-path-collision",
    run: (bp) => {
      const SLUG_KINDS = /* @__PURE__ */ new Set(["worker", "dynamo", "externalApi"]);
      const out = [];
      const seen = /* @__PURE__ */ new Map();
      for (const r of bp.resources.filter((r2) => SLUG_KINDS.has(r2.kind))) {
        const slug = kebabCase(r.name);
        const prev = seen.get(slug);
        if (prev && prev.id !== r.id) {
          out.push({
            rule: "kebab-path-collision",
            severity: "error",
            resourceId: r.id,
            message: `"${r.name}" and "${prev.name}" both generate files under the path "${slug}" \u2014 the export would silently drop one or wire it to the wrong code.`,
            hint: 'Rename one so they differ by more than letter case (e.g. "ProcessJobs" vs "ProcessJob").'
          });
        } else {
          seen.set(slug, r);
        }
      }
      if (bp.resources.some((r) => r.kind === "mongodb")) {
        for (const r of bp.resources) {
          if (r.kind === "dynamo" && kebabCase(r.name) === "items") {
            out.push({
              rule: "kebab-path-collision",
              severity: "error",
              resourceId: r.id,
              message: `Dynamo table "${r.name}" generates the path "items", which collides with the MongoDB CRUD files.`,
              hint: 'Rename the table (e.g. "AppTable") so it does not kebab-case to "items".'
            });
          }
        }
      }
      return out;
    }
  },
  {
    // hashKey/rangeKey become TS identifiers AND local variables in the
    // generated CRUD form (GSI names/keys are always emitted quoted — exempt).
    id: "dynamo-keys-identifier-safe",
    run: (bp) => {
      const out = [];
      const KEYS = ["hashKey", "rangeKey"];
      for (const r of bp.resources.filter((x) => x.kind === "dynamo")) {
        for (const k of KEYS) {
          const v = r.props[k];
          if (typeof v !== "string" || !v) continue;
          const bad = !IDENT_RE.test(v) || RESERVED_VARS.has(v) || FORM_LOCALS.has(v) || v === "setPending";
          if (bad) {
            out.push({
              rule: "dynamo-keys-identifier-safe",
              severity: "error",
              resourceId: r.id,
              message: `Table "${r.name}" ${k} "${v}" cannot be used as a variable in the generated code.`,
              hint: "Use letters/digits/underscore, starting with a letter, avoiding reserved words (e.g. userId)."
            });
          }
        }
      }
      return out;
    }
  },
  {
    // Half-configured GSIs silently degraded to "no GSI" in the export.
    id: "gsi-complete",
    run: (bp) => {
      const out = [];
      for (const r of bp.resources.filter((x) => x.kind === "dynamo")) {
        const name = typeof r.props.gsiName === "string" && r.props.gsiName;
        const hash = typeof r.props.gsiHashKey === "string" && r.props.gsiHashKey;
        const range = typeof r.props.gsiRangeKey === "string" && r.props.gsiRangeKey;
        if ((name || hash || range) && !(name && hash)) {
          out.push({
            rule: "gsi-complete",
            severity: "error",
            resourceId: r.id,
            message: `Table "${r.name}" has a half-configured GSI \u2014 set both the index name and its hash key (or clear all GSI fields).`
          });
        }
      }
      return out;
    }
  },
  {
    // baseUrlEnv/keyEnv are emitted as process.env.<name> and .env lines.
    id: "env-var-name-format",
    run: (bp) => {
      const out = [];
      for (const r of bp.resources.filter((x) => x.kind === "externalApi")) {
        for (const k of ["baseUrlEnv", "keyEnv"]) {
          const v = r.props[k];
          if (typeof v === "string" && v && !ENV_NAME_RE.test(v)) {
            out.push({
              rule: "env-var-name-format",
              severity: "error",
              resourceId: r.id,
              message: `"${r.name}" ${k} "${v}" is not a valid env var name \u2014 generated code would not compile.`,
              hint: "Use UPPER_SNAKE_CASE (e.g. API_BASE_URL)."
            });
          }
        }
      }
      return out;
    }
  },
  {
    // Free-text schedules that aren't rate()/cron()/at() fail `sst deploy`.
    id: "cron-schedule-format",
    run: (bp) => {
      const out = [];
      for (const c of bp.resources.filter((r) => r.kind === "cron")) {
        const schedule = typeof c.props.schedule === "string" ? c.props.schedule : "";
        if (schedule && !SCHEDULE_RE.test(schedule)) {
          out.push({
            rule: "cron-schedule-format",
            severity: "error",
            resourceId: c.id,
            message: `Cron "${c.name}" schedule "${schedule}" is invalid \u2014 AWS accepts rate(...), cron(...), or at(...).`,
            hint: "e.g. rate(1 day), cron(0 12 * * ? *), at(2026-01-01T00:00:00)"
          });
        }
      }
      return out;
    }
  },
  {
    // Route keys must be "METHOD /path" (or $default); duplicates on one API
    // overwrite each other at deploy.
    id: "route-format-and-unique",
    run: (bp) => {
      const out = [];
      const seen = /* @__PURE__ */ new Map();
      for (const w of bp.resources.filter((r) => r.kind === "worker")) {
        const edge = bp.connections.find((c) => c.source === w.id && c.intent === "handlesRoute");
        if (!edge) continue;
        const route = typeof w.props.route === "string" && w.props.route ? w.props.route : "GET /";
        if (!ROUTE_RE.test(route)) {
          out.push({
            rule: "route-format-and-unique",
            severity: "error",
            resourceId: w.id,
            message: `Worker "${w.name}" route "${route}" is invalid \u2014 use "METHOD /path" (e.g. "POST /webhooks") or "$default".`
          });
          continue;
        }
        const key = `${edge.target}::${route}`;
        const prev = seen.get(key);
        if (prev) {
          out.push({
            rule: "route-format-and-unique",
            severity: "error",
            resourceId: w.id,
            message: `Workers "${prev.name}" and "${w.name}" both handle "${route}" on the same API \u2014 routes must be unique.`,
            hint: 'Change one route (workers default to "GET /").'
          });
        } else {
          seen.set(key, w);
        }
      }
      return out;
    }
  },
  {
    // StaticSite build needs BOTH command and output; one without the other
    // silently degraded to "no build" in the export.
    id: "staticsite-build-complete",
    run: (bp) => {
      const out = [];
      for (const r of bp.resources.filter((x) => x.kind === "staticsite")) {
        const cmd = typeof r.props.buildCommand === "string" && r.props.buildCommand;
        const dir = typeof r.props.buildOutput === "string" && r.props.buildOutput;
        if (cmd && !dir || !cmd && dir) {
          out.push({
            rule: "staticsite-build-complete",
            severity: "error",
            resourceId: r.id,
            message: `Static site "${r.name}" has a half-configured build \u2014 set both the command and the output dir (or clear both).`
          });
        }
      }
      return out;
    }
  },
  {
    // dlq references the target's .arn — a cycle cannot be declared.
    id: "queue-dlq-no-cycle",
    run: (bp) => {
      const next = new Map(
        bp.connections.filter((c) => c.intent === "deadLettersTo").map((c) => [c.source, c.target])
      );
      const out = [];
      const flagged = /* @__PURE__ */ new Set();
      for (const start of next.keys()) {
        const seen = /* @__PURE__ */ new Set([start]);
        let cur = next.get(start);
        while (cur) {
          if (seen.has(cur)) {
            if (!flagged.has(start)) {
              flagged.add(start);
              const r = bp.resources.find((x) => x.id === start);
              out.push({
                rule: "queue-dlq-no-cycle",
                severity: "error",
                resourceId: start,
                message: `Queue "${r?.name ?? start}" is part of a dead-letter cycle \u2014 DLQ chains must end somewhere.`
              });
            }
            break;
          }
          seen.add(cur);
          cur = next.get(cur);
        }
      }
      return out;
    }
  },
  {
    // AWS hard-rejects the event-source mapping when a subscriber's timeout
    // exceeds the queue's visibilityTimeout; an explicit prop must cover it.
    id: "queue-visibility-covers-subscribers",
    run: (bp) => {
      const byId = resourceMap(bp);
      const out = [];
      for (const queue of bp.resources.filter((r) => r.kind === "queue")) {
        const explicit = queue.props.visibilityTimeout;
        if (typeof explicit !== "string" || !explicit) continue;
        const visibility = parseSeconds(explicit);
        if (visibility === void 0) {
          out.push({
            rule: "queue-visibility-covers-subscribers",
            severity: "error",
            resourceId: queue.id,
            message: `Queue "${queue.name}" visibilityTimeout "${explicit}" is invalid \u2014 use an SST duration like "360 seconds".`
          });
          continue;
        }
        const subTimeouts = bp.connections.filter((c) => c.target === queue.id && c.intent === "subscribesTo").map((c) => {
          const t = byId.get(c.source)?.props.timeout;
          const raw = typeof t === "string" && t ? t : void 0;
          return raw ? parseSeconds(raw) ?? 900 : 60;
        });
        if (subTimeouts.length && visibility < Math.max(...subTimeouts)) {
          out.push({
            rule: "queue-visibility-covers-subscribers",
            severity: "error",
            resourceId: queue.id,
            message: `Queue "${queue.name}" visibilityTimeout (${visibility}s) is below its largest subscriber timeout (${Math.max(...subTimeouts)}s) \u2014 AWS rejects the event-source mapping.`,
            hint: "Raise the visibility timeout (AWS recommends ~6\xD7 the subscriber timeout) or clear it to auto-compute."
          });
        }
      }
      return out;
    }
  },
  {
    // CronV2 has a single `function:` — plan.ts wires the FIRST invokes edge
    // and any extra target would vanish from the export.
    id: "cron-single-function",
    run: (bp) => {
      const out = [];
      for (const c of bp.resources.filter((r) => r.kind === "cron")) {
        const invokes = bp.connections.filter((e) => e.source === c.id && e.intent === "invokes");
        if (invokes.length > 1) {
          out.push({
            rule: "cron-single-function",
            severity: "error",
            resourceId: c.id,
            message: `Cron "${c.name}" invokes ${invokes.length} workers \u2014 the export wires exactly one and would drop the rest.`,
            hint: "Add one cron node per worker (CronV2 has a single function)."
          });
        }
      }
      return out;
    }
  },
  {
    // Verified (docs/sst-v4-target.md §5): SNS Lambda triggers support STANDARD
    // topics only — subscribing a worker to a FIFO topic fails at deploy.
    id: "snstopic-fifo-no-lambda",
    run: (bp) => {
      const byId = resourceMap(bp);
      const out = [];
      for (const c of bp.connections.filter((e) => e.intent === "subscribesTo")) {
        const topic = byId.get(c.target);
        if (topic?.kind === "snstopic" && topic.props.fifo === true) {
          const worker = byId.get(c.source);
          out.push({
            rule: "snstopic-fifo-no-lambda",
            severity: "error",
            resourceId: topic.id,
            message: `FIFO topic "${topic.name}" has a Lambda subscriber${worker ? ` ("${worker.name}")` : ""} \u2014 AWS only supports standard topics as Lambda triggers.`,
            hint: "Turn off fifo, or have the worker consume via a Queue subscribed to the topic."
          });
        }
      }
      return out;
    }
  },
  {
    id: "routed-bucket-cloudfront",
    run: (bp) => bp.connections.filter((c) => c.intent === "routesBucket").map((c) => bp.resources.find((r) => r.id === c.target)).filter((b) => b && b.props.access !== "cloudfront").map((b) => ({
      rule: "routed-bucket-cloudfront",
      // error: a Router serving a private bucket ships a 403ing site.
      severity: "error",
      resourceId: b.id,
      message: `Bucket "${b.name}" is routed by a Router but its access isn't "cloudfront".`,
      hint: "Set the bucket access to CloudFront so the Router can serve it."
    }))
  },
  {
    id: "orphan-secret",
    run: (bp) => bp.resources.filter((r) => r.kind === "secret").filter((s) => !bp.connections.some((c) => c.target === s.id && c.intent === "usesSecret")).map((s) => ({
      rule: "orphan-secret",
      severity: "warning",
      resourceId: s.id,
      message: `Secret "${s.name}" is not linked to anything.`,
      hint: "Connect a resource \u2192 Secret (usesSecret)."
    }))
  },
  {
    id: "unused-storage",
    run: (bp) => {
      const connected = /* @__PURE__ */ new Set();
      for (const c of bp.connections) {
        connected.add(c.source);
        connected.add(c.target);
      }
      return bp.resources.filter((r) => (r.kind === "bucket" || r.kind === "dynamo") && !connected.has(r.id)).map((r) => ({
        rule: "unused-storage",
        severity: "warning",
        resourceId: r.id,
        message: `${r.kind === "bucket" ? "Bucket" : "Table"} "${r.name}" is not linked to anything and will be unused.`
      }));
    }
  },
  {
    id: "single-nextjs",
    run: (bp) => {
      const apps = bp.resources.filter((r) => r.kind === "nextjs");
      return apps.slice(1).map((a) => ({
        rule: "single-nextjs",
        severity: "warning",
        resourceId: a.id,
        message: `More than one Next.js app ("${a.name}"). The MVP exports a single web app.`
      }));
    }
  },
  {
    id: "production-removal-retain",
    run: (bp) => {
      const prod = bp.app.stages.find((s) => s.name === "production");
      return prod && prod.removal && prod.removal !== "retain" ? [
        {
          rule: "production-removal-retain",
          severity: "warning",
          message: `Production removal is "${prod.removal}". Production should usually be "retain" to avoid data loss.`
        }
      ] : [];
    }
  },
  {
    id: "production-protect",
    run: (bp) => {
      const prod = bp.app.stages.find((s) => s.name === "production");
      return prod && prod.protect !== true ? [
        {
          rule: "production-protect",
          severity: "warning",
          message: 'Production "protect" is off. Enable it to block accidental `sst remove`.'
        }
      ] : [];
    }
  },
  {
    // docs §4.3/§6: a Dynamo stream subscriber requires the table's stream to be
    // enabled. The generator auto-enables it when unset, so this only fires on an
    // explicit contradiction — a subscriber wired while stream is turned off.
    id: "dynamo-subscriber-needs-stream",
    run: (bp) => bp.resources.filter((r) => r.kind === "dynamo").filter(
      (t) => t.props.stream === "none" && bp.connections.some((c) => c.target === t.id && c.intent === "subscribesTo")
    ).map((t) => ({
      rule: "dynamo-subscriber-needs-stream",
      severity: "error",
      resourceId: t.id,
      message: `"${t.name}" has a stream subscriber but its stream is disabled.`,
      hint: `Set the table's Stream prop (e.g. "new-and-old-images") or remove the subscriber.`
    }))
  }
];

// lib/targets/vercel/validation.ts
var NAME_RE2 = /^[A-Z][A-Za-z0-9]*$/;
var APP_NAME_RE2 = /^[a-z][a-z0-9-]*$/;
function map(bp) {
  return new Map(bp.resources.map((r) => [r.id, r]));
}
var cronSchedule = (r) => typeof r.props.schedule === "string" && r.props.schedule ? r.props.schedule : "0 5 * * *";
function parseCron(schedule) {
  const fields = schedule.trim().split(/\s+/);
  if (fields.length !== 5) return { ok: false, reason: "must have exactly 5 fields" };
  if (/[a-zA-Z]/.test(schedule)) return { ok: false, reason: "numeric only (no MON/JAN names)" };
  if (!fields.every((f) => /^[\d*/,-]+$/.test(f)))
    return { ok: false, reason: "fields may only use digits and * , - /" };
  const [min, hour, dom, , dow] = fields;
  if (dom !== "*" && dow !== "*")
    return { ok: false, reason: "cannot set both day-of-month and day-of-week (one must be *)" };
  const single = (f) => /^\d+$/.test(f);
  return { ok: true, subDaily: !(single(min) && single(hour)) };
}
var VERCEL_RULES = [
  {
    id: "app-name-valid",
    run: (bp) => APP_NAME_RE2.test(bp.app.name) ? [] : [
      {
        rule: "app-name-valid",
        severity: "error",
        message: `App name "${bp.app.name}" is invalid.`,
        hint: "Lowercase letters, numbers and dashes; start with a letter."
      }
    ]
  },
  {
    id: "empty-design",
    run: (bp) => bp.resources.length === 0 ? [
      {
        rule: "empty-design",
        severity: "warning",
        message: "The design is empty \u2014 add resources before exporting."
      }
    ] : []
  },
  {
    id: "unique-resource-names",
    run: (bp) => {
      const seen = /* @__PURE__ */ new Set();
      const out = [];
      for (const r of bp.resources) {
        if (seen.has(r.name)) {
          out.push({
            rule: "unique-resource-names",
            severity: "error",
            resourceId: r.id,
            message: `Duplicate resource name "${r.name}".`
          });
        }
        seen.add(r.name);
      }
      return out;
    }
  },
  {
    id: "valid-resource-name",
    run: (bp) => bp.resources.filter((r) => !NAME_RE2.test(r.name)).map((r) => ({
      rule: "valid-resource-name",
      severity: "error",
      resourceId: r.id,
      message: `Resource name "${r.name}" must be PascalCase (used for routes/identifiers).`
    }))
  },
  {
    id: "edge-intent-applicability",
    run: (bp, ctx) => {
      const byId = map(bp);
      const intents = new Map(ctx.target.edgeIntents.map((i) => [i.intent, i]));
      const out = [];
      for (const c of bp.connections) {
        const meta = intents.get(c.intent);
        const src = byId.get(c.source);
        const tgt = byId.get(c.target);
        if (!meta || !src || !tgt) {
          out.push({
            rule: "edge-intent-applicability",
            severity: "error",
            connectionId: c.id,
            message: `Invalid connection "${c.intent}".`
          });
          continue;
        }
        if (meta.from.length && !meta.from.includes(src.kind)) {
          out.push({
            rule: "edge-intent-applicability",
            severity: "error",
            connectionId: c.id,
            message: `"${meta.label}" cannot start from ${src.name} (${src.kind}).`
          });
        }
        if (meta.to.length && !meta.to.includes(tgt.kind)) {
          out.push({
            rule: "edge-intent-applicability",
            severity: "error",
            connectionId: c.id,
            message: `"${meta.label}" cannot point to ${tgt.name} (${tgt.kind}).`
          });
        }
      }
      return out;
    }
  },
  {
    id: "single-app",
    run: (bp) => bp.resources.filter((r) => r.kind === "app").slice(1).map((a) => ({
      rule: "single-app",
      severity: "warning",
      resourceId: a.id,
      message: `More than one Vercel app ("${a.name}").`
    }))
  },
  {
    // Singleton kinds (analytics, speed insights, AI chat, OG route) emit
    // fixed-path files — a second one would silently collide on export.
    id: "singleton-kind",
    run: (bp, ctx) => {
      const out = [];
      const counts = /* @__PURE__ */ new Map();
      for (const r of bp.resources) {
        if (r.kind === "app") continue;
        if (ctx.target.catalog[r.kind]?.singleton) {
          (counts.get(r.kind) ?? counts.set(r.kind, []).get(r.kind)).push(r);
        }
      }
      for (const [kind, group] of counts) {
        for (const extra of group.slice(1)) {
          out.push({
            rule: "singleton-kind",
            severity: "error",
            resourceId: extra.id,
            message: `Only one "${ctx.target.catalog[kind]?.label ?? kind}" is allowed \u2014 it generates fixed-path files.`,
            hint: "Remove the duplicate."
          });
        }
      }
      return out;
    }
  },
  {
    id: "queue-needs-consumer",
    run: (bp) => bp.resources.filter((r) => r.kind === "queue").filter((q) => !bp.connections.some((c) => c.source === q.id && c.intent === "consumedBy")).map((q) => ({
      rule: "queue-needs-consumer",
      severity: "warning",
      resourceId: q.id,
      message: `Queue "${q.name}" has no consumer.`,
      hint: "Connect Queue \u2192 Consumer (consumedBy)."
    }))
  },
  {
    id: "consumer-needs-queue",
    run: (bp) => bp.resources.filter((r) => r.kind === "consumer").filter((c) => !bp.connections.some((e) => e.target === c.id && e.intent === "consumedBy")).map((c) => ({
      rule: "consumer-needs-queue",
      severity: "error",
      resourceId: c.id,
      message: `Consumer "${c.name}" is not attached to a queue.`,
      hint: "Connect Queue \u2192 Consumer (consumedBy)."
    }))
  },
  {
    // docs §5: 5-field UTC cron, numeric only, not both DOM and DOW. A bad
    // schedule passes the build and fails silently at deploy.
    id: "cron-schedule-format",
    run: (bp) => {
      const out = [];
      for (const c of bp.resources.filter((r) => r.kind === "cron")) {
        const schedule = cronSchedule(c);
        const parsed = parseCron(schedule);
        if (!parsed.ok) {
          out.push({
            rule: "cron-schedule-format",
            severity: "error",
            resourceId: c.id,
            message: `Cron "${c.name}" schedule "${schedule}" is invalid: ${parsed.reason}.`,
            hint: 'Use a 5-field UTC cron, e.g. "0 5 * * *" (daily at 05:00).'
          });
        }
      }
      return out;
    }
  },
  {
    // docs §5: Hobby plan crons run at most once/day. Sub-daily needs Pro/Ent.
    id: "cron-frequency",
    run: (bp) => {
      const out = [];
      for (const c of bp.resources.filter((r) => r.kind === "cron")) {
        const parsed = parseCron(cronSchedule(c));
        if (parsed.ok && parsed.subDaily) {
          out.push({
            rule: "cron-frequency",
            severity: "warning",
            resourceId: c.id,
            message: `Cron "${c.name}" runs more than once per day.`,
            hint: "The Hobby plan allows once/day; sub-daily schedules need Pro/Enterprise."
          });
        }
      }
      return out;
    }
  },
  {
    // docs §3: with Fluid Compute the function max is ~800s on Pro/Enterprise.
    id: "consumer-max-duration",
    run: (bp) => bp.resources.filter((r) => r.kind === "consumer").filter((c) => {
      const md = Number(c.props.maxDuration);
      return Number.isFinite(md) && md > 800;
    }).map((c) => ({
      rule: "consumer-max-duration",
      severity: "warning",
      resourceId: c.id,
      message: `Consumer "${c.name}" maxDuration (${String(c.props.maxDuration)}s) exceeds the plan maximum (~800s).`,
      hint: "Cap it at 800s, or move long-running work to Vercel Workflows."
    }))
  },
  {
    // Routes are app/api/<group>/<kebab(name)>/route.ts. kebabCase is many-to-one,
    // so two same-kind nodes with distinct names can collide on one route and the
    // export drops a file. (Cross-kind paths are namespaced — no collision.)
    id: "kebab-path-collision",
    run: (bp) => {
      const GROUPS = {
        cron: "cron",
        consumer: "queues",
        webhook: "webhooks",
        externalApi: "lib",
        // lib/<slug>.ts helpers can collide too
        workflow: "workflows"
        // workflows/<slug>.ts + the trigger route
      };
      const out = [];
      const seen = /* @__PURE__ */ new Map();
      for (const r of bp.resources.filter((r2) => GROUPS[r2.kind])) {
        const key = `${GROUPS[r.kind]}/${kebabCase(r.name)}`;
        const prev = seen.get(key);
        if (prev && prev.id !== r.id) {
          out.push({
            rule: "kebab-path-collision",
            severity: "error",
            resourceId: r.id,
            message: `"${r.name}" and "${prev.name}" both generate the route "/api/${key}" \u2014 the export would drop one.`,
            hint: "Rename one so they differ by more than letter case."
          });
        } else {
          seen.set(key, r);
        }
      }
      return out;
    }
  },
  {
    // docs §0/§10: a standard app needs no vercel.json — say so when nothing
    // requires one (no crons, no queue-consumer triggers).
    id: "standard-app-no-vercel-json",
    run: (bp) => {
      if (bp.resources.length === 0) return [];
      const needsConfig = bp.resources.some((r) => r.kind === "cron" || r.kind === "consumer");
      return needsConfig ? [] : [
        {
          rule: "standard-app-no-vercel-json",
          severity: "info",
          message: "No crons or queue consumers \u2014 this app needs no vercel.json (zero-config deploy)."
        }
      ];
    }
  }
];

// lib/core/validation/engine.ts
function runRules(bp, rules, ctx) {
  const diagnostics = [];
  for (const rule of rules) {
    try {
      diagnostics.push(...rule.run(bp, ctx));
    } catch (err) {
      diagnostics.push({
        rule: rule.id,
        severity: "error",
        message: `Validation rule "${rule.id}" crashed: ${err.message}`
      });
    }
  }
  const errors = diagnostics.filter((d) => d.severity === "error");
  const warnings = diagnostics.filter((d) => d.severity === "warning");
  const infos = diagnostics.filter((d) => d.severity === "info");
  return { diagnostics, errors, warnings, infos, ok: errors.length === 0 };
}

// lib/core/validation/validate.ts
var RULES = {
  "aws-sst-v4": AWS_RULES,
  vercel: VERCEL_RULES
};
var EMPTY = {
  diagnostics: [],
  errors: [],
  warnings: [],
  infos: [],
  ok: true
};
function validateBlueprint(bp) {
  if (!isTargetImplemented(bp.target.deploy)) {
    return {
      ...EMPTY,
      diagnostics: [
        {
          rule: "target-not-implemented",
          severity: "info",
          message: `The "${bp.target.deploy}" lane is not implemented yet; nothing to validate.`
        }
      ],
      infos: [
        {
          rule: "target-not-implemented",
          severity: "info",
          message: `The "${bp.target.deploy}" lane is not implemented yet; nothing to validate.`
        }
      ]
    };
  }
  return runRules(bp, RULES[bp.target.deploy] ?? [], { target: getTarget(bp.target.deploy) });
}

// lib/targets/aws-sst-v4/simulation.ts
var VERB = {
  uploadsTo: "uploads to",
  writesTo: "writes to",
  readsFrom: "reads from",
  usesSecret: "uses secret",
  usesAI: "uses AI",
  queriesDb: "queries",
  sendsEmail: "sends email through",
  usesStripe: "uses Stripe",
  queriesMongo: "queries Mongo",
  callsApi: "calls",
  usesCognito: "authenticates with",
  usesAuth: "authenticates with",
  usesOpenAuth: "authenticates with",
  usesCache: "caches in",
  usesRealtime: "streams via",
  startsWorkflow: "starts",
  resolvesFrom: "resolves from",
  consumesGraphQL: "queries",
  runsTask: "runs",
  routesBucket: "routes to",
  deadLettersTo: "dead-letters to",
  routedBy: "served by"
};
var LEAF_INTENTS = /* @__PURE__ */ new Set([
  "uploadsTo",
  "writesTo",
  "readsFrom",
  "usesSecret",
  "usesAI",
  "queriesDb",
  "sendsEmail",
  "usesStripe",
  "queriesMongo",
  "callsApi",
  "usesCognito",
  "usesAuth",
  "usesOpenAuth",
  "usesCache",
  "usesRealtime",
  "startsWorkflow",
  "resolvesFrom",
  "routesBucket",
  "routedBy",
  "deadLettersTo"
]);
function simulateAws(bp) {
  const byId = new Map(bp.resources.map((r) => [r.id, r]));
  const name = (id) => byId.get(id)?.name ?? id;
  const outgoing = (id) => bp.connections.filter((c) => c.source === id);
  const subscribersOf = (qid) => bp.connections.filter((c) => c.target === qid && c.intent === "subscribesTo");
  const events = [];
  const visited = /* @__PURE__ */ new Set();
  let counter = 0;
  const eid = () => `ev_${++counter}`;
  const walk2 = (id) => {
    if (visited.has(id)) return;
    visited.add(id);
    for (const edge of outgoing(id)) {
      if (edge.intent === "invokes") {
        events.push({
          id: eid(),
          edgeId: edge.id,
          sourceId: edge.source,
          targetId: edge.target,
          status: "ok",
          label: `${name(edge.source)} triggers ${name(edge.target)}`
        });
        walk2(edge.target);
      } else if (edge.intent === "consumesGraphQL" || edge.intent === "runsTask") {
        events.push({
          id: eid(),
          edgeId: edge.id,
          sourceId: edge.source,
          targetId: edge.target,
          status: "ok",
          label: `${name(edge.source)} ${VERB[edge.intent]} ${name(edge.target)}`
        });
        walk2(edge.target);
      } else if (edge.intent === "publishesTo") {
        visited.add(edge.target);
        events.push({
          id: eid(),
          edgeId: edge.id,
          sourceId: edge.source,
          targetId: edge.target,
          status: "ok",
          label: `${name(edge.source)} publishes to ${name(edge.target)}`
        });
        const subs = subscribersOf(edge.target);
        if (!subs.length) {
          events.push({
            id: eid(),
            sourceId: edge.target,
            status: "broken",
            label: `${name(edge.target)} has no consumer`,
            detail: "Messages published here would be dropped \u2014 add a Worker (subscribesTo)."
          });
        } else {
          for (const sub of subs) {
            events.push({
              id: eid(),
              edgeId: sub.id,
              sourceId: edge.target,
              targetId: sub.source,
              status: "ok",
              label: `${name(edge.target)} delivers to ${name(sub.source)}`
            });
            walk2(sub.source);
          }
        }
      } else if (LEAF_INTENTS.has(edge.intent)) {
        visited.add(edge.target);
        events.push({
          id: eid(),
          edgeId: edge.id,
          sourceId: edge.source,
          targetId: edge.target,
          status: "ok",
          label: `${name(edge.source)} ${VERB[edge.intent]} ${name(edge.target)}`
        });
        if (byId.get(edge.target)?.kind === "bucket") {
          for (const nf of bp.connections.filter(
            (c) => c.target === edge.target && c.intent === "handlesBucketEvents"
          )) {
            events.push({
              id: eid(),
              edgeId: nf.id,
              sourceId: edge.target,
              targetId: nf.source,
              status: "ok",
              label: `${name(edge.target)} notifies ${name(nf.source)}`
            });
            walk2(nf.source);
          }
        }
      }
    }
  };
  const entries = bp.resources.filter(
    (r) => r.kind === "nextjs" || r.kind === "cron" || r.kind === "apigatewayv2" || r.kind === "router" || r.kind === "staticsite" || r.kind === "service"
  );
  for (const entry of entries) {
    events.push({
      id: eid(),
      sourceId: entry.id,
      status: "ok",
      label: entry.kind === "cron" ? `${entry.name} fires on schedule` : entry.kind === "apigatewayv2" ? `${entry.name} receives requests` : entry.kind === "service" ? `${entry.name} runs` : `${entry.name} receives traffic`
    });
    walk2(entry.id);
    if (entry.kind === "apigatewayv2") {
      for (const rh of bp.connections.filter(
        (c) => c.target === entry.id && c.intent === "handlesRoute"
      )) {
        events.push({
          id: eid(),
          edgeId: rh.id,
          sourceId: entry.id,
          targetId: rh.source,
          status: "ok",
          label: `${name(entry.id)} routes to ${name(rh.source)}`
        });
        walk2(rh.source);
      }
    }
  }
  for (const dlq of bp.connections.filter((c) => c.intent === "deadLettersTo")) {
    if (visited.has(dlq.source) && !visited.has(dlq.target)) {
      visited.add(dlq.target);
      events.push({
        id: eid(),
        edgeId: dlq.id,
        sourceId: dlq.source,
        targetId: dlq.target,
        status: "ok",
        label: `${name(dlq.source)} dead-letters to ${name(dlq.target)}`
      });
      for (const sub of subscribersOf(dlq.target)) {
        events.push({
          id: eid(),
          edgeId: sub.id,
          sourceId: dlq.target,
          targetId: sub.source,
          status: "ok",
          label: `${name(dlq.target)} delivers to ${name(sub.source)}`
        });
        walk2(sub.source);
      }
    }
  }
  for (const sub of bp.connections.filter((c) => c.intent === "subscribesTo")) {
    const target = byId.get(sub.target);
    if (target?.kind === "dynamo" && visited.has(sub.target) && !visited.has(sub.source)) {
      events.push({
        id: eid(),
        edgeId: sub.id,
        sourceId: sub.target,
        targetId: sub.source,
        status: "ok",
        label: `${name(sub.target)} streams to ${name(sub.source)}`
      });
      walk2(sub.source);
    }
  }
  for (const w of bp.resources.filter((r) => r.kind === "worker")) {
    const isNotifier = bp.connections.some(
      (c) => c.source === w.id && c.intent === "handlesBucketEvents"
    );
    if (!visited.has(w.id) && !isNotifier) {
      events.push({
        id: eid(),
        sourceId: w.id,
        status: "broken",
        label: `${w.name} is never triggered`,
        detail: "No queue subscription or cron reaches this worker."
      });
    }
  }
  const STORAGE_KINDS2 = /* @__PURE__ */ new Set(["bucket", "dynamo", "postgres", "aurora", "mongodb"]);
  for (const r of bp.resources.filter((res) => STORAGE_KINDS2.has(res.kind))) {
    if (!visited.has(r.id)) {
      events.push({
        id: eid(),
        sourceId: r.id,
        status: "warning",
        label: `${r.name} is never accessed`
      });
    }
  }
  const brokenCount = events.filter((e) => e.status === "broken").length;
  return { events, ok: brokenCount === 0, brokenCount };
}

// lib/targets/vercel/simulation.ts
var VERB2 = {
  storesFileIn: "stores files in",
  writesToService: "writes to",
  readsFromService: "reads from",
  enqueuesTo: "enqueues to",
  sendsEmailThrough: "sends email through"
};
var ENTRY_KINDS = /* @__PURE__ */ new Set(["app", "cron", "webhook"]);
var STORAGE_KINDS = /* @__PURE__ */ new Set(["blob", "postgres", "redis"]);
function simulateVercel(bp) {
  const byId = new Map(bp.resources.map((r) => [r.id, r]));
  const name = (id) => byId.get(id)?.name ?? id;
  const outgoing = (id) => bp.connections.filter((c) => c.source === id);
  const events = [];
  const visited = /* @__PURE__ */ new Set();
  let counter = 0;
  const eid = () => `ev_${++counter}`;
  const walk2 = (id) => {
    if (visited.has(id)) return;
    visited.add(id);
    for (const edge of outgoing(id)) {
      events.push({
        id: eid(),
        edgeId: edge.id,
        sourceId: edge.source,
        targetId: edge.target,
        status: "ok",
        label: `${name(edge.source)} ${VERB2[edge.intent] ?? edge.intent} ${name(edge.target)}`
      });
      if (edge.intent === "enqueuesTo") {
        visited.add(edge.target);
        const consumers = bp.connections.filter(
          (c) => c.source === edge.target && c.intent === "consumedBy"
        );
        if (!consumers.length) {
          events.push({
            id: eid(),
            sourceId: edge.target,
            status: "broken",
            label: `${name(edge.target)} has no consumer`,
            detail: "Messages enqueued here are never processed \u2014 add a Consumer (consumedBy)."
          });
        } else {
          for (const sub of consumers) {
            events.push({
              id: eid(),
              edgeId: sub.id,
              sourceId: edge.target,
              targetId: sub.target,
              status: "ok",
              label: `${name(edge.target)} delivers to ${name(sub.target)}`
            });
            walk2(sub.target);
          }
        }
      } else {
        visited.add(edge.target);
      }
    }
  };
  for (const entry of bp.resources.filter((r) => ENTRY_KINDS.has(r.kind))) {
    const label = entry.kind === "cron" ? `${entry.name} fires on schedule` : entry.kind === "webhook" ? `${entry.name} receives a webhook` : `${entry.name} receives traffic`;
    events.push({ id: eid(), sourceId: entry.id, status: "ok", label });
    walk2(entry.id);
  }
  for (const c of bp.resources.filter((r) => r.kind === "consumer")) {
    if (!visited.has(c.id)) {
      events.push({
        id: eid(),
        sourceId: c.id,
        status: "broken",
        label: `${c.name} is not attached to a queue`,
        detail: "A consumer needs a Queue \u2192 Consumer (consumedBy) edge to be invoked."
      });
    }
  }
  for (const r of bp.resources.filter((r2) => STORAGE_KINDS.has(r2.kind))) {
    if (!visited.has(r.id)) {
      events.push({
        id: eid(),
        sourceId: r.id,
        status: "warning",
        label: `${r.name} is never accessed`
      });
    }
  }
  const brokenCount = events.filter((e) => e.status === "broken").length;
  return { events, ok: brokenCount === 0, brokenCount };
}

// lib/core/simulation/simulate.ts
var SIMS = {
  "aws-sst-v4": simulateAws,
  vercel: simulateVercel
};
function simulateBlueprint(bp) {
  const sim = SIMS[bp.target.deploy];
  if (!sim) {
    return {
      events: [
        {
          id: "ev_0",
          status: "warning",
          label: `Simulation is not available for the "${bp.target.deploy}" lane yet.`
        }
      ],
      ok: true,
      brokenCount: 0
    };
  }
  return sim(bp);
}

// lib/targets/aws-sst-v4/cost.ts
var PRICES = {
  lambdaRequestPer1M: 0.2,
  lambdaGbSecond: 166667e-10,
  s3StorageGbMonth: 0.023,
  s3PutPer1k: 5e-3,
  s3GetPer1k: 4e-4,
  dynamoWritePer1M: 1.25,
  dynamoReadPer1M: 0.25,
  dynamoStorageGbMonth: 0.25,
  sqsPer1M: 0.4,
  cfTransferGbOut: 0.085,
  cfRequestPer10k: 75e-4
};
var PROFILE = {
  requestsPerMonth: 1e6,
  lambdaDurationMs: 200,
  lambdaMemoryMb: 1024,
  workerInvocationsPerMonth: 1e6,
  bucketStorageGb: 5,
  bucketPutPerMonth: 1e5,
  bucketGetPerMonth: 1e6,
  dynamoWritesPerMonth: 1e6,
  dynamoReadsPerMonth: 1e6,
  dynamoStorageGb: 5,
  queueRequestsPerMonth: 1e6,
  cdnTransferGb: 50,
  cdnRequestsPerMonth: 1e6,
  nextjsAssetsGb: 1
};
var round2 = (n) => Math.round(n * 100) / 100;
function lambdaLines(invocations, durationMs, memoryMb) {
  const requestCost = invocations / 1e6 * PRICES.lambdaRequestPer1M;
  const gbSeconds = invocations * (durationMs / 1e3) * (memoryMb / 1024);
  const computeCost = gbSeconds * PRICES.lambdaGbSecond;
  return [
    { label: "Lambda requests", usd: round2(requestCost) },
    { label: "Lambda compute", usd: round2(computeCost) }
  ];
}
function s3Lines(storageGb, puts, gets) {
  return [
    { label: "S3 storage", usd: round2(storageGb * PRICES.s3StorageGbMonth) },
    { label: "S3 PUT", usd: round2(puts / 1e3 * PRICES.s3PutPer1k) },
    { label: "S3 GET", usd: round2(gets / 1e3 * PRICES.s3GetPer1k) }
  ];
}
function cloudfrontLines(transferGb, requests) {
  return [
    { label: "CloudFront transfer", usd: round2(transferGb * PRICES.cfTransferGbOut) },
    { label: "CloudFront requests", usd: round2(requests / 1e4 * PRICES.cfRequestPer10k) }
  ];
}
function breakdownFor(r, nat) {
  let lines = [];
  switch (r.kind) {
    case "nextjs": {
      const imageReqs = PROFILE.requestsPerMonth * 0.1;
      const imageCost = imageReqs / 1e6 * PRICES.lambdaRequestPer1M + imageReqs * (PROFILE.lambdaDurationMs / 1e3) * (1536 / 1024) * PRICES.lambdaGbSecond;
      lines = [
        ...lambdaLines(PROFILE.requestsPerMonth, PROFILE.lambdaDurationMs, PROFILE.lambdaMemoryMb),
        { label: "Image-opt Lambda (1536MB, ~10% of reqs)", usd: round2(imageCost) },
        { label: "S3 (assets)", usd: round2(PROFILE.nextjsAssetsGb * PRICES.s3StorageGbMonth) },
        ...cloudfrontLines(PROFILE.cdnTransferGb, PROFILE.cdnRequestsPerMonth)
      ];
      break;
    }
    case "staticsite":
      lines = [
        { label: "S3 (static assets)", usd: round2(1 * PRICES.s3StorageGbMonth) },
        ...cloudfrontLines(PROFILE.cdnTransferGb, PROFILE.cdnRequestsPerMonth)
      ];
      break;
    case "bucket":
      lines = s3Lines(
        PROFILE.bucketStorageGb,
        PROFILE.bucketPutPerMonth,
        PROFILE.bucketGetPerMonth
      );
      break;
    case "dynamo":
      lines = [
        {
          label: "Writes",
          usd: round2(PROFILE.dynamoWritesPerMonth / 1e6 * PRICES.dynamoWritePer1M)
        },
        {
          label: "Reads",
          usd: round2(PROFILE.dynamoReadsPerMonth / 1e6 * PRICES.dynamoReadPer1M)
        },
        { label: "Storage", usd: round2(PROFILE.dynamoStorageGb * PRICES.dynamoStorageGbMonth) }
      ];
      break;
    case "queue":
      lines = [
        {
          label: "SQS requests",
          usd: round2(PROFILE.queueRequestsPerMonth / 1e6 * PRICES.sqsPer1M)
        }
      ];
      break;
    case "bus":
      lines = [{ label: "EventBridge events (1M)", usd: 1 }];
      break;
    case "snstopic":
      lines = [{ label: "SNS messages (1M)", usd: 0.5 }];
      break;
    case "apigatewayv2":
      lines = [{ label: "HTTP API requests (1M)", usd: 1 }];
      break;
    case "router":
      lines = cloudfrontLines(PROFILE.cdnTransferGb, PROFILE.cdnRequestsPerMonth);
      break;
    case "worker":
      lines = lambdaLines(
        PROFILE.workerInvocationsPerMonth,
        PROFILE.lambdaDurationMs,
        PROFILE.lambdaMemoryMb
      );
      break;
    case "cron":
      lines = [{ label: "EventBridge schedule", usd: 0 }];
      break;
    case "secret":
      lines = [{ label: "SSM (free tier)", usd: 0 }];
      break;
    case "ai":
      lines = [{ label: "Anthropic API (usage-based)", usd: 0 }];
      break;
    case "email":
      lines = [{ label: "SES (~10k emails)", usd: 1 }];
      break;
    case "postgres": {
      lines = [
        { label: "RDS Postgres (db.t4g.micro)", usd: 11.5 },
        { label: "Storage (20GB gp3)", usd: 2.3 },
        { label: "VPC (CloudMap DNS)", usd: 0.5 }
      ];
      if (nat === "ec2") lines.push({ label: "fck-nat EC2 (t4g.nano)", usd: 4 });
      else if (nat === "managed") lines.push({ label: "NAT Gateway", usd: 32 });
      break;
    }
    case "aurora": {
      lines = [
        { label: "Aurora Serverless v2 (0.5 ACU min)", usd: 44 },
        { label: "Storage (10GB)", usd: 1 },
        { label: "VPC (CloudMap DNS)", usd: 0.5 }
      ];
      if (nat === "ec2") lines.push({ label: "fck-nat EC2 (t4g.nano)", usd: 4 });
      else if (nat === "managed") lines.push({ label: "NAT Gateway", usd: 32 });
      break;
    }
    case "redis": {
      const valkey = r.props.engine === "valkey";
      lines = [
        valkey ? { label: "ElastiCache Valkey (cache.t4g.micro)", usd: 9 } : { label: "ElastiCache Redis (cache.t4g.micro)", usd: 12 }
      ];
      if (nat !== "none") lines.push({ label: "VPC (CloudMap DNS)", usd: 0.5 });
      if (nat === "ec2") lines.push({ label: "fck-nat EC2 (t4g.nano)", usd: 4 });
      else if (nat === "managed") lines.push({ label: "NAT Gateway", usd: 32 });
      break;
    }
    case "service": {
      const cpuUsd = {
        "0.25 vCPU": 9,
        "0.5 vCPU": 18,
        "1 vCPU": 36,
        "2 vCPU": 72,
        "4 vCPU": 144
      };
      const cpu = typeof r.props.cpu === "string" ? r.props.cpu : "0.25 vCPU";
      lines = [{ label: `Fargate (${cpu}, 1 task)`, usd: cpuUsd[cpu] ?? 9 }];
      if (r.props.public !== "no") lines.push({ label: "Application Load Balancer", usd: 16 });
      if (nat !== "none") lines.push({ label: "VPC (CloudMap DNS)", usd: 0.5 });
      if (nat === "ec2") lines.push({ label: "fck-nat EC2 (t4g.nano)", usd: 4 });
      else if (nat === "managed") lines.push({ label: "NAT Gateway", usd: 32 });
      break;
    }
    case "task":
      lines = [{ label: "Fargate Task (per-run, no idle)", usd: 0 }];
      if (nat !== "none") lines.push({ label: "VPC (CloudMap DNS)", usd: 0.5 });
      if (nat === "ec2") lines.push({ label: "fck-nat EC2 (t4g.nano)", usd: 4 });
      else if (nat === "managed") lines.push({ label: "NAT Gateway", usd: 32 });
      break;
    case "realtime":
      lines = [{ label: "IoT Core (connections + messages)", usd: 1 }];
      break;
    case "stepFunctions":
      lines = [
        {
          label: r.props.type === "express" ? "Step Functions Express (per-request)" : "Step Functions (state transitions)",
          usd: 1
        }
      ];
      break;
    case "appsync":
      lines = [
        { label: "AppSync (per query)", usd: 1 },
        { label: "Resolver Lambda (request-priced)", usd: 0 }
      ];
      break;
    case "cognito":
      lines = [{ label: "Cognito (free \u2264 50k MAU)", usd: 0 }];
      break;
    case "openauth":
      lines = [
        { label: "Auth issuer (Lambda, request-priced)", usd: 0 },
        { label: "DynamoDB storage (on-demand)", usd: 1 }
      ];
      break;
    case "clerk":
      lines = [{ label: "Clerk (external / free tier)", usd: 0 }];
      break;
    case "stripe":
    case "mongodb":
    case "externalApi":
      lines = [{ label: "External / usage-based", usd: 0 }];
      break;
    default:
      lines = [];
  }
  const monthlyUsd = round2(lines.reduce((sum, l) => sum + l.usd, 0));
  return { resourceId: r.id, name: r.name, kind: r.kind, monthlyUsd, lines };
}
function estimateAwsCost(bp) {
  const nat = effectiveAwsNat(bp);
  const firstVpcNode = bp.resources.find(
    (r) => r.kind === "postgres" || r.kind === "aurora" || r.kind === "redis" || r.kind === "service" || r.kind === "task"
  );
  const perResource = bp.resources.map(
    (r) => breakdownFor(r, r.id === firstVpcNode?.id ? nat : "none")
  );
  const totalMonthlyUsd = round2(perResource.reduce((sum, r) => sum + r.monthlyUsd, 0));
  return {
    perResource,
    totalMonthlyUsd,
    region: bp.app.region,
    assumptions: [
      "~1M requests/month, 200ms avg @ 1024MB Lambda (Next.js adds an image-opt Lambda @ 1536MB on ~10% of requests)",
      "S3: 5GB storage, 100k PUT, 1M GET",
      "DynamoDB on-demand: 1M writes, 1M reads, 5GB",
      "SQS: 1M requests; CloudFront: 50GB out, 1M requests",
      "VPCs have NO NAT by default; fck-nat (ec2) \u2248 $4/mo (added when app code joins the VPC to reach the DB), managed gateway \u2248 $32/mo/AZ"
    ],
    disclaimer: "Rough design-time ballpark (us-east-1 on-demand). Not a billing forecast \u2014 your real costs depend on actual traffic, region, and free-tier usage."
  };
}

// lib/targets/vercel/cost.ts
var round22 = (n) => Math.round(n * 100) / 100;
function breakdownFor2(r) {
  let lines = [];
  switch (r.kind) {
    case "app":
      lines = [
        { label: "Plan base (Pro $20; Hobby is $0 for personal use)", usd: 20 },
        { label: "Functions + bandwidth (included tier)", usd: 0 }
      ];
      break;
    case "blob":
      lines = [
        { label: "Blob storage (~5GB @ $0.023/GB)", usd: round22(5 * 0.023) },
        { label: "Blob operations (included tier)", usd: 0 }
      ];
      break;
    case "postgres":
      lines = [{ label: "Neon Postgres (external \u2014 free tier \u2192 ~$19+)", usd: 0 }];
      break;
    case "redis":
      lines = [{ label: "Upstash Redis (external \u2014 free tier \u2192 usage)", usd: 0 }];
      break;
    case "queue":
      lines = [{ label: "Vercel Queue (beta \u2014 usage-based)", usd: 0 }];
      break;
    case "consumer":
      lines = [{ label: "Consumer function (included compute)", usd: 0 }];
      break;
    case "cron":
      lines = [{ label: "Cron Jobs (free)", usd: 0 }];
      break;
    case "webhook":
      lines = [{ label: "Webhook function (included compute)", usd: 0 }];
      break;
    case "email":
      lines = [{ label: "Resend (free tier \u2192 usage)", usd: 0 }];
      break;
    default:
      lines = [];
  }
  const monthlyUsd = round22(lines.reduce((sum, l) => sum + l.usd, 0));
  return { resourceId: r.id, name: r.name, kind: r.kind, monthlyUsd, lines };
}
function estimateVercelCost(bp) {
  const perResource = bp.resources.map(breakdownFor2);
  const totalMonthlyUsd = round22(perResource.reduce((sum, r) => sum + r.monthlyUsd, 0));
  return {
    perResource,
    totalMonthlyUsd,
    region: bp.app.region,
    assumptions: [
      "Vercel Pro plan base $20/mo (Hobby is $0 for personal, non-commercial projects)",
      "Blob: ~5GB storage at $0.023/GB",
      "External Postgres (Neon) and Redis (Upstash) bill on THEIR plans \u2014 shown as $0 here",
      "Queues (beta), Cron, and Resend are usage-based / free-tier \u2014 shown as $0"
    ],
    disclaimer: "Very rough design-time signpost. Vercel is plan + usage based and external DB/Redis bill separately \u2014 check vercel.com/pricing and each provider for real numbers."
  };
}

// lib/core/cost/estimate.ts
var PROVIDERS = {
  "aws-sst-v4": estimateAwsCost,
  vercel: estimateVercelCost
};
var EMPTY2 = (region, target) => ({
  perResource: [],
  totalMonthlyUsd: 0,
  region,
  assumptions: [],
  disclaimer: `Cost estimation is not available for the "${target}" lane yet.`
});
function estimateCost(bp) {
  const provider = PROVIDERS[bp.target.deploy];
  return provider ? provider(bp) : EMPTY2(bp.app.region, bp.target.deploy);
}

// lib/targets/aws-sst-v4/expansion.ts
var P = (service, name, opts = {}) => ({ service, name, ...opts });
var str = (v) => typeof v === "string" && v ? v : void 0;
function nextjsResources(r) {
  const out = [
    P("CloudFront", "Distribution", { note: "the public URL / global CDN", paid: true }),
    P("CloudFront", "viewer-request Function", { note: "routes asset vs server origin" }),
    P("CloudFront", "Origin Access (OAI)", { security: true, note: "reads the private S3 bucket" }),
    P("CloudFront", "Cache policy"),
    P("S3", "Assets + ISR cache bucket", {
      paid: true,
      security: true,
      note: "private; static + ISR cache"
    }),
    P("Lambda", "Server (SSR) function", { paid: true, note: "1024 MB, nodejs" }),
    P("Lambda", "Server Function URL", {
      security: true,
      note: 'PUBLIC by default (protection: "none")'
    }),
    P("Lambda", "Image-optimization function", { paid: true, note: "next/image, 1536 MB" }),
    P("Lambda", "Image-opt Function URL", { security: true }),
    P("Lambda", "Revalidation (ISR) function", { paid: true }),
    P("SQS", "Revalidation queue (FIFO)", { note: "triggers the ISR revalidator" }),
    P("Lambda", "SQS \u2192 revalidation mapping"),
    P("DynamoDB", "ISR tag-cache table", { paid: true, note: "on-demand" }),
    P("Lambda", "Revalidation seeder", { note: "deploy-time custom resource" }),
    P("IAM", "Execution role per Lambda", { security: true }),
    P("CloudWatch", "Log group per Lambda", { paid: true, note: "persists after teardown" })
  ];
  if (str(r.props.domain)) {
    out.push(P("ACM", "TLS certificate", { conditional: "custom domain", security: true }));
    out.push(P("Route53", "DNS records", { conditional: "custom domain" }));
  }
  return out;
}
function bucketResources(r) {
  const access = str(r.props.access);
  return [
    P("S3", "Bucket", { paid: true }),
    P("S3", "Bucket policy", {
      security: true,
      note: access ? `grants ${access} read access` : "private"
    }),
    P("S3", "Public access block", { security: true }),
    P("S3", "Ownership controls"),
    P("S3", "CORS configuration"),
    P("Lambda", "Event notification", { conditional: "a worker handles its events" })
    // NOTE: a Bucket NEVER creates a CloudFront distribution (verified).
  ];
}
function workerResources(r, subscriberKind) {
  const out = [
    P("Lambda", "Function", { paid: true }),
    P("IAM", "Execution role", { security: true }),
    P("CloudWatch", "Log group", { paid: true })
  ];
  if (subscriberKind === "queue")
    out.push(P("Lambda", "SQS event-source mapping", { note: "consumes its queue" }));
  else if (subscriberKind === "snstopic")
    out.push(
      P("SNS", "Topic subscription + invoke permission", { note: "SNS pushes to the Lambda" })
    );
  else if (subscriberKind === "bus")
    out.push(
      P("EventBridge", "Rule target + invoke permission", {
        note: "the bus rule invokes the Lambda"
      })
    );
  return out;
}
function resourcesFor(r, ctx) {
  switch (r.kind) {
    case "nextjs":
      return nextjsResources(r);
    case "staticsite":
      return [
        P("S3", "Site bucket", { paid: true, note: "static files" }),
        P("CloudFront", "Distribution", { paid: true, note: "the public URL / CDN" }),
        P("CloudFront", "viewer-request Function"),
        P("CloudFront", "Origin Access (OAI)", { security: true }),
        P("CloudFront", "Cache policy")
      ];
    case "bucket":
      return bucketResources(r);
    case "dynamo":
      return [P("DynamoDB", "Table", { paid: true, note: "on-demand" })];
    case "queue":
      return [P("SQS", "Queue", { paid: true })];
    case "bus":
      return [
        P("EventBridge", "Event bus", { paid: true }),
        P("EventBridge", "Rules per subscriber", { conditional: "a worker subscribes" })
      ];
    case "snstopic":
      return [
        P("SNS", "Topic", { paid: true }),
        P("SNS", "Subscriptions per subscriber", { conditional: "a worker subscribes" })
      ];
    case "apigatewayv2":
      return [
        P("API Gateway", "HTTP API", { paid: true }),
        P("API Gateway", "Default stage"),
        P("API Gateway", "Route + integration", { conditional: "a worker handles a route" }),
        P("Lambda", "Invoke permission", {
          security: true,
          conditional: "a worker handles a route"
        }),
        P("CloudWatch", "Access log group", { paid: true })
      ];
    case "router":
      return [
        P("CloudFront", "Distribution", { paid: true, note: "the front-door CDN" }),
        P("CloudFront", "Cache policy"),
        P("ACM", "TLS certificate", { conditional: "custom domain", security: true }),
        P("Route53", "DNS records", { conditional: "custom domain" })
      ];
    case "worker":
      return workerResources(r, ctx.subscriberKindOf(r));
    case "cron":
      return [
        P("EventBridge", "Scheduler schedule", { note: "EventBridge Scheduler (not a Rule)" }),
        P("IAM", "Scheduler role", { security: true })
      ];
    case "postgres":
      return [
        P("RDS", "Postgres instance", { paid: true, note: "db.t4g.micro" }),
        P("RDS", "DB subnet group"),
        P("RDS", "DB parameter group"),
        P("Secrets Manager", "Master credentials", { security: true }),
        P("SSM", "Link parameters", { note: "Resource.<Db>.{host,port,\u2026}" })
      ];
    case "aurora":
      return [
        P("RDS", "Aurora cluster", { paid: true, note: "Serverless v2" }),
        P("RDS", "Cluster instance (writer)", { paid: true }),
        P("RDS", "DB subnet group"),
        P("RDS", "Cluster parameter group"),
        P("Secrets Manager", "Master credentials", { security: true }),
        P("SSM", "Link parameters", { note: "Resource.<Db>.{host,port,\u2026}" })
      ];
    case "redis":
      return [
        P("ElastiCache", "Replication group", {
          paid: true,
          note: r.props.engine === "valkey" ? "cache.t4g.micro Valkey" : "cache.t4g.micro Redis"
        }),
        P("ElastiCache", "Subnet group"),
        P("ElastiCache", "Parameter group"),
        P("EC2", "Security group", { security: true, note: "in-VPC access only" }),
        P("SSM", "Link parameters", { note: "Resource.<Cache>.{host,port,username,password}" })
      ];
    case "service": {
      const cpu = typeof r.props.cpu === "string" ? r.props.cpu : "0.25 vCPU";
      const out = [
        P("ECS", "Fargate service", { paid: true, note: `${cpu}, 1 task` }),
        P("ECS", "Task definition"),
        P("IAM", "Task role + execution role", { security: true, note: "link grants attach here" }),
        P("ECR", "Image repository", { note: "built + pushed from services/<name>/" }),
        P("CloudWatch", "Log group", { note: "container logs" }),
        P("EC2", "Security group", { security: true })
      ];
      if (r.props.public !== "no") {
        out.push(
          P("ELB", "Application Load Balancer", { paid: true, note: "~$16/mo + LCU" }),
          P("ELB", "Target group + listener")
        );
      } else {
        out.push(P("Cloud Map", "Service discovery", { note: "private in-VPC DNS" }));
      }
      return out;
    }
    case "stepFunctions":
      return [
        P("Step Functions", "State machine", { note: "compiled to Amazon States Language" }),
        P("IAM", "Execution role", { security: true, note: "invoke each step + task perms" }),
        P("Lambda", "Step functions \xD72", { note: "Validate + Process" }),
        P("CloudWatch", "Execution log group")
      ];
    case "appsync":
      return [
        P("AppSync", "GraphQL API", { note: "schema.graphql" }),
        P("AppSync", "Lambda data source"),
        P("AppSync", "Resolvers", { note: "one per Type.field" }),
        P("Lambda", "Resolver function", { note: "src/<api>-resolver" }),
        P("IAM", "Service-link role", { security: true, note: "AppSync \u2192 data source" })
      ];
    case "realtime":
      return [
        P("IoT", "Custom authorizer", { security: true, note: "validates every WS connect" }),
        P("Lambda", "Authorizer function", { note: "src/realtime-authorizer" }),
        P("Lambda", "Subscriber function", { note: "src/realtime-subscriber" }),
        P("IoT", "Topic rule (subscribe)"),
        P("IAM", "IoT invoke permission", { security: true })
      ];
    case "task":
      return [
        P("ECS", "Fargate task definition", { note: "run on demand via task.run()" }),
        P("IAM", "Task role + execution role", { security: true, note: "link grants attach here" }),
        P("ECR", "Image repository", { note: "built + pushed from tasks/<name>/" }),
        P("CloudWatch", "Log group")
      ];
    case "cognito":
      return [
        P("Cognito", "User Pool", { security: true }),
        P("Cognito", "User Pool Client", { note: 'addClient("Web") \u2014 no Identity Pool' })
      ];
    case "openauth":
      return [
        P("Lambda", "OpenAuth issuer (Hono)", { note: "auth/index.handler" }),
        P("Lambda", "Function URL", { note: "Resource.<Auth>.url" }),
        P("DynamoDB", "Storage table", { paid: true, note: "auto-provisioned (DynamoStorage)" }),
        P("IAM", "Issuer role", { security: true })
      ];
    case "secret":
      return [P("SSM", "Parameter (SecureString)", { security: true })];
    case "ai":
      return [P("SSM", "Parameter (SecureString)", { security: true, note: "Anthropic API key" })];
    case "email":
      return [P("SES", "Email identity"), P("SES", "Configuration set")];
    case "stripe":
    case "clerk":
    case "mongodb":
    case "externalApi":
      return [
        P("External", `${r.name} (no AWS infra)`, { note: "env-driven third-party service" })
      ];
    default:
      return null;
  }
}
function vpcGroup(nat, bp) {
  const resources = [
    P("VPC", "VPC"),
    P("VPC", "Public subnets \xD72"),
    P("VPC", "Private subnets \xD72"),
    P("VPC", "Route tables \xD74"),
    P("EC2", "Internet Gateway"),
    P("EC2", "Default security group", { security: true }),
    P("Cloud Map", "Private DNS namespace", {
      paid: true,
      note: "~$0.50/mo \u2014 the only standing VPC cost"
    })
  ];
  if (nat === "ec2") {
    resources.push(P("EC2", "fck-nat instances \xD72", { paid: true, note: "t4g.nano, ~$4/mo" }));
    resources.push(P("EC2", "Elastic IPs (NAT)"));
  } else if (nat === "managed") {
    resources.push(P("EC2", "NAT Gateway(s)", { paid: true, note: "~$32/mo per AZ" }));
    resources.push(P("EC2", "Elastic IPs (NAT)"));
  }
  if (bp.resources.some((r) => r.kind === "service" || r.kind === "task")) {
    resources.push(P("ECS", "Cluster", { note: "shared by all Services/Tasks (Fargate)" }));
  }
  return { id: "vpc", title: "VPC (shared by databases / cache)", kind: "vpc", resources };
}
var ORDER = [
  "nextjs",
  "staticsite",
  "service",
  "task",
  "postgres",
  "aurora",
  "redis",
  "dynamo",
  "bucket",
  "queue",
  "bus",
  "snstopic",
  "realtime",
  "stepFunctions",
  "appsync",
  "apigatewayv2",
  "router",
  "worker",
  "cron",
  "cognito",
  "openauth",
  "secret",
  "ai",
  "email",
  "stripe",
  "clerk",
  "mongodb",
  "externalApi"
];
function expandAws(bp) {
  const byId = new Map(bp.resources.map((r) => [r.id, r]));
  const subscriberKindOf = (w) => {
    const edge = bp.connections.find((c) => c.source === w.id && c.intent === "subscribesTo");
    const kind = edge ? byId.get(edge.target)?.kind : void 0;
    return kind === "queue" || kind === "bus" || kind === "snstopic" ? kind : void 0;
  };
  const sorted = [...bp.resources].sort(
    (a, b) => (ORDER.indexOf(a.kind) + 1 || 99) - (ORDER.indexOf(b.kind) + 1 || 99)
  );
  const groups = [];
  for (const r of sorted) {
    const resources = resourcesFor(r, { subscriberKindOf });
    if (resources) groups.push({ id: r.id, title: r.name, kind: r.kind, resources });
  }
  const dbWithVpc = bp.resources.filter(
    (r) => r.kind === "postgres" || r.kind === "aurora" || r.kind === "redis" || r.kind === "service" || r.kind === "task"
  );
  if (dbWithVpc.length) groups.push(vpcGroup(effectiveAwsNat(bp), bp));
  return groups;
}

// lib/targets/vercel/expansion.ts
var P2 = (service, name, opts = {}) => ({ service, name, ...opts });
function resourcesFor2(r) {
  switch (r.kind) {
    case "app":
      return [
        P2("Vercel", "Edge Network (CDN)", { paid: true, note: "global; serves static + caches" }),
        P2("Vercel", "Serverless / Fluid Functions", { paid: true, note: "one per route handler" }),
        P2("Vercel", "Build & deployments", { note: "preview per push, prod on the main branch" }),
        P2("Vercel", "Environment variables", { security: true, note: "encrypted at rest" })
      ];
    case "blob":
      return [
        P2("Vercel Blob", "Store (S3-backed)", {
          paid: true,
          security: true,
          note: "immutable public|private mode"
        }),
        P2("Vercel", "BLOB_READ_WRITE_TOKEN", { security: true })
      ];
    case "postgres":
      return [
        P2("Neon", "Serverless Postgres (external)", {
          paid: true,
          security: true,
          note: "connect via DATABASE_URL"
        })
      ];
    case "redis":
      return [
        P2("Upstash", "Serverless Redis (external)", {
          paid: true,
          security: true,
          note: "REST URL + token"
        })
      ];
    case "queue":
      return [
        P2("Vercel Queue", "Topic (beta)", { paid: true, note: "at-least-once; no built-in DLQ" })
      ];
    case "consumer":
      return [
        P2("Vercel", "Consumer function", { paid: true, note: "push-mode (handleCallback)" }),
        P2("Vercel", "experimentalTriggers (vercel.json)", {
          note: "queue/v2beta \u2014 changes before GA"
        })
      ];
    case "cron":
      return [
        P2("Vercel Cron", "Schedule (vercel.json)", { note: "production deployments only; UTC" }),
        P2("Vercel", "GET route function", { security: true, note: "must verify CRON_SECRET" })
      ];
    case "webhook":
      return [
        P2("Vercel", "Webhook route function", { security: true, note: "must verify signature" })
      ];
    case "email":
      return [P2("Resend", "Email API (external)", { security: true, note: "RESEND_API_KEY" })];
    default:
      return [];
  }
}
function expandVercel(bp) {
  return bp.resources.map((r) => ({
    id: r.id,
    title: r.name,
    kind: r.kind,
    resources: resourcesFor2(r)
  }));
}

// lib/core/expansion/expand.ts
var EXPANDERS = {
  "aws-sst-v4": expandAws,
  vercel: expandVercel
};
function expandInfra(bp) {
  const fn = EXPANDERS[bp.target.deploy];
  return fn ? fn(bp) : [];
}

// lib/targets/aws-sst-v4/audit.ts
function auditAws(bp) {
  const out = [];
  const byKind = (k) => bp.resources.filter((r) => r.kind === k);
  const has2 = (k) => bp.resources.some((r) => r.kind === k);
  for (const b of byKind("bucket")) {
    if (b.props.access === "public") {
      out.push({
        level: "warn",
        title: `Bucket "${b.name}" is public`,
        detail: 'access: "public" makes every object readable by anyone on the internet. Use "cloudfront" unless you really want public files.',
        resourceId: b.id
      });
    }
  }
  if (has2("nextjs")) {
    out.push({
      level: "info",
      title: "Next.js server URLs are public by default",
      detail: 'OpenNext exposes the server + image Lambdas via public Function URLs (protection: "none"); CloudFront fronts them. Lock origins to CloudFront with `protection` if needed.'
    });
  }
  const hasData = ["dynamo", "postgres", "aurora", "mongodb", "bucket", "stripe"].some(has2);
  const hasAuth = has2("cognito") || has2("clerk");
  if (has2("nextjs") && hasData && !hasAuth) {
    out.push({
      level: "warn",
      title: "No authentication configured",
      detail: "Your app handles data or payments but has no Cognito or Clerk node \u2014 server actions and routes are open to anyone. Add an auth node."
    });
  }
  if (["stripe", "mongodb", "clerk", "externalApi"].some(has2)) {
    out.push({
      level: "info",
      title: "Keep server keys out of the client",
      detail: "STRIPE_SECRET_KEY / DATABASE_URL / CLERK_SECRET_KEY must stay server-only \u2014 never prefix them with NEXT_PUBLIC_. Only *_PUBLISHABLE_KEY values are safe in the browser."
    });
  }
  if (has2("secret") || has2("ai")) {
    out.push({
      level: "info",
      title: "Secrets live in SSM",
      detail: "Set them with `sst secret set <Name> <value>` \u2014 never hardcode or commit them. They are not part of .env."
    });
  }
  const dbs = [...byKind("postgres"), ...byKind("aurora")];
  if (dbs.length) {
    const nat = effectiveAwsNat(bp);
    for (const p of dbs.filter((d) => d.props.nat === "managed")) {
      out.push({
        level: "info",
        title: "Managed NAT gateway is pricey",
        detail: '~$32/mo per AZ. fck-nat (nat: "ec2") gives the same egress for ~$4/mo.',
        resourceId: p.id
      });
    }
    const explicit = dbs.some((d) => d.props.nat === "ec2" || d.props.nat === "managed");
    if (nat === "ec2" && !explicit) {
      out.push({
        level: "info",
        title: "fck-nat added automatically",
        detail: 'App code joins the VPC to reach the database, and in-VPC Lambdas have no internet egress without NAT \u2014 so the export ships fck-nat (nat: "ec2", ~$4/mo). Pick "managed" on the database node for heavier egress.',
        resourceId: dbs[0].id
      });
    } else if (nat === "none") {
      for (const p of dbs) {
        out.push({
          level: "info",
          title: `"${p.name}" VPC has no internet egress`,
          detail: 'With no NAT, Lambdas inside the VPC cannot reach the public internet (RDS access still works). Add fck-nat (nat: "ec2") if they must call external APIs.',
          resourceId: p.id
        });
      }
    }
  }
  return out;
}

// lib/targets/vercel/audit.ts
function auditVercel(bp) {
  const out = [];
  const byKind = (k) => bp.resources.filter((r) => r.kind === k);
  const has2 = (k) => bp.resources.some((r) => r.kind === k);
  for (const b of byKind("blob")) {
    if (b.props.access === "public") {
      out.push({
        level: "warn",
        title: `Blob "${b.name}" is public`,
        detail: "Public blobs are world-readable by URL. Use private access for anything user-owned or sensitive.",
        resourceId: b.id
      });
    }
  }
  if (has2("postgres") || has2("redis") || has2("webhook") || has2("email")) {
    out.push({
      level: "info",
      title: "Keep server keys out of the client",
      detail: "DATABASE_URL, UPSTASH_* , STRIPE_SECRET_KEY and RESEND_API_KEY must stay server-only \u2014 never prefix them with NEXT_PUBLIC_ (that inlines them into the browser bundle)."
    });
  }
  for (const c of byKind("cron")) {
    out.push({
      level: "info",
      title: `Cron "${c.name}" runs on a public URL`,
      detail: "Vercel triggers crons via public HTTP GET \u2014 the generated route checks Authorization: Bearer ${CRON_SECRET}. Keep that check and set CRON_SECRET.",
      resourceId: c.id
    });
  }
  for (const w of byKind("webhook")) {
    out.push({
      level: "info",
      title: `Webhook "${w.name}" must verify signatures`,
      detail: "The generated route verifies the provider signature before trusting the payload. Never remove that check \u2014 webhook URLs are public.",
      resourceId: w.id
    });
  }
  if (has2("queue")) {
    out.push({
      level: "info",
      title: "Vercel Queues is beta",
      detail: "experimentalTriggers / queue/v2beta will change before GA, and there is no built-in DLQ \u2014 make consumers idempotent and handle poison messages in the retry path. Re-verify each release."
    });
  }
  return out;
}

// lib/core/audit/audit.ts
var AUDITORS = {
  "aws-sst-v4": auditAws,
  vercel: auditVercel
};
function auditInfra(bp) {
  const fn = AUDITORS[bp.target.deploy];
  return fn ? fn(bp) : [];
}

// scripts/sanitize.mjs
var R = "<REDACTED>";
var CONN_STRING = /\b((?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis|rediss|amqp|amqps|https?|ftp):\/\/)[^\s:'"`@/]+:[^\s:'"`@/]+@/gi;
var QUERY_CREDS = /([?&;](?:api[_-]?key|apikey|password|pwd|token|secret|access[_-]?token|auth|sig)=)([^&;"'`\s]+)/gi;
var VALUE_PATTERNS = [
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  // AWS access key id
  /\bAC[0-9a-fA-F]{32}\b/g,
  // Twilio Account SID
  /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g,
  // Stripe key
  /\bwhsec_[A-Za-z0-9]{16,}\b/g,
  // Stripe webhook signing secret
  /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  // OpenAI / Anthropic (sk-, sk-ant-, sk-proj-)
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/g,
  // GitHub token
  /\bgithub_pat_[A-Za-z0-9_]{40,}\b/g,
  // GitHub fine-grained PAT
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  // Slack
  /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g,
  // SendGrid
  /\bAIza[0-9A-Za-z_-]{30,}/g,
  // Google API key
  /\b[0-9]+-[a-z0-9]{32}\.apps\.googleusercontent\.com\b/g,
  // Google OAuth client id
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{6,}\b/g,
  // JWT
  /-----BEGIN [^-\n]+-----[\s\S]*?-----END [^-\n]+-----/g,
  // any PEM block (key/cert)
  /\b[A-Za-z0-9+/]{120,}={0,2}/g
  // long base64 blob (encoded creds / cert body)
];
var SECRET_NAME = /(secret|pass(?:word|wd|phrase)?|token|api[_-]?key|access[_-]?key|secret[_-]?key|private[_-]?key|credential|client[_-]?secret|signing[_-]?key|auth[_-]?token|session[_-]?secret|encryption[_-]?key|webhook[_-]?secret|service[_-]?account|connection[_-]?string|database[_-]?url|\bdsn\b)/i;
var STRINGY_VALUE = /(\[[^\][]*\]|(?:["'`](?:\\.|[^"'`\\])*["'`]\s*\+\s*)*["'`](?:\\.|[^"'`\\])*["'`])/;
function sanitize(input) {
  let text = String(input);
  let redactions = 0;
  text = text.replace(CONN_STRING, (_m, scheme) => {
    redactions += 1;
    return `${scheme}${R}:${R}@`;
  });
  text = text.replace(QUERY_CREDS, (_m, key) => {
    redactions += 1;
    return `${key}${R}`;
  });
  text = text.replace(
    /(\bnew\s+sst\.Secret\s*\(\s*["'`][^"'`]*["'`]\s*,\s*)(["'`])(?:\\.|(?!\2)[\s\S])*\2/g,
    (_m, head) => {
      redactions += 1;
      return `${head}"${R}"`;
    }
  );
  for (const re of VALUE_PATTERNS) {
    text = text.replace(re, () => {
      redactions += 1;
      return R;
    });
  }
  const NAMED = new RegExp(`([A-Za-z_$][\\w$]*)(\\s*[:=]\\s*)${STRINGY_VALUE.source}`, "g");
  text = text.replace(NAMED, (full, name, mid, value) => {
    if (!SECRET_NAME.test(name)) return full;
    if (/process\.env|import\.meta/.test(value)) return full;
    if (value === `"${R}"` || value === `'${R}'`) return full;
    redactions += 1;
    return `${name}${mid}"${R}"`;
  });
  return { text, redactions };
}

// cli/scan.ts
var SKIP_DIRS = /* @__PURE__ */ new Set([
  "node_modules",
  ".sst",
  ".git",
  ".next",
  "dist",
  "build",
  "out",
  ".turbo",
  ".vercel",
  "coverage",
  ".cache"
]);
var DEFINES_INFRA = /(\bnew\s+sst\.|sst\.Linkable\b|\$config\s*\()/;
function walk(dir) {
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
      if (!SKIP_DIRS.has(e.name) && !e.name.startsWith(".")) out = out.concat(walk(p));
    } else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith(".d.ts") && !/^\.env/i.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}
function appNameFrom(source, fallback) {
  const m = source.match(/\bname\s*:\s*["'`]([A-Za-z0-9._-]+)["'`][^}]{0,300}?\bhome\s*:/i) ?? source.match(
    /\bhome\s*:\s*["'`][^"'`]+["'`][^}]{0,300}?\bname\s*:\s*["'`]([A-Za-z0-9._-]+)["'`]/i
  );
  return m ? m[1] : fallback;
}
var CTOR = /new\s+sst\.(?:aws\.|cloudflare\.|vercel\.)?([A-Za-z0-9]+)\s*\(\s*["'`]([^"'`]+)["'`]/g;
function droppedConstructors(blob, recovered, already) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  let m;
  CTOR.lastIndex = 0;
  while ((m = CTOR.exec(blob)) !== null) {
    const [, kind, name] = m;
    if (recovered.has(name) || seen.has(name)) continue;
    if (already.some((u) => u.snippet.includes(name))) continue;
    seen.add(name);
    out.push({
      snippet: `new sst.${kind}("${name}")`,
      reason: "recognized SST construct not modeled as a node (e.g. auto-managed Vpc/Cluster) \u2014 review by hand"
    });
  }
  return out;
}
function scanRepo(root, now) {
  const files = walk(root);
  const sanitized = /* @__PURE__ */ new Map();
  let redactions = 0;
  for (const f of files) {
    try {
      const { text, redactions: n } = sanitize(readFileSync(f, "utf8"));
      sanitized.set(f, text);
      redactions += n;
    } catch {
    }
  }
  const infra = [...sanitized.entries()].filter(([, t]) => DEFINES_INFRA.test(t));
  const isAws = infra.some(([f]) => /sst\.config\.tsx?$/.test(f)) || infra.length > 0;
  let nodes = [];
  let edges = [];
  let unmodeled = [];
  let target = "aws-sst-v4";
  let appName = "scanned-app";
  if (isAws && infra.length) {
    const blob = infra.map(([, t]) => t).join("\n\n");
    appName = appNameFrom(blob, appName);
    const parsed = parseAwsConfig(blob);
    nodes = parsed.nodes;
    edges = parsed.edges;
    const recovered = new Set(nodes.map((n) => n.name));
    unmodeled = [
      ...parsed.unrecognized,
      ...droppedConstructors(blob, recovered, parsed.unrecognized)
    ];
  } else {
    target = "vercel";
    const pkg = sanitized.get(join(root, "package.json")) ?? readPkg(root);
    if (pkg) {
      const parsed = parseVercelConfig(pkg);
      nodes = parsed.nodes;
      edges = parsed.edges;
      unmodeled = parsed.unrecognized;
      try {
        appName = JSON.parse(pkg).name ?? appName;
      } catch {
      }
    }
  }
  const app = { name: appName, region: "us-east-1", packageManager: "yarn" };
  const snapshot = { nodes, edges };
  const bp = draftBlueprint(snapshot, target, app, now);
  const scannedNodes = nodes.map((n) => ({ ...n, confidence: "high" }));
  return {
    appName,
    target,
    scannedFiles: infra.map(([f]) => relative(root, f).split(sep).join("/")),
    redactions,
    nodes: scannedNodes,
    edges,
    unmodeled,
    validation: validateBlueprint(bp),
    simulation: simulateBlueprint(bp),
    cost: estimateCost(bp),
    expansion: expandInfra(bp),
    audit: auditInfra(bp),
    generatedAt: now
  };
}
function readPkg(root) {
  try {
    return readFileSync(join(root, "package.json"), "utf8");
  } catch {
    return void 0;
  }
}

// cli/report.ts
var KIND_NOTE = (c) => c === "high" ? "" : " _(low confidence)_";
function toMarkdown(r) {
  const out = [];
  out.push(`# ${r.appName} \u2014 infrastructure map`);
  out.push("");
  out.push(
    `> Scanned locally by **sst-dream** \u2014 no credentials, no network. ${r.redactions} potential secret${r.redactions === 1 ? "" : "s"} redacted before parsing. Lane: \`${r.target}\`.`
  );
  out.push("");
  out.push(`## Resources (${r.nodes.length})`);
  out.push("");
  if (r.nodes.length) {
    out.push("| Resource | Kind | Confidence |");
    out.push("| --- | --- | --- |");
    for (const n of r.nodes) out.push(`| ${n.name} | \`${n.kind}\` | ${n.confidence} |`);
  } else {
    out.push("_No resources recovered. Is this an SST/Vercel project root?_");
  }
  out.push("");
  if (r.edges.length) {
    out.push("## Data flow");
    out.push("");
    const byId = new Map(r.nodes.map((n) => [n.id, n.name]));
    for (const e of r.edges) {
      out.push(
        `- **${byId.get(e.source) ?? e.source}** \u2192 **${byId.get(e.target) ?? e.target}** (\`${e.intent}\`)`
      );
    }
    out.push("");
  }
  out.push("## Estimated cost");
  out.push("");
  out.push(`**~$${r.cost.totalMonthlyUsd.toFixed(2)}/mo** (rough design-time ballpark).`);
  const paid = r.cost.perResource.filter((p) => p.monthlyUsd > 0);
  if (paid.length) {
    out.push("");
    for (const p of paid) out.push(`- ${p.name} (\`${p.kind}\`): ~$${p.monthlyUsd.toFixed(2)}/mo`);
  }
  out.push("");
  const broken = r.simulation.events.filter((e) => e.status === "broken");
  out.push("## Wiring check");
  out.push("");
  if (broken.length === 0) {
    out.push("\u2705 Every resource is reachable / wired.");
  } else {
    out.push(`\u26A0\uFE0F ${broken.length} wiring issue(s):`);
    for (const e of broken) out.push(`- ${e.label}${e.detail ? ` \u2014 ${e.detail}` : ""}`);
  }
  out.push("");
  if (r.audit.length) {
    out.push("## Security & ops");
    out.push("");
    for (const f of r.audit) out.push(`- **[${f.level}]** ${f.title} \u2014 ${f.detail}`);
    out.push("");
  }
  out.push("## Not recognized (review by hand)");
  out.push("");
  if (r.unmodeled.length === 0) {
    out.push("Everything in your infra files mapped cleanly. \u{1F389}");
  } else {
    out.push(
      `${r.unmodeled.length} thing(s) the static scan couldn't model \u2014 dynamic/loop/helper patterns or components not in the catalog. These are **not** in the map above:`
    );
    out.push("");
    for (const u of r.unmodeled) out.push(`- \`${u.snippet}\` \u2014 ${u.reason}`);
  }
  out.push("");
  out.push("---");
  out.push(
    `_Generated ${r.generatedAt} from ${r.scannedFiles.length} file(s). This is a **local-inferred** view of your code \u2014 not deployed truth._${KIND_NOTE("high")}`
  );
  return out.join("\n") + "\n";
}

// cli/index.ts
var HELP = `sst-dream \u2014 local infrastructure intelligence (no credentials, no network)

Usage:
  sst-dream scan [dir]        Scan a local SST/Vercel project into an infra map
    --out <dir>               Where to write outputs (default: current dir)
    --json-only               Write only the graph JSON (skip the Markdown map)
    --quiet                   Suppress the stdout summary

Outputs:
  ARCHITECTURE.md             A human-readable architecture map
  sstdream-scan.json          The sanitized graph + cost/sim/audit (machine-readable, for CI)

Runs entirely on your machine. No credentials, no network, nothing uploaded.
`;
function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : void 0;
}
var has = (flag) => process.argv.includes(flag);
function main() {
  const cmd = process.argv[2];
  if (!cmd || cmd === "--help" || cmd === "-h" || cmd === "help") {
    process.stdout.write(HELP);
    return;
  }
  if (cmd !== "scan") {
    process.stderr.write(`Unknown command "${cmd}".

${HELP}`);
    process.exitCode = 1;
    return;
  }
  const dirArg = process.argv[3] && !process.argv[3].startsWith("-") ? process.argv[3] : ".";
  const root = resolve(process.cwd(), dirArg);
  const outDir = resolve(process.cwd(), arg("--out") ?? ".");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const result = scanRepo(root, now);
  const jsonPath = join2(outDir, "sstdream-scan.json");
  writeFileSync(jsonPath, JSON.stringify(result, null, 2));
  let mdPath;
  if (!has("--json-only")) {
    mdPath = join2(outDir, "ARCHITECTURE.md");
    writeFileSync(mdPath, toMarkdown(result));
  }
  if (!has("--quiet")) {
    const broken = result.simulation.events.filter((e) => e.status === "broken").length;
    process.stdout.write(
      `
\u2713 Scanned ${result.scannedFiles.length} infra file(s) in ${root}
  ${result.nodes.length} resource(s) recovered` + (result.unmodeled.length ? ` \xB7 ${result.unmodeled.length} not recognized` : "") + `
  ${result.redactions} secret(s) redacted \xB7 ~$${result.cost.totalMonthlyUsd.toFixed(2)}/mo` + (broken ? ` \xB7 ${broken} wiring issue(s)` : " \xB7 wiring OK") + (mdPath ? `

\u2192 ${mdPath}  (read this)` : "") + `
\u2192 ${jsonPath}

  See it as an editable diagram: open the builder's "From code" import and paste
  ${jsonPath} into it \u2014 the recovered design loads directly.
`
    );
  }
}
main();
