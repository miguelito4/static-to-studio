#!/usr/bin/env node
// Move a static blyg into Blygger Studio without changing a single published item.
//
// Reads the PUBLIC surface of an existing blyg (blyg.json, items/index.json,
// items/{id}.json) and writes SQL that inserts every item into a Studio D1
// database with its id, timestamps, version, content_md, content_html,
// content_hash and changelog exactly as published. Nothing is re-rendered or
// re-hashed: the bytes your readers already have are the bytes Studio serves.
//
//   node import.mjs --from https://example.com/blyg/ --out import.sql
//
// Then, against the Studio database (see README for the full sequence):
//   npx wrangler d1 execute DB --remote --file import.sql
//
// Scope, refused with a clear message rather than imported badly:
//   - items above version 1, unless every earlier version is pinned (only pinned
//     versions' bodies are public, and Studio needs every version's body)
//   - items with media (they would need their files copied into R2)
//   - withdrawn items, stubs, forks and threads with transclusions
// Anything refused is listed, and no SQL is written.

import fs from "node:fs";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]?.startsWith("--") ? true : all[i + 1] ?? true]] : acc), []),
);
if (!args.from) {
  console.error("usage: node import.mjs --from https://example.com/blyg/ [--out import.sql] [--settings]");
  process.exit(2);
}
const origin = String(args.from).replace(/\/*$/, "/");
const out = args.out ? String(args.out) : "import.sql";

async function getJson(url) {
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
}

const q = (v) => (v === null || v === undefined ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

const manifest = await getJson(`${origin}blyg.json`);
if (manifest.site && manifest.site.replace(/\/*$/, "/") !== origin) {
  console.error(`Manifest says this blyg is ${manifest.site}, not ${origin}. Import from its canonical address.`);
  process.exit(1);
}
const index = await getJson(`${origin}${manifest.items || "items/index.json"}`);
const ids = index.items.map((e) => e.id);
console.log(`${manifest.title || origin}: ${ids.length} items`);

const problems = [];
const statements = [];
const plan = [];

for (const id of ids) {
  const doc = await getJson(`${origin}items/${id}.json`);
  const where = `${id} (${doc.kind} v${doc.version})`;
  if (doc.id !== id) { problems.push(`${where}: document id is ${doc.id}`); continue; }
  if (doc.kind === "withdrawn") { problems.push(`${where}: withdrawn items aren't supported`); continue; }
  if (doc.kind !== "fragment" && doc.kind !== "thread") { problems.push(`${where}: unknown kind`); continue; }
  if (doc.media?.length) { problems.push(`${where}: has media; copy files into R2 first`); continue; }
  if (doc.stub_of || doc.forked_from) { problems.push(`${where}: stubs and forks aren't supported`); continue; }
  if (doc.transclusions?.length) { problems.push(`${where}: threads with transclusions aren't supported`); continue; }
  if (!Array.isArray(doc.changelog) || doc.changelog.length !== doc.version || doc.changelog.some((c, i) => c.version !== i + 1)) {
    problems.push(`${where}: changelog doesn't list versions 1..${doc.version}`); continue;
  }

  // Bodies for every version: the latest from the item document, earlier ones
  // only if pinned (§2.8 items/{id}/v{n}.json).
  const bodies = new Map([[doc.version, { content_md: doc.content_md, content_html: doc.content_html, content_hash: doc.content_hash }]]);
  let missing = false;
  for (const c of doc.changelog.slice(0, -1)) {
    if (!c.pinned) { missing = true; break; }
    const v = await getJson(`${origin}items/${id}/v${c.version}.json`);
    bodies.set(c.version, { content_md: v.content_md, content_html: v.content_html, content_hash: v.content_hash });
  }
  if (missing) { problems.push(`${where}: earlier versions aren't public (unpinned), so Studio can't hold their bodies`); continue; }

  const isThread = doc.kind === "thread";
  statements.push(
    `INSERT INTO items (id, kind, status, created, updated, version, content_md, dirty) VALUES (${q(id)}, ${q(doc.kind)}, 'public', ${q(doc.created)}, ${q(doc.updated)}, ${doc.version}, ${q(doc.content_md)}, 0);`,
  );
  for (const c of doc.changelog) {
    const b = bodies.get(c.version);
    statements.push(
      `INSERT INTO versions (item_id, version, content_md, content_hash, published_at, note, pinned, content_html, transclusions) VALUES (${q(id)}, ${c.version}, ${q(b.content_md)}, ${q(b.content_hash)}, ${q(c.at)}, ${q(c.note)}, ${c.pinned ? 1 : 0}, ${q(b.content_html)}, ${isThread ? "'[]'" : "NULL"});`,
    );
  }
  plan.push(where);
}

if (problems.length) {
  console.error(`\nNot imported — fix or exclude these first:\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}

// Optional: carry the manifest's identity into Studio's settings, so the
// documents Studio serves name the same site and author.
if (args.settings) {
  const set = (k, v) => statements.push(`INSERT INTO settings (key, value) VALUES (${q(k)}, ${q(v)}) ON CONFLICT(key) DO UPDATE SET value = excluded.value;`);
  set("site_url", origin);
  if (manifest.title) set("site_title", manifest.title);
  if (manifest.author?.name) set("author_name", manifest.author.name);
  if (manifest.author?.bio) set("author_bio", manifest.author.bio);
  if (manifest.author?.links) set("author_links", JSON.stringify(manifest.author.links));
}

const header = `-- Import of ${origin} into Blygger Studio, generated ${new Date().toISOString()}\n-- ${plan.length} items. Plain INSERTs: this fails, rather than overwrites, if an id already exists.\n`;
fs.writeFileSync(out, header + statements.join("\n") + "\n");
console.log(`\nWrote ${out}:\n  ${plan.join("\n  ")}`);
