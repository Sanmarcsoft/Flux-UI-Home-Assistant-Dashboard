# Security

This fork of [Flux UI](https://github.com/ElementZoom/Flux-UI-Home-Assistant-Dashboard) is hardened
for a Home Assistant that should not talk to third parties from its dashboards. The dashboard YAML
itself is inert; the risk lives in the custom cards it depends on, because every card runs as
JavaScript inside Home Assistant with the logged-in user's full rights.

## What the hardening does

1. **Pins every card.** `vendor/lock.json` names each card's repository, tag, upstream file URL and
   the sha256 of the exact bytes that were reviewed.
2. **Patches what phones home.** `tools/harden.ts` downloads each pinned file, refuses to continue
   if its hash differs from the lock, applies string patches that must each match an exact number of
   times, and refuses again if the patched hash differs from the lock. Output goes to `dist/`.
3. **Guards egress at runtime.** `www/vendor/egress-guard.js` blocks cross-origin `fetch`,
   `XMLHttpRequest`, `WebSocket`, `EventSource` and `sendBeacon` from cards on the dashboards it guards.
4. **Strips third-party calls from the YAML.** The Windy radar iframes, the MetService links, the
   jsDelivr-hosted moon background and the `osm_api_key: email` (which sends an email address to
   OpenStreetMap) are removed.

| Card | Tag | Patch |
|---|---|---|
| Bubble Card | v3.4.1 | Module Store download from the GitHub API disabled (it fetches community code with JS templates); Google Translate calls disabled; translations served from `/local/vendor/bubble-card/` instead of `/hacsfiles/`; remote editor GIF, badge and avatar images removed |
| custom-card-features | 4.11.2 | `eval` action removed (`eval(action.eval)` ran arbitrary JavaScript from card config) |
| streamline-card | v0.2.2 | template `fetch` restricted to the Home Assistant origin |
| material-you-utilities | 2.1.26 | background-image `fetch` restricted to the Home Assistant origin |
| Frosted Glass Theme Manager | v1.4 | default backgrounds served from `/local/vendor/frosted-glass/` instead of jsDelivr; backgrounds pinned to a commit, not `main` |
| button-card v7.0.1, card-mod v4.2.1, mushroom v5.2.3, navbar-card v1.7.1, simple-swipe-card v3.1.0, simple-tabs v1.5.0, paper-buttons-row v2.3.1, expander-card 0.1.5, vertical-stack-in-card v1.1.4 | pinned | none needed |

## Accepted risks

- JavaScript templates (`[[[ ]]]`, built with `new Function`) in button-card, navbar-card,
  streamline-card and simple-swipe-card. They are a feature and run only code from dashboard
  config, so the trust boundary is who may edit dashboards: keep that to administrators.
- `localStorage` use in card-mod, simple-tabs, paper-buttons-row and expander-card stores UI state only.
- Cards in `custom-cards.md` that are not in `vendor/lock.json` are not reviewed. Leave them out, or
  add them to the lock with a review first.

## Build and install

```bash
bun tools/harden.ts            # builds dist/ and verifies every hash; exit 1 on any mismatch
```

Copy `dist/*` and `www/vendor/*.js` to `/config/www/vendor/` in Home Assistant, then register each
`.js` as a dashboard resource (type `module`) with `?v=<sha256>` so browsers drop stale copies. Register
`egress-guard.js` first. Copy `dist/custom_components/frosted_glass_manager` to
`/config/custom_components/` and restart Home Assistant once.

To show a mobile dashboard on phones while desktops keep their current dashboard, register
`www/vendor/mobile-router.js?to=<mobile-dashboard-path>` as a resource as well.

## Updating a card

Change its tag and `src` in `vendor/lock.json`, review the new upstream file, put its sha256 in the
lock, run `bun tools/harden.ts --write-lock`, and read the lock diff before committing. A patch that no
longer matches makes the build fail; that is the signal to re-review the card.

## Reporting a problem

Use GitHub's private vulnerability reporting on this repository (Security tab, "Report a vulnerability")
rather than a public issue.
