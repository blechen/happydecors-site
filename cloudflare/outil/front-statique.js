// Façade commune des sites statiques sur Cloudflare : reproduit ce que Netlify faisait
// autour des fichiers (adresses « propres », domaine principal, HSTS, en-têtes, 404).
//
// Le site déclare dans wrangler.jsonc :
//   "assets": { "directory": "…", "binding": "ASSETS", "run_worker_first": true,
//               "html_handling": "none", "not_found_handling": "none" }
// puis :
//   import { servirStatique } from "./front-statique.js";
//   export default { fetch: (req, env) => servirStatique(req, env, { …options }) };
//
// Options :
//   domainePrincipal : "doctorlove.fr" → www.doctorlove.fr redirige en 301 vers lui
//   entetes          : [{ motif: "/assets/decors/*", valeurs: { … } }] (« /* » = tout ; le dernier gagne)
//   liensPropres     : true → réécrit les liens « page.html » en « /page » dans le HTML servi,
//                      comme l'option « Pretty URLs » de Netlify
//   avant            : async (req, env) => Response|undefined, routes propres au site
//
// Résolution des adresses (comportement Netlify relevé le 07/10/2026) :
//   /page.html → 200 ; /page → page.html (200) ou, si dossier, 301 vers /page/ ;
//   /dossier/ → dossier/index.html ; …/index → 301 vers …/ ; inconnu → /404.html en 404.

const HSTS = "max-age=31536000";
// Types que Netlify sert toujours avec « ; charset=UTF-8 » (Cloudflare ne le précise pas)
export const TYPES_TEXTE = ["text/html", "text/javascript", "text/css", "application/javascript", "text/plain", "text/markdown"]; // valeur envoyée par Netlify sur les domaines personnalisés

const PAGE_404 = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Page introuvable</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;display:grid;place-items:center;min-height:90vh;margin:0;color:#333}</style>
</head><body><div><h1>Page introuvable</h1><p><a href="/">Retour à l'accueil</a></p></div></body></html>`;

function correspond(motif, chemin) {
  if (motif === "/*") return true;
  if (motif.endsWith("/*")) return chemin.startsWith(motif.slice(0, -1));
  return chemin === motif;
}

// Netlify répond avec une adresse relative (« Location: /show/ ») pour ses redirections internes
const redirectionRelative = (cible) => new Response(null, { status: 301, headers: { location: cible } });

async function fichier(env, url, chemin, req) {
  const cible = new URL(url);
  cible.pathname = chemin;
  // jamais le corps de la requête d'origine : il ne se lit qu'une fois (POST)
  const rep = await env.ASSETS.fetch(new Request(cible, { method: req.method === "HEAD" ? "HEAD" : "GET", headers: req.headers }));
  return rep.status === 404 ? null : rep;
}

export async function resoudre(req, env, options = {}) {
  const url = new URL(req.url);
  if (!["GET", "HEAD"].includes(req.method)) {
    return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET, HEAD" } });
  }
  const p = decodeURIComponent(url.pathname);
  if (p !== "/" && p.endsWith("/index")) {
    return redirectionRelative(url.pathname.slice(0, -"index".length) + url.search);
  }
  let rep = await fichier(env, url, p, req);
  if (rep) return rep;
  if (p.endsWith("/")) {
    rep = await fichier(env, url, p + "index.html", req);
  } else if (p.endsWith(".html")) {
    // /page.html absent mais /page/index.html présent → 301 vers /page/ (Netlify)
    const base = url.pathname.slice(0, -".html".length);
    if (await fichier(env, url, p.slice(0, -".html".length) + "/index.html", req)) {
      return redirectionRelative(base + "/" + url.search);
    }
  } else if (!/\.[a-z0-9]+$/i.test(p.split("/").pop())) {
    rep = await fichier(env, url, p + ".html", req);
    if (!rep && (await fichier(env, url, p + "/index.html", req))) {
      return redirectionRelative(url.pathname + "/" + url.search);
    }
  }
  if (rep) return rep;
  if (options.sans404) return new Response(null, { status: 404 });
  const page404 = await fichier(env, url, "/404.html", req);
  return new Response(page404 ? page404.body : PAGE_404, {
    status: 404,
    headers: { "content-type": "text/html; charset=UTF-8", "cache-control": "public, max-age=0, must-revalidate" },
  });
}

export function liensPropres(rep, url) {
  const propre = (valeur) => {
    if (!valeur || /^(#|mailto:|tel:|javascript:|data:)/i.test(valeur)) return null;
    let cible;
    try { cible = new URL(valeur, url); } catch { return null; }
    if (cible.origin !== url.origin || !cible.pathname.endsWith(".html")) return null;
    let chemin = cible.pathname.slice(0, -".html".length);
    if (chemin.endsWith("/index")) chemin = chemin.slice(0, -"index".length);
    return chemin + cible.search + cible.hash;
  };
  const reecrire = (attr) => ({
    element(el) {
      const nouveau = propre(el.getAttribute(attr));
      if (nouveau !== null) el.setAttribute(attr, nouveau);
    },
  });
  return new HTMLRewriter().on("a[href]", reecrire("href")).on("form[action]", reecrire("action")).transform(rep);
}

export async function servirStatique(req, env, options = {}) {
  const url = new URL(req.url);

  if (options.domainePrincipal && url.hostname === "www." + options.domainePrincipal) {
    url.hostname = options.domainePrincipal;
    return Response.redirect(url.toString(), 301);
  }

  let rep = options.avant ? await options.avant(req, env) : undefined;
  if (!rep) rep = await resoudre(req, env);
  if (rep.status >= 300 && rep.status < 400) return rep;
  rep = new Response(rep.body, rep);

  const type = rep.headers.get("content-type") || "";
  // Netlify précise toujours l'encodage ; Cloudflare non pour ces types (accents des pages et scripts)
  if (TYPES_TEXTE.includes(type)) {
    rep.headers.set("content-type", type + "; charset=UTF-8");
  }
  if (url.protocol === "https:") {
    rep.headers.set("strict-transport-security", HSTS);
  }
  for (const regle of options.entetes || []) {
    if (!correspond(regle.motif, url.pathname)) continue;
    for (const [k, v] of Object.entries(regle.valeurs)) rep.headers.set(k, v);
  }
  if (options.liensPropres && type.startsWith("text/html")) rep = liensPropres(rep, url);
  return rep;
}
