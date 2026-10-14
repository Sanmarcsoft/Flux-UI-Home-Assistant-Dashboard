#!/usr/bin/env bun
// Deterministic hardening build for the third-party cards Flux UI depends on.
//
// For every file in vendor/lock.json: download the pinned upstream file, refuse unless its
// sha256 matches the lock, apply the listed string patches (each must match exactly the
// expected number of times), and refuse unless the patched sha256 matches the lock.
// Output lands in dist/ (git-ignored), laid out the way /config/www/vendor expects.
//
//   bun tools/harden.ts                 build and verify against the lock
//   bun tools/harden.ts --write-lock    build, then record patched sha256s (review the diff!)
//
// Exit 0 = every file built and matched; 1 = any mismatch; 2 = bad invocation.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

type Patch = { id: string; find: string; replace: string; count: number } | { id: string; prepend: string };
type LockFile = { src: string; out: string; sha256: string; patched_sha256?: string; patches?: string[] };
type LockEntry = { name: string; repo: string; ref: string; license: string; files: LockFile[] };
type Lock = { schema: 1; patches: Record<string, Patch>; entries: LockEntry[] };

const root = resolve(import.meta.dir, "..");
const lockPath = join(root, "vendor", "lock.json");
const distDir = join(root, "dist");
const args = process.argv.slice(2);
const writeLock = args.includes("--write-lock");
if (args.some((a) => a !== "--write-lock")) {
  console.error("usage: bun tools/harden.ts [--write-lock]");
  process.exit(2);
}

const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const lock: Lock = JSON.parse(readFileSync(lockPath, "utf8"));
const failures: string[] = [];
const manifest: { out: string; sha256: string }[] = [];

function countOf(hay: string, needle: string): number {
  let n = 0;
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + needle.length)) n++;
  return n;
}

for (const entry of lock.entries) {
  for (const file of entry.files) {
    const label = `${entry.name}:${file.out}`;
    const res = await fetch(file.src, { redirect: "follow" });
    if (!res.ok) { failures.push(`${label}: HTTP ${res.status} from ${file.src}`); continue; }
    let bytes = new Uint8Array(await res.arrayBuffer());
    const got = sha256(bytes);
    if (got !== file.sha256) { failures.push(`${label}: upstream sha256 ${got} != lock ${file.sha256}`); continue; }

    if (file.patches?.length) {
      let text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      for (const pid of file.patches) {
        const p = lock.patches[pid];
        if (!p) { failures.push(`${label}: unknown patch ${pid}`); continue; }
        if ("prepend" in p) { text = p.prepend + text; continue; }
        const n = countOf(text, p.find);
        if (n !== p.count) { failures.push(`${label}: patch ${pid} matched ${n}x, expected ${p.count}x`); continue; }
        text = text.split(p.find).join(p.replace);
      }
      bytes = new TextEncoder().encode(text);
    }

    const patched = sha256(bytes);
    if (writeLock) file.patched_sha256 = patched;
    else if (patched !== file.patched_sha256) {
      failures.push(`${label}: patched sha256 ${patched} != lock ${file.patched_sha256 ?? "(none)"}`);
      continue;
    }
    const outPath = join(distDir, file.out);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, bytes);
    manifest.push({ out: file.out, sha256: patched });
  }
}

if (failures.length) {
  for (const f of failures) console.error(`FAIL ${f}`);
  process.exit(1);
}
manifest.sort((a, b) => a.out.localeCompare(b.out));
writeFileSync(join(distDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
if (writeLock) writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
for (const m of manifest) console.log(`${m.sha256}  ${m.out}`);
console.log(`OK ${manifest.length} files${writeLock ? " (lock updated, review the diff)" : ""}`);
