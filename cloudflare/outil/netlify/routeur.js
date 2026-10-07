// Fait tourner un site Netlify (fichiers + fonctions + edge + redirections + en-têtes + crons +
// fonctions d'arrière-plan) dans un Worker Cloudflare, sans toucher au code de l'appli.
// Le module « genere.mjs » (produit au build par generer.mjs) décrit le site : il est passé ici.
//
// Ordre de traitement d'une requête (celui de Netlify) :
//   edge functions → fonctions à chemin (config.path) → règles de redirection (dans l'ordre ;
//   les règles non forcées ne s'appliquent que s'il n'existe pas de fichier) → fichiers →
//   /.netlify/functions/<nom> → 404.html. Les en-têtes personnalisés s'appliquent aux fichiers.
import { resoudre, liensPropres, TYPES_TEXTE } from "../front-statique.js";
import { avecBase } from "./contexte-base.js";
import { stub as stubStockage } from "./blobs.js";
export { StockageBlobs } from "./stockage.js";

const encodeur = new TextEncoder();

/* ---------------- domaines ---------------- */

// Netlify renvoie www.<domaine principal> vers le domaine principal (les autres alias, eux,
// sont servis tels quels : www.chezmylene.fr répond 200 comme chezmylene.fr)
function redirectionWww(req, env) {
  const principal = env.DOMAINE_PRINCIPAL;
  if (!principal) return null;
  const url = new URL(req.url);
  if (url.hostname !== "www." + principal) return null;
  const cible = `https://${principal}${url.pathname}${url.search}`;
  return new Response(`Redirecting to ${cible}`, {
    status: ["GET", "HEAD"].includes(req.method) ? 301 : 308,
    headers: { location: cible, "content-type": "text/plain; charset=utf-8", "strict-transport-security": "max-age=31536000" },
  });
}

// Liaisons directes vers d'autres Workers : LIAISONS = {"doctorlove.fr": "LIAISON_DOCTORLOVE_FR"}
let liaisonsLues;
function liaisons(env) {
  if (liaisonsLues === undefined) {
    try { liaisonsLues = JSON.parse(env?.LIAISONS || "{}"); } catch { liaisonsLues = {}; }
  }
  return liaisonsLues;
}

/* ---------------- motifs Netlify ---------------- */

const sansSlashFinal = (p) => (p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p);

// « /api/* », « /a/:id/* », « /exact » → fonction (chemin) → { splat, params } | null
function compilerMotif(motif) {
  const morceaux = sansSlashFinal(motif).split("/");
  return (chemin) => {
    const parts = sansSlashFinal(chemin).split("/");
    const params = {};
    for (let i = 0; i < morceaux.length; i++) {
      const m = morceaux[i];
      if (m === "*") return { splat: parts.slice(i).join("/"), params };
      if (i >= parts.length) return null;
      if (m.startsWith(":")) { params[m.slice(1)] = parts[i]; continue; }
      if (m !== parts[i]) return null;
    }
    return parts.length === morceaux.length ? { splat: "", params } : null;
  };
}

