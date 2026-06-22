/**
 * Service worker do FazTudo (PWA). Estratégia conservadora:
 * - cacheia só o "shell" (/) para fallback offline em navegações;
 * - tudo o mais vai direto à rede (sem cache agressivo → sem versão velha presa).
 * Existir um handler de `fetch` também é o que habilita o "instalar app".
 */
const CACHE = "faztudo-shell-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.add("/")));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  // Navegações: tenta a rede; se estiver offline, devolve o shell em cache.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/")));
  }
});
