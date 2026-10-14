// Mobile router for Home Assistant (Sanmarcsoft).
//
// Sends phones to a mobile dashboard when they first open Home Assistant, and leaves desktops
// on whatever dashboard they already land on. It acts once per page load, only in the first
// few seconds, and only when the browser landed on one of the "from" paths, so navigating to
// any other dashboard on a phone afterwards still works.
//
//   /local/vendor/mobile-router.js?v=<sha>&to=dashboard-mobile
//   optional: &from=lovelace,home   landing paths to redirect from (default: lovelace)
//             &max=768              widest viewport, in CSS px, treated as a phone
//
// Opt out on one device: localStorage.setItem("mobile-router:off", "1")

const params = new URL(import.meta.url).searchParams;
const to = (params.get("to") || "").replace(/^\/+|\/+$/g, "");
const from = (params.get("from") || "lovelace")
  .split(",")
  .map((p) => "/" + p.trim().replace(/^\/+|\/+$/g, ""))
  .filter((p) => p.length > 1);
const max = Number(params.get("max")) || 768;

function isPhone() {
  if (navigator.userAgentData && typeof navigator.userAgentData.mobile === "boolean" && navigator.userAgentData.mobile) return true;
  if (/iPhone|iPod|Android.+Mobile|Mobi/i.test(navigator.userAgent)) return true;
  return Math.min(window.screen.width, window.innerWidth) <= max;
}

function onLandingPath() {
  const p = location.pathname.replace(/\/+$/, "") || "/";
  return p === "/" || from.some((f) => p === f || p.startsWith(f + "/"));
}

function route() {
  if (window.__mobileRouterDone || !to) return;
  if (performance.now() > 8000) { window.__mobileRouterDone = true; return; }
  if (localStorage.getItem("mobile-router:off") === "1" || !isPhone()) { window.__mobileRouterDone = true; return; }
  if (location.pathname.startsWith("/" + to)) { window.__mobileRouterDone = true; return; }
  if (!onLandingPath()) return; // HA has not settled on its landing page yet; try again shortly
  window.__mobileRouterDone = true;
  history.replaceState(null, "", "/" + to);
  window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: true } }));
}

route();
for (const ms of [250, 1000, 2500, 5000]) setTimeout(route, ms);