// Motifs d'en-têtes Netlify : « * » n'importe où (« /icon-*.png », « /fonts/* »), « :nom » = un segment
const motifsCompiles = new Map();
function correspondEntete(motif, chemin) {
  let re = motifsCompiles.get(motif);
  if (!re) {
    const corps = sansSlashFinal(motif).split(/(\*|:[A-Za-z_]\w*)/).map((x) =>
      x === "*" ? ".*" : x.startsWith(":") ? "[^/]+" : x.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("");
    re = new RegExp(`^${corps}/?$`);
    motifsCompiles.set(motif, re);
  }
  return re.test(chemin);
}

/* ---------------- contexte Netlify des fonctions ---------------- */

function contexteNetlify(req, ctx, extra = {}) {
  const cf = req.cf || {};
  const ip = req.headers.get("cf-connecting-ip") || "";
  const cookiesAAjouter = [];
  const lus = Object.fromEntries((req.headers.get("cookie") || "").split(/;\s*/).filter(Boolean)
    .map((c) => { const i = c.indexOf("="); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; }));
  return {
    ip,
    requestId: req.headers.get("cf-ray") || crypto.randomUUID(),
    geo: {
      city: cf.city, country: { code: cf.country, name: cf.country },
      subdivision: { code: cf.regionCode, name: cf.region }, timezone: cf.timezone,
      latitude: cf.latitude ? Number(cf.latitude) : undefined, longitude: cf.longitude ? Number(cf.longitude) : undefined,
      postalCode: cf.postalCode,
    },
    cookies: {
      get: (n) => lus[n],
      set: (o, v) => { const c = typeof o === "string" ? { name: o, value: v } : o; cookiesAAjouter.push(c); },
      delete: (n) => cookiesAAjouter.push({ name: n, value: "", expires: new Date(0) }),
    },
    params: extra.params || {},
    site: { id: "cloudflare", name: extra.nomSite, url: extra.urlSite },
    deploy: { context: "production", id: "cloudflare", published: true },
    server: { region: cf.colo },
    account: {},
    waitUntil: (p) => ctx.waitUntil(p),
    json: (data, init) => Response.json(data, init),
    _cookies: cookiesAAjouter,
  };
}

function appliquerCookies(rep, contexte) {
  if (!contexte._cookies.length) return rep;
  rep = new Response(rep.body, rep);
  for (const c of contexte._cookies) {
    let s = `${c.name}=${encodeURIComponent(c.value ?? "")}; Path=${c.path || "/"}`;
    if (c.expires) s += `; Expires=${new Date(c.expires).toUTCString()}`;
    if (c.maxAge !== undefined) s += `; Max-Age=${c.maxAge}`;
    if (c.domain) s += `; Domain=${c.domain}`;
    if (c.httpOnly) s += "; HttpOnly";
    if (c.secure !== false) s += "; Secure";
    if (c.sameSite) s += `; SameSite=${c.sameSite}`;
    rep.headers.append("set-cookie", s);
  }
  return rep;
}

// Ajoute les en-têtes que Netlify fournissait aux fonctions
function entetesNetlify(req) {
  const h = new Headers(req.headers);
  // En ligne, l'IP vient toujours de Cloudflare (impossible à falsifier, comme chez Netlify).
  // Dans le simulateur local seulement, les tests peuvent imposer la leur (comme leur serveur de test).
  const imposee = globalThis.Netlify?.env?.get("ENV_LOCAL") === "1" && req.headers.get("x-nf-client-connection-ip");
  const ip = imposee || req.headers.get("cf-connecting-ip");
  if (ip) {
    h.set("x-nf-client-connection-ip", ip);
    if (!h.has("x-forwarded-for")) h.set("x-forwarded-for", ip);
  }
  if (req.cf?.country) h.set("x-country", req.cf.country);
  if (!h.has("x-nf-request-id")) h.set("x-nf-request-id", req.headers.get("cf-ray") || crypto.randomUUID());
  return h;
}
const requeteNetlify = (req) => new Request(req, { headers: entetesNetlify(req) });

/* ---------------- copie des données depuis Netlify (temporaire) ---------------- */
// Point d'entrée réservé à l'outil de migration (outils/copier_blobs.mjs), actif seulement si le
// secret MIGRATION_SECRET est posé sur le Worker ; retiré après la bascule.
async function egal(a, b) {
  const [ha, hb] = await Promise.all([a, b].map((x) => crypto.subtle.digest("SHA-256", encodeur.encode(x))));
  return crypto.subtle.timingSafeEqual(ha, hb);
}

async function migration(req, env) {
  if (!env.MIGRATION_SECRET || !(await egal(req.headers.get("x-migration-secret") || "", env.MIGRATION_SECRET))) {
    return new Response("Interdit", { status: 403 });
  }
  const url = new URL(req.url);
  const store = url.searchParams.get("store");
  if (!store) return new Response("store manquant", { status: 400 });
  if (req.method === "DELETE" && url.searchParams.has("ancien")) {
    // effacement des toutes premières copies d'essai, créées hors juridiction UE
    await env.BLOBS.get(env.BLOBS.idFromName(store)).effacerTout();
    return Response.json({ efface: store });
  }
  const stub = stubStockage(store, env);
  if (req.method === "GET" && url.searchParams.has("diagnostic")) {
    const mesures = [];
    for (let i = 0; i < 5; i++) { const t = Date.now(); await stub.metadonnees("__diagnostic__"); mesures.push(Date.now() - t); }
    return Response.json({ workerColo: req.cf?.colo, objet: await stub.diagnostic(), allerRetourMs: mesures });
  }
  if (req.method === "GET" && url.searchParams.has("contenu")) {
    // export complet (retour arrière vers Netlify) : valeurs en base64 + métadonnées
    const tout = [];
    let apres = "";
    for (;;) {
      const page = await stub.lister("", apres, 1000);
      const valeurs = await stub.lirePlusieurs(page.map((l) => l.cle));
      page.forEach((l, i) => {
        const v = valeurs[i];
        if (!v) return;
        let bin = "";
        const u8 = new Uint8Array(v.octets);
        for (let j = 0; j < u8.length; j += 0x8000) bin += String.fromCharCode(...u8.subarray(j, j + 0x8000));
        tout.push({ cle: l.cle, base64: btoa(bin), metadata: Object.keys(v.meta || {}).length ? v.meta : undefined });
      });
      if (page.length < 1000) break;
      apres = page[page.length - 1].cle;
    }
    return Response.json({ store, blobs: tout });
  }
  if (req.method === "GET") {
    const tout = [];
    let apres = "";
    for (;;) {
      const page = await stub.lister(url.searchParams.get("prefixe") || "", apres, 1000);
      tout.push(...page.map((l) => ({ cle: l.cle, etag: l.etag, etagSource: l.etag_source })));
      if (page.length < 1000) break;
      apres = page[page.length - 1].cle;
    }
    return Response.json({ store, blobs: tout, ...(await stub.compter()) });
  }
  if (req.method === "PUT") {
    const lot = await req.json(); // [{ cle, base64, metadata, etagSource }]
    for (const b of lot) {
      const octets = Uint8Array.from(atob(b.base64), (c) => c.charCodeAt(0)).buffer;
      await stub.ecrire(b.cle, octets, { metadata: b.metadata, etagSource: b.etagSource });
    }
    return Response.json({ ecrits: lot.length });
  }
  if (req.method === "DELETE") {
    const cles = await req.json();
    for (const c of cles) await stub.supprimer(c);
    return Response.json({ supprimes: cles.length });
  }
  return new Response("Méthode non prise en charge", { status: 405 });
}

/* ---------------- formulaires Netlify (Netlify Forms) ---------------- */
// Un POST de formulaire déclaré dans le HTML (data-netlify="true") est intercepté quelle que soit
// l'adresse, comme chez Netlify : pot de miel respecté, envoi archivé (store « netlify-forms »),
// notification par e-mail si le binding EMAIL et FORMULAIRE_DESTINATAIRE sont configurés.
async function formulaire(req, env, site, servirFichier) {
  const type = req.headers.get("content-type") || "";
  if (req.method !== "POST" || !(type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data"))) return null;
  let donnees;
  try { donnees = await req.clone().formData(); } catch { return null; }
  const nom = donnees.get("form-name");
  const decl = nom && site.formulaires?.[nom];
  if (!decl) return null;
  const url = new URL(req.url);
  const merci = async () => {
    // Netlify affiche la page visée par le formulaire (ou un remerciement générique) avec un 200
    const page = await servirFichier(new Request(url, { method: "GET", headers: req.headers }), env, decodeURIComponent(url.pathname));
    if (page.status === 200 && url.pathname !== "/") return page;
    if (url.pathname === "/") return new Response("<!doctype html><meta charset=utf-8><title>Merci</title><p>Merci, votre message a bien été envoyé.</p>", { status: 200, headers: { "content-type": "text/html; charset=UTF-8" } });
    return page;
  };
  if (decl.pot && donnees.get(decl.pot)) return merci(); // robot : ignoré en silence

  const champs = {};
  for (const [k, v] of donnees.entries()) {
    if (k === "form-name" || k === decl.pot) continue;
    champs[k] = typeof v === "string" ? v.slice(0, 10000) : `[fichier ${v.name}]`;
  }
  const fiche = { formulaire: nom, recu: new Date().toISOString(), page: url.pathname, ip: req.headers.get("cf-connecting-ip") || "", champs };
  await stubStockage("netlify-forms", env).ecrire(`${nom}/${fiche.recu}-${crypto.randomUUID().slice(0, 8)}`,
    encodeur.encode(JSON.stringify(fiche)).buffer, {});

  if (env.EMAIL && env.FORMULAIRE_DESTINATAIRE) {
    const hote = new URL(env.URL || req.url).hostname.replace(/^www\./, "");
    const texte = Object.entries(champs).map(([k, v]) => `${k} : ${v || "—"}`).join("\n\n");
    const email = Object.entries(champs).find(([k, v]) => /mail/i.test(k) && /@/.test(v))?.[1];
    const nomVisiteur = champs.nom || champs.name || champs.prenom || "";
    try {
      await env.EMAIL.send({
        from: { email: `formulaire@${hote}`, name: `Site ${hote}` },
        to: env.FORMULAIRE_DESTINATAIRE,
        replyTo: email || undefined,
        subject: `Nouveau message (${nom})${nomVisiteur ? " : " + nomVisiteur : ""}`,
        text: `Formulaire « ${nom} » envoyé depuis ${hote}${url.pathname}\n\n${texte}\n`,
      });
    } catch (e) {
      console.error("formulaire : e-mail non envoyé", e?.code, e?.message);
      return new Response("Envoi impossible", { status: 502 }); // la page affiche alors son message d'erreur
    }
  }
  return merci();
}

/* ---------------- le Worker ---------------- */

export function creerWorker(site) {
  const fonctions = new Map(site.fonctions.map((f) => [f.nom, f]));
  const fonctionsAChemin = site.fonctions.filter((f) => f.chemins.length && !f.planifiee)
    .flatMap((f) => f.chemins.map((c) => ({ f, test: compilerMotif(c) })));
  const exclusions = (f) => (f.exclus || []).map(compilerMotif);
  const edges = site.edges.map((e) => ({ ...e, tests: e.chemins.map(compilerMotif), sauf: exclusions(e) }));
  const regles = site.redirections.map((r) => ({ ...r, test: compilerMotif(r.from) }));

  let envCourant = null;

  // Appel d'une fonction Netlify v2 (ou v1) avec son contexte
  async function appeler(f, req, ctx, params) {
    const contexte = contexteNetlify(req, ctx, { params, nomSite: site.nom, urlSite: envCourant?.URL });
    const mod = f.module;
    let rep;
    if (typeof mod.default === "function") {
      rep = await mod.default(requeteNetlify(req), contexte);
    } else if (typeof mod.handler === "function") {
      rep = await appelerV1(mod.handler, req, contexte);
    } else {
      return new Response(`Function ${f.nom} has no handler`, { status: 500 });
    }
    if (!(rep instanceof Response)) rep = new Response(rep == null ? "" : String(rep));
    // Netlify ajoute « nosniff » à toutes les réponses de fonctions
    if (!rep.headers.has("x-content-type-options")) {
      rep = new Response(rep.body, rep);
      rep.headers.set("x-content-type-options", "nosniff");
    }
    return appliquerCookies(rep, contexte);
  }

  async function appelerV1(handler, req, contexte) {
    const url = new URL(req.url);
    const corps = ["GET", "HEAD"].includes(req.method) ? null : await req.text();
    const r = await handler({
      httpMethod: req.method, path: url.pathname, rawUrl: req.url, rawQuery: url.search.slice(1),
      queryStringParameters: Object.fromEntries(url.searchParams), headers: Object.fromEntries(requeteNetlify(req).headers),
      body: corps, isBase64Encoded: false,
    }, contexte);
    return new Response(r?.isBase64Encoded ? Uint8Array.from(atob(r.body), (c) => c.charCodeAt(0)) : r?.body ?? "",
      { status: r?.statusCode || 200, headers: r?.headers || {} });
  }

  // Fonction d'arrière-plan : mise en file (réponse 202 immédiate, comme Netlify)
  async function mettreEnFile(f, req, env) {
    if (!env.FILE_ARRIERE_PLAN) return new Response("File d'attente non configurée", { status: 500 });
    const entetes = [...entetesNetlify(req)];
    const corps = ["GET", "HEAD"].includes(req.method) ? "" : await req.text();
    const message = { fonction: f.nom, url: req.url, methode: req.method, entetes, corps };
    if (encodeur.encode(JSON.stringify(message)).byteLength > 120_000) {
      return new Response("Corps trop volumineux pour la file", { status: 413 });
    }
    await env.FILE_ARRIERE_PLAN.send(message);
    return new Response(null, { status: 202 });
  }

  async function invoquer(f, req, env, ctx, params) {
    if (f.arrierePlan) return mettreEnFile(f, req, env);
    return appeler(f, req, ctx, params);
  }

  // « Un fichier serait servi à cette adresse » (règle d'ombrage de Netlify), adresses propres comprises
  async function fichierExiste(env, req) {
    if (!["GET", "HEAD"].includes(req.method)) return false;
    const r = await resoudre(new Request(req.url, { method: "HEAD" }), env, { sans404: true });
    return r.status !== 404;
  }

  function enTetesFichiers(rep, chemin) {
    const valeurs = {};
    for (const regle of site.entetes) {
      if (correspondEntete(regle.for, chemin)) Object.assign(valeurs, regle.values);
    }
    if (!Object.keys(valeurs).length) return rep;
    rep = new Response(rep.body, rep);
    for (const [k, v] of Object.entries(valeurs)) rep.headers.set(k, v);
    return rep;
  }

  async function servirFichier(req, env, chemin, statutForce) {
    const cible = new URL(req.url);
    cible.pathname = chemin;
    let rep = await resoudre(new Request(cible, req), env);
    if (rep.status >= 300 && rep.status < 400) return rep;
    if (statutForce && rep.status === 200) rep = new Response(rep.body, { status: statutForce, headers: rep.headers });
    rep = enTetesFichiers(rep, chemin);
    const type = rep.headers.get("content-type") || "";
    if (TYPES_TEXTE.includes(type)) {
      rep = new Response(rep.body, rep);
      rep.headers.set("content-type", type + "; charset=UTF-8");
    }
    // Option « Pretty URLs » de Netlify (active sur tous les sites) : liens « page.html » → « /page »
    if (type.startsWith("text/html")) rep = liensPropres(rep, new URL(req.url));
    return rep;
  }

  // Tout ce qui suit les edge functions
  async function suite(req, env, ctx) {
    const url = new URL(req.url);
    const chemin = decodeURIComponent(url.pathname);

    // 0. Formulaires Netlify
    const envoi = await formulaire(req, env, site, servirFichier);
    if (envoi) return envoi;

    // 1. Fonctions déclarant leur chemin (config.path)
    for (const { f, test } of fonctionsAChemin) {
      const m = test(chemin);
      if (!m || exclusions(f).some((t) => t(chemin))) continue;
      if (f.methodes && !f.methodes.includes(req.method)) continue;
      if (f.preferStatic && (await fichierExiste(env, req))) break;
      return invoquer(f, req, env, ctx, m.params);
    }

    // 2. Appel direct /.netlify/functions/<nom>
    const direct = chemin.match(/^\/\.netlify\/functions\/([^/]+)/);
    if (direct && fonctions.has(direct[1]) && !fonctions.get(direct[1]).planifiee) {
      return invoquer(fonctions.get(direct[1]), req, env, ctx, {});
    }

    // 3. Règles de redirection / réécriture
    for (const r of regles) {
      const m = r.test(chemin);
      if (!m) continue;
      if (!r.force && (await fichierExiste(env, req))) break;
      let cible = r.to.replace(/:splat/g, m.splat);
      for (const [k, v] of Object.entries(m.params)) cible = cible.replaceAll(":" + k, v);
      const statut = r.status || 301;
      if (statut === 200 || statut === 404) {
        if (/^https?:\/\//.test(cible)) {
          return fetch(new Request(cible + url.search, req)); // proxy externe
        }
        const cibleUrl = new URL(cible, url);
        const interne = new Request(cibleUrl.toString() + (cibleUrl.search ? "" : url.search), req);
        const nomFonction = cibleUrl.pathname.match(/^\/\.netlify\/functions\/([^/]+)/);
        if (nomFonction && fonctions.has(nomFonction[1])) {
          // la fonction voit l'adresse d'origine, comme chez Netlify
          return invoquer(fonctions.get(nomFonction[1]), req, env, ctx, {});
        }
        return servirFichier(interne, env, decodeURIComponent(cibleUrl.pathname), statut === 404 ? 404 : undefined);
      }
      const dest = cible; // relative ou absolue, telle qu'écrite dans la règle (comme Netlify)
      // Netlify : petit texte « Redirecting to … » et en-têtes personnalisés du chemin, comme pour un fichier
      return enTetesFichiers(new Response(req.method === "HEAD" ? null : `Redirecting to ${dest}`, { status: statut, headers: {
        location: dest, "cache-control": "public, max-age=0, must-revalidate", "content-type": "text/plain; charset=utf-8" } }), chemin);
    }

    // 4. Fichiers (puis 404.html)
    return servirFichier(req, env, chemin);
  }

  async function traiter(req, env, ctx) {
    const chemin = decodeURIComponent(new URL(req.url).pathname);
    if (chemin === "/__migration/blobs") return migration(req, env);
    const actives = edges.filter((e) => e.tests.some((t) => t(chemin)) && !e.sauf.some((t) => t(chemin)));
    const chaine = async (i, requete) => {
      if (i >= actives.length) return suite(requete, env, ctx);
      const e = actives[i];
      const contexte = contexteNetlify(requete, ctx, { nomSite: site.nom, urlSite: env.URL });
      contexte.next = (r) => chaine(i + 1, r instanceof Request ? r : requete);
      const rep = await e.module.default(requeteNetlify(requete.clone()), contexte);
      return appliquerCookies(rep ?? (await chaine(i + 1, requete)), contexte);
    };
    return chaine(0, req);
  }

  // Les fonctions qui appellent leur propre site (process.env.URL + "/.netlify/functions/…")
  // sont aiguillées directement, sans repasser par Internet.
  function installerFetchInterne(env, ctx) {
    if (globalThis.__fetchNetlifyInstalle) return;
    globalThis.__fetchNetlifyInstalle = true;
    const fetchOrigine = globalThis.fetch;
    globalThis.fetch = async (entree, init) => {
      const req = new Request(entree, init);
      const u = new URL(req.url);
      const hotes = [env.URL, env.DEPLOY_PRIME_URL].filter(Boolean).map((x) => new URL(x).host);
      if (hotes.includes(u.host) && u.pathname.startsWith("/.netlify/functions/")) {
        const [, nom] = u.pathname.match(/^\/\.netlify\/functions\/([^/]+)/) || [];
        const f = fonctions.get(nom);
        if (f) return invoquer(f, req, envCourant, { waitUntil: () => {} }, {});
      }
      // Autre site du même domaine servi par un Worker sur route (ex. le Dash qui lit
      // doctorlove.fr/agenda.json) : Cloudflare enverrait l'appel à l'ancien hébergeur, pas au
      // Worker. On passe donc par la liaison directe (service binding) déclarée dans site.json.
      const liaison = liaisons(envCourant)[u.host];
      if (liaison && envCourant[liaison]) return envCourant[liaison].fetch(req);
      return fetchOrigine(req);
    };
  }

  function preparer(env) {
    envCourant = env;
    // Edge functions Netlify : Deno.env.get ; fonctions : Netlify.env.get (process.env est rempli par nodejs_compat)
    globalThis.Deno ??= { env: { get: (k) => envCourant?.[k], toObject: () => ({ ...envCourant }) } };
    globalThis.Netlify ??= { env: { get: (k) => envCourant?.[k], has: (k) => envCourant?.[k] !== undefined, toObject: () => ({ ...envCourant }) } };
  }

  return {
    async fetch(req, env, ctx) {
      // www.<domaine principal> → domaine principal, comme Netlify (301, ou 308 hors GET/HEAD)
      const redirWww = redirectionWww(req, env);
      if (redirWww) return redirWww;
      // Retour arrière : tout ce qui arrive encore ici (DNS en cache) est transmis à Netlify, tel quel,
      // pour qu'une seule copie des données reçoive les écritures (secret RELAIS_NETLIFY = adresse *.netlify.app)
      if (env.RELAIS_NETLIFY) {
        const u = new URL(req.url);
        return fetch(new Request(new URL(u.pathname + u.search, env.RELAIS_NETLIFY), {
          method: req.method, headers: req.headers, redirect: "manual",
          body: ["GET", "HEAD"].includes(req.method) ? undefined : req.body,
        }));
      }
      // Bascule : pendant la copie finale des données, les écritures attendent (2-3 min)
      if (env.MAINTENANCE === "1" && !["GET", "HEAD", "OPTIONS"].includes(req.method)
        && new URL(req.url).pathname !== "/__migration/blobs") {
        return Response.json({ error: "Maintenance en cours, réessayez dans 2 minutes." },
          { status: 503, headers: { "retry-after": "120", "cache-control": "no-store" } });
      }
      preparer(env);
      installerFetchInterne(env, ctx);
      const [rep, fermeture] = await avecBase(() => traiter(req, env, ctx));
      ctx.waitUntil(fermeture);
      // HSTS partout en HTTPS, comme Netlify (inoffensif sur l'adresse d'essai, déjà HTTPS seul)
      if (rep.status !== 101 && new URL(req.url).protocol === "https:" && !rep.headers.has("strict-transport-security")) {
        const r = new Response(rep.body, rep);
        r.headers.set("strict-transport-security", "max-age=31536000");
        return r;
      }
      return rep;
    },

    async scheduled(evenement, env, ctx) {
      // Interrupteur de la bascule : sans CRONS_ACTIFS=1 (copie d'essai, ou avant la bascule),
      // aucune tâche planifiée ne tourne. Allumer : wrangler secret put ; éteindre : secret delete.
      if (env.CRONS_ACTIFS !== "1") {
        console.log(`cron ${evenement.cron} ignoré : CRONS_ACTIFS absent`);
        return;
      }
      preparer(env);
      installerFetchInterne(env, ctx);
      const noms = site.crons[evenement.cron] || [];
      for (const nom of noms) {
        const f = fonctions.get(nom);
        const req = new Request(`${env.URL || "https://localhost"}/.netlify/functions/${nom}`, {
          method: "POST", headers: { "content-type": "application/json", "user-agent": "Netlify Clockwork" },
          body: JSON.stringify({ next_run: new Date(evenement.scheduledTime + 60_000).toISOString() }),
        });
        try {
          const [, fermeture] = await avecBase(() => appeler(f, req, ctx, {}));
          ctx.waitUntil(fermeture);
          console.log(`cron ${evenement.cron} → ${nom} : terminé`);
        } catch (e) {
          console.error(`cron ${evenement.cron} → ${nom} : échec`, e?.stack || e);
        }
      }
    },

    async queue(lot, env, ctx) {
      preparer(env);
      installerFetchInterne(env, ctx);
      for (const msg of lot.messages) {
        const m = msg.body;
        const f = fonctions.get(m.fonction);
        if (!f) { msg.ack(); continue; }
        const req = new Request(m.url, { method: m.methode, headers: m.entetes,
          body: ["GET", "HEAD"].includes(m.methode) ? undefined : m.corps });
        try {
          const [rep, fermeture] = await avecBase(() => appeler(f, req, ctx, {}));
          ctx.waitUntil(fermeture);
          console.log(`arrière-plan ${m.fonction} : ${rep.status}`);
          msg.ack();
        } catch (e) {
          console.error(`arrière-plan ${m.fonction} : échec`, e?.stack || e);
          msg.retry();
        }
      }
    },
  };
}
