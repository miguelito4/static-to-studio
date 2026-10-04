#!/usr/bin/env node
// Compare a static blyg with the Studio that's about to replace it.
//
//   node verify.mjs --static https://example.com/blyg/ --studio https://blyg.you.workers.dev/blyg/
//
// For every item in the static blyg's archive, fetches both item documents
// and checks the fields readers depend on. Exits non-zero on any mismatch.
// Run it before switching routes; a clean run means the cutover is invisible.

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
if (!args.static || !args.studio) {
  console.error("usage: node verify.mjs --static https://example.com/blyg/ --studio https://worker.example.workers.dev/blyg/");
  process.exit(2);
}
const S = args.static.replace(/\/*$/, "/");
const T = args.studio.replace(/\/*$/, "/");

async function get(url, as = "json") {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return as === "json" ? r.json() : r.text();
}

// Fields that must be identical for the move to be invisible to readers.
const EXACT = ["id", "kind", "origin", "page", "created", "updated", "version", "content_md", "content_html", "content_hash", "changelog", "media"];

let bad = 0;
const fail = (m) => { console.log(`FAIL ${m}`); bad++; };

const [sm, tm] = await Promise.all([get(`${S}blyg.json`), get(`${T}blyg.json`)]);
for (const k of ["site", "title"]) if (JSON.stringify(sm[k]) !== JSON.stringify(tm[k])) fail(`manifest ${k}: static ${JSON.stringify(sm[k])} vs studio ${JSON.stringify(tm[k])}`);
if (sm.author?.name !== tm.author?.name) fail(`manifest author.name: ${sm.author?.name} vs ${tm.author?.name}`);

const sIndex = await get(`${S}items/index.json`);
const tIndex = await get(`${T}items/index.json`);
const tIds = new Set(tIndex.items.map((e) => e.id));

for (const { id } of sIndex.items) {
  if (!tIds.has(id)) { fail(`${id}: missing from Studio's archive`); continue; }
  const [a, b] = await Promise.all([get(`${S}items/${id}.json`), get(`${T}items/${id}.json`)]);
  const diffs = EXACT.filter((k) => JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null));
  if (diffs.length) {
    fail(`${id}: ${diffs.join(", ")}`);
    for (const k of diffs) console.log(`    ${k}\n      static: ${JSON.stringify(a[k])?.slice(0, 160)}\n      studio: ${JSON.stringify(b[k])?.slice(0, 160)}`);
  } else {
    console.log(`ok   ${id} v${a.version}`);
  }
}

const feed = await get(`${T}feed.xml`, "text");
for (const { id, version } of sIndex.items) {
  if (!feed.includes(`blyg:${id}:v${version}`)) fail(`${id}: not in Studio's feed.xml as blyg:${id}:v${version}`);
}

console.log(bad ? `\n${bad} problem(s). Don't switch routes yet.` : `\nAll ${sIndex.items.length} items match. Safe to switch routes.`);
process.exit(bad ? 1 : 0);
