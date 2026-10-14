// Egress guard for Home Assistant dashboards (Sanmarcsoft hardening).
//
// Blocks cross-origin fetch, XMLHttpRequest, WebSocket, EventSource and sendBeacon calls made
// by custom cards while a guarded dashboard is on screen. Register it as the FIRST lovelace
// resource (type: module) so it wraps the network APIs before any card loads.
//
//   /local/vendor/egress-guard.js?v=<sha>                     guard every page
//   /local/vendor/egress-guard.js?v=<sha>&paths=dashboard-mobile  guard only /dashboard-mobile/*
//
// It does not touch <img>, <iframe> or CSS url() loads; the hardened bundles and YAML remove
// those at the source.

const params = new URL(import.meta.url).searchParams;
const guarded = (params.get("paths") || "")
  .split(",")
  .map((p) => p.trim().replace(/^\/?/, "/").replace(/\/$/, ""))
  .filter((p) => p.length > 1);

const active = () =>
  guarded.length === 0 || guarded.some((p) => location.pathname === p || location.pathname.startsWith(p + "/"));

const warned = new Set();
function crossOrigin(target) {
  let url;
  try {
    url = new URL(String(target instanceof Request ? target.url : target), location.href);
  } catch {
    return false; // malformed URLs fail in the real API anyway
  }
  if (url.protocol === "data:" || url.protocol === "blob:") return false;
  if (url.host === location.host) return false;
  if (!active()) return false;
  if (!warned.has(url.host)) {
    warned.add(url.host);
    console.warn(`[egress-guard] blocked request to ${url.host}`);
  }
  return true;
}
const blocked = (what) => new Error(`[egress-guard] cross-origin ${what} blocked`);

if (!window.__egressGuard) {
  window.__egressGuard = { guarded };

  const realFetch = window.fetch;
  window.fetch = function (input, init) {
    return crossOrigin(input) ? Promise.reject(blocked("fetch")) : realFetch.call(this, input, init);
  };

  const realOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    if (crossOrigin(url)) throw blocked("XMLHttpRequest");
    return realOpen.call(this, method, url, ...rest);
  };

  const RealWebSocket = window.WebSocket;
  window.WebSocket = class extends RealWebSocket {
    constructor(url, protocols) {
      if (crossOrigin(url)) throw blocked("WebSocket");
      super(url, protocols);
    }
  };

  if (window.EventSource) {
    const RealEventSource = window.EventSource;
    window.EventSource = class extends RealEventSource {
      constructor(url, config) {
        if (crossOrigin(url)) throw blocked("EventSource");
        super(url, config);
      }
    };
  }

  if (navigator.sendBeacon) {
    const realBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url, data) => (crossOrigin(url) ? false : realBeacon(url, data));
  }
}
