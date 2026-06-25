import { kebabCase } from '@/lib/core/codegen/strings';

// CRUD generators (server actions + example pages/forms) for the data resources a
// Next.js app touches — extracted from runtime.ts. Pure string builders.

// CRUD server actions — the "complete backend↔frontend wiring" baseline. Full CRUD
// (incl. read/list) is generated for every data resource a Next.js app connects to, even
// when only a writesTo edge was drawn. Generic create/get/list/update/remove exports, one
// file per table — the frontend just imports them. Verified Next.js 16 "use server".
export const crudDynamoActionFile = (
  tableName: string,
  hashKey: string,
  rangeKey?: string,
): string => {
  const keyType = rangeKey
    ? `{ ${hashKey}: string; ${rangeKey}: string }`
    : `{ ${hashKey}: string }`;
  const itemType = rangeKey
    ? `{ ${hashKey}: string; ${rangeKey}: string; [key: string]: unknown }`
    : `{ ${hashKey}: string; [key: string]: unknown }`;
  return `"use server";

import { Resource } from "sst";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  ScanCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

// CRUD server actions for the "${tableName}" table. Call these from client components
// or forms — they run on the server. Add 'await requireUser()' at the top to protect them.

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TableName = Resource.${tableName}.name;

type Item = ${itemType};
type Key = ${keyType};

export async function create(item: Item): Promise<Item> {
  await client.send(new PutCommand({ TableName, Item: item }));
  return item;
}

export async function get(key: Key): Promise<Item | null> {
  const res = await client.send(new GetCommand({ TableName, Key: key }));
  return (res.Item as Item | undefined) ?? null;
}

export async function list(): Promise<Item[]> {
  const res = await client.send(new ScanCommand({ TableName }));
  return (res.Items as Item[] | undefined) ?? [];
}

export async function update(item: Item): Promise<Item> {
  await client.send(new PutCommand({ TableName, Item: item }));
  return item;
}

export async function remove(key: Key): Promise<void> {
  await client.send(new DeleteCommand({ TableName, Key: key }));
}
`;
};

export const crudMongoActionFile = (): string =>
  `"use server";

import { ObjectId } from "mongodb";
import { getDb } from "../../lib/mongo";

// Example CRUD server actions for a Mongo collection. Rename "items" + duplicate this
// file per collection. Call these from client components/forms — they run on the server.

const COLLECTION = "items";

export async function create(doc: Record<string, unknown>) {
  const db = await getDb();
  const res = await db.collection(COLLECTION).insertOne(doc);
  return { ...doc, _id: res.insertedId.toString() };
}

export async function list() {
  const db = await getDb();
  const docs = await db.collection(COLLECTION).find().toArray();
  return docs.map((d) => ({ ...d, _id: d._id.toString() }));
}

export async function get(id: string) {
  const db = await getDb();
  const doc = await db.collection(COLLECTION).findOne({ _id: new ObjectId(id) });
  return doc ? { ...doc, _id: doc._id.toString() } : null;
}

export async function update(id: string, patch: Record<string, unknown>) {
  const db = await getDb();
  await db.collection(COLLECTION).updateOne({ _id: new ObjectId(id) }, { $set: patch });
}

export async function remove(id: string) {
  const db = await getDb();
  await db.collection(COLLECTION).deleteOne({ _id: new ObjectId(id) });
}
`;

// Clerk server guard — drop 'await requireUser()' into any server action/route.
export const authGuardFile = (): string =>
  `import { auth } from "@clerk/nextjs/server";

/** Require a signed-in user. Call at the top of a server action or route handler. */
export async function requireUser(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}
`;

// Example frontend — closes the loop: a server-component page that lists via the
// action + a client form that creates. Restylable starter, one route per table.
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const crudDynamoPageFile = (tableName: string): string =>
  `import { list } from "../actions/${kebabCase(tableName)}";
import { CreateForm } from "./create-form";

// Example CRUD page for "${tableName}" — lists items and creates them via the server
// actions in app/actions/${kebabCase(tableName)}.ts. Restyle / extend freely.
export default async function Page() {
  const items = await list();
  return (
    <main style={{ maxWidth: 640, margin: "2rem auto", fontFamily: "system-ui" }}>
      <h1>${tableName}</h1>
      <CreateForm />
      <ul>
        {items.map((item, i) => (
          <li key={i}>
            <code>{JSON.stringify(item)}</code>
          </li>
        ))}
      </ul>
    </main>
  );
}
`;

export const crudDynamoFormFile = (
  tableName: string,
  hashKey: string,
  rangeKey?: string,
): string => {
  const hCap = cap(hashKey);
  const rCap = rangeKey ? cap(rangeKey) : '';
  const rangeState = rangeKey ? `  const [${rangeKey}, set${rCap}] = useState("");\n` : '';
  const createArgs = rangeKey ? `{ ${hashKey}, ${rangeKey} }` : `{ ${hashKey} }`;
  const resetRange = rangeKey ? `    set${rCap}("");\n` : '';
  const rangeInput = rangeKey
    ? `      <input value={${rangeKey}} onChange={(e) => set${rCap}(e.target.value)} placeholder="${rangeKey}" required />\n`
    : '';
  return `"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { create } from "../actions/${kebabCase(tableName)}";

export function CreateForm() {
  const router = useRouter();
  const [${hashKey}, set${hCap}] = useState("");
${rangeState}  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    await create(${createArgs});
    set${hCap}("");
${resetRange}    setPending(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      <input value={${hashKey}} onChange={(e) => set${hCap}(e.target.value)} placeholder="${hashKey}" required />
${rangeInput}      <button type="submit" disabled={pending}>
        Add
      </button>
    </form>
  );
}
`;
};

export const crudMongoPageFile = (): string =>
  `import { list } from "../actions/items";
import { CreateForm } from "./create-form";

// Example CRUD page for the "items" Mongo collection.
export default async function Page() {
  const items = await list();
  return (
    <main style={{ maxWidth: 640, margin: "2rem auto", fontFamily: "system-ui" }}>
      <h1>Items</h1>
      <CreateForm />
      <ul>
        {items.map((item) => (
          <li key={String(item._id)}>
            <code>{JSON.stringify(item)}</code>
          </li>
        ))}
      </ul>
    </main>
  );
}
`;

export const crudMongoFormFile = (): string =>
  `"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { create } from "../actions/items";

export function CreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    await create({ name });
    setName("");
    setPending(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="name" required />
      <button type="submit" disabled={pending}>
        Add
      </button>
    </form>
  );
}
`;
