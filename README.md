# static-to-studio

Move a static blyg into [Blygger Studio](https://github.com/blygger/blygger-studio) **at the same address**, without changing a single published item.

- `import.mjs` reads the blyg's public files (`blyg.json`, `items/index.json`, `items/{id}.json`) and writes SQL that loads every item into Studio's D1 database: same ids, timestamps, versions, `content_md`, `content_html`, `content_hash` and changelog. Nothing is re-rendered or re-hashed.
- `verify.mjs` compares every item as served by the static blyg and by the new Studio, and checks Studio's feed carries each version's GUID. A clean run means the cutover is invisible to readers.

Used in production to move [caseyjr.org/blyg](https://caseyjr.org/blyg/) (8 fragments, path-mounted) onto Studio 0.20.2 at the same address. Also tested against Blygger Studio 0.21.0 (local `wrangler dev`, path-mounted at `/blyg`) with an 8-fragment fixture shaped like caseyjr.org/blyg: all items verified identical, a v2 edit of an imported item published normally, and re-running the import failed on the existing ids instead of overwriting them.

**Scope.** Fragments and plain threads at any version, provided earlier versions are pinned (only pinned bodies are public). It refuses, with a list and no SQL written, anything it can't import faithfully: media, withdrawn items, stubs, forks, threads with transclusions, unpinned history.

No warranty. Run `verify.mjs` before you switch routes.

---

## Runbook: caseyjr.org/blyg → Studio, same address

The idea: Studio runs as its own Worker, reachable only on `workers.dev` while you import and verify. Then two **routes** hand `caseyjr.org/blyg*` and `caseyjr.org/api/*` to it. On Cloudflare a route takes precedence over a Custom Domain on the same hostname, so the Astro site keeps everything else.

### 0. Pre-flight

```sh
curl -sI https://caseyjr.org/api/ | head -1        # expect 404: /api must be free
curl -s https://caseyjr.org/blyg/items/index.json | grep -o '"id"' | wc -l   # expect 8
```

Also check whether anything on caseyjr.org **outside** `/blyg/` reads the fragments collection (a homepage card, the main RSS). After the cutover, new posts live in Studio, not in the Astro build.

### 1. Freeze publishing

Don't publish with the GitHub Drafts action from here until step 6. A post that lands in the Astro build after the import would disappear when the routes switch.

### 2. Deploy Studio on workers.dev (no routes yet)

Use the Worker download from the [latest release](https://github.com/blygger/blygger-studio/releases/latest) (no build step):

```sh
shasum -a 256 blygger-worker-VERSION.tar.gz     # compare with SHA256SUMS
tar -xzf blygger-worker-VERSION.tar.gz && cd blygger-worker-VERSION
npx wrangler@4 whoami                            # the account that owns caseyjr.org
npx wrangler@4 d1 create blyg-caseyjr
npx wrangler@4 r2 bucket create blyg-caseyjr-media
```

Edit `wrangler.jsonc`:

- `name`: `caseyjr-blyg`; add your `account_id`
- D1 `database_name` / `database_id` from `d1 create` (binding stays `DB`); R2 bucket name (binding stays `MEDIA`)
- `vars.MOUNT`: **`"/blyg"`**
- **No `routes` yet**

```sh
npx wrangler@4 d1 migrations apply DB --remote
npx wrangler@4 secret put OWNER_PASSWORD
npx wrangler@4 secret put COOKIE_SECRET           # 64 random hex chars
npx wrangler@4 deploy                             # prints https://caseyjr-blyg.<you>.workers.dev
```

### 3. Import

```sh
node import.mjs --from https://caseyjr.org/blyg/ --out import.sql --settings
npx wrangler@4 d1 execute DB --remote --file import.sql
```

`--settings` also sets Studio's `site_url` to `https://caseyjr.org/blyg/` and copies the title, author name, bio and links from your manifest, so Studio's documents name the same site and author even while it's on workers.dev.

### 4. Verify

```sh
node verify.mjs --static https://caseyjr.org/blyg/ --studio https://caseyjr-blyg.<you>.workers.dev/blyg/
```

Every item must print `ok`. Also sign in at `https://caseyjr-blyg.<you>.workers.dev/blyg/studio` and look around; don't publish anything yet.

### 5. Switch routes (the cutover)

Add to `wrangler.jsonc` and deploy:

```jsonc
"routes": [
  { "pattern": "caseyjr.org/blyg",   "zone_name": "caseyjr.org" },
  { "pattern": "caseyjr.org/blyg/*", "zone_name": "caseyjr.org" },
  { "pattern": "caseyjr.org/api/*",  "zone_name": "caseyjr.org" }
]
```

```sh
npx wrangler@4 deploy
curl -s https://caseyjr.org/blyg/blyg.json | grep -o '"generator":"[^"]*"'   # blygger-studio/…
curl -s https://caseyjr.org/blyg/items/index.json | grep -o '"id"' | wc -l   # 8
```

**Rollback** is deleting the three routes in the dashboard (**Workers & Pages → your Studio Worker → Settings → Domains & Routes**). Removing them from `wrangler.jsonc` and deploying does **not** delete routes that already exist. Once they're gone, the Astro pages, which were never touched, take over immediately. Anything published in Studio after the cutover disappears from the site on rollback.

Right after the routes go live, Cloudflare's cache can briefly serve the old static responses (`cf-cache-status: HIT` with your old generator). That's not a failure: purge the cache (**your domain → Caching → Configuration → Purge Everything**) and re-check.

### 6. After

- Set `"workers_dev": false` and `"preview_urls": false` and deploy, so your blyg is served only at its real address. Studio is at `https://caseyjr.org/blyg/studio`. Connect Burrow to `https://caseyjr.org/blyg`.
- Drafts: switch to the Studio action with `blyg: "https://caseyjr.org/blyg/"`.
- When you're satisfied, retire the Astro side: the `/blyg` pages and fragments collection, `scripts/blyg-stamp.mjs` and its pre-commit hook, and the `blyg-inbox` workflow. `rel="blyg"` on your pages already points at the right place.

---

## Test it yourself

```sh
python3 test/make-fixture.py www/blyg http://localhost:8800/blyg/ && python3 -m http.server 8800 --directory www &
# in a blygger-studio checkout:
npx wrangler d1 migrations apply DB --local --persist-to /tmp/s && npx wrangler dev --port 8788 --persist-to /tmp/s --var MOUNT:/blyg &
node import.mjs --from http://localhost:8800/blyg/ --out /tmp/import.sql --settings
(cd blygger-studio && npx wrangler d1 execute DB --local --persist-to /tmp/s --file /tmp/import.sql)
node verify.mjs --static http://localhost:8800/blyg/ --studio http://localhost:8788/blyg/
```

## License and disclaimer

MIT. **No warranty of any kind. Use at your own risk.** These scripts read your blyg's public files and generate SQL that you run against your own Studio database; the runbook changes how your live site is routed. You are responsible for backups, for reviewing the generated SQL before running it, and for verifying the result before switching routes. Nothing here is affiliated with or endorsed by the Blygger project.
