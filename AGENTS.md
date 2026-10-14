# AGENTS.md: Flux UI (Sanmarcsoft hardened fork)

Home Assistant dashboard YAML (`dashboard/`), its assets (`www/`), and the hardening that makes its
third-party cards safe to run (`vendor/lock.json`, `tools/harden.ts`, `www/vendor/*.js`).

## Rules

- Harden here only. Never send these patches to the ElementZoom original.
- No house data in this repo: no real entity IDs, room names, hostnames, IPs or tokens.
  Installation-specific settings live in Home Assistant (resource query strings, dashboard config).
- Every third-party file goes through `vendor/lock.json`. Never add a card by URL anywhere else.
- `dist/` is build output and stays git-ignored.

## Verify

```bash
bun tools/harden.ts                                       # must print "OK <n> files", exit 0
rm -rf dist && bun tools/harden.ts && cat dist/manifest.json   # same hashes on every run
node --input-type=module --check < www/vendor/egress-guard.js
node --input-type=module --check < www/vendor/mobile-router.js
```

See `SECURITY.md` for what each patch does and why.
