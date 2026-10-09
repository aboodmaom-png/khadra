// Service worker للوحة التحكم: بيخليها تنزل كتطبيق وتفتح حتى لو النت ضعيف.
// الاستراتيجية: من النت أول (عشان التحديثات توصل فوراً)، وإذا ما في نت من النسخة المحفوظة.
const CACHE = "khadra-admin-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const sdk = url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/");
  const fonts = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!sameOrigin && !sdk && !fonts) return;   // Firestore و Cloudinary بيروحوا عالنت مباشرة
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    } catch {
      const hit = await caches.match(req);
      if (hit) return hit;
      throw new Error("offline");
    }
  })());
});
