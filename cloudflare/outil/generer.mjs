#!/usr/bin/env node
// Prépare un dépôt Netlify pour Cloudflare, sans modifier son code :
//   lit netlify.toml, _redirects, _headers, netlify/functions, netlify/edge-functions,
//   puis écrit dans le dossier de build :
//     cloudflare/genere.mjs        description du site (fonctions, routes, crons, règles)
//     cloudflare/worker.mjs        point d'entrée du Worker
//     cloudflare/adaptateur/…      copie de l'adaptateur (stockage, base, routeur)
//     wrangler.jsonc               configuration Cloudflare (bindings, crons, alias)
//     <publication>/.assetsignore  fichiers à ne pas publier
//
// Usage : node generer.mjs <dossier_build> <config_site.json>
// Le dossier de build contient déjà une copie du dépôt (git archive) et son node_modules.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { parse as lireToml } from "./toml.mjs";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const [build, fichierConfig] = process.argv.slice(2);
if (!build || !fichierConfig) {
  console.error("Usage : node generer.mjs <dossier_build> <config_site.json>");
  process.exit(2);
}
const config = JSON.parse(fs.readFileSync(fichierConfig, "utf8"));
const lire = (p) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null);

const toml = lireToml(lire(path.join(build, "netlify.toml")) || "");
const publication = toml.build?.publish || ".";
const dossierFonctions = toml.functions?.directory || toml.build?.functions || "netlify/functions";
const dossierEdge = toml.build?.edge_functions || "netlify/edge-functions";

/* ---------- lecture de « export const config = { … } » ---------- */
function extraireConfig(source, fichier) {
  const i = source.search(/export\s+const\s+config\s*(:\s*\w+\s*)?=\s*\{/);
  if (i === -1) return {};
  let j = source.indexOf("{", i), prof = 0, k = j;
  for (; k < source.length; k++) {
    if (source[k] === "{") prof++;
    else if (source[k] === "}" && --prof === 0) break;
  }
  const texte = source.slice(j, k + 1);
  try {
    return new Function(`return (${texte});`)();
  } catch (e) {
    throw new Error(`config illisible dans ${fichier} : ${e.message}\n${texte}`);
  }
}

const NORMES = { "@yearly": "0 0 1 1 *", "@annually": "0 0 1 1 *", "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0", "@daily": "0 0 * * *", "@hourly": "0 * * * *" };
const normaliserCron = (c) => NORMES[c.trim()] || c.trim().replace(/\s+/g, " ");
const enListe = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

/* ---------- fonctions ---------- */
const fonctions = [];
const dirF = path.join(build, dossierFonctions);
for (const nomFichier of fs.existsSync(dirF) ? fs.readdirSync(dirF).sort() : []) {
  const complet = path.join(dirF, nomFichier);
  let fichier = complet;
  if (fs.statSync(complet).isDirectory()) {
    const index = ["index.mjs", "index.js", `${nomFichier}.mjs`, `${nomFichier}.js`].map((f) => path.join(complet, f)).find(fs.existsSync);
    if (!index) continue;
    fichier = index;
  } else if (!/\.(mjs|js|cjs|ts|mts)$/.test(nomFichier)) continue;
  const source = fs.readFileSync(fichier, "utf8");
  const aUnGestionnaire = /export\s+default\b/.test(source) || /exports\.handler\s*=|export\s+(const|let|var|async\s+function|function)\s+handler\b/.test(source);
  if (!aUnGestionnaire) continue; // utilitaire rangé dans le dossier des fonctions
  const nom = path.basename(nomFichier).replace(/\.(mjs|js|cjs|ts|mts)$/, "");
  const cfg = extraireConfig(source, fichier);
  const reglageToml = toml.functions?.[nom] || {};
  const schedule = cfg.schedule || reglageToml.schedule;
  fonctions.push({
    nom,
    fichier: path.relative(path.join(build, "cloudflare"), fichier),
    chemins: enListe(cfg.path),
    exclus: enListe(cfg.excludedPath),
    methodes: cfg.method ? enListe(cfg.method).map((m) => m.toUpperCase()) : null,
    preferStatic: !!cfg.preferStatic,
    planifiee: schedule ? normaliserCron(schedule) : null,
    arrierePlan: nom.endsWith("-background"),
  });
}

/* ---------- edge functions ---------- */
const edges = [];
const dirE = path.join(build, dossierEdge);
const declarationsEdge = enListe(toml.edge_functions);
for (const nomFichier of fs.existsSync(dirE) ? fs.readdirSync(dirE).sort() : []) {
  if (!/\.(mjs|js|ts)$/.test(nomFichier)) continue;
  const fichier = path.join(dirE, nomFichier);
  const source = fs.readFileSync(fichier, "utf8");
  if (!/export\s+default\b/.test(source)) continue;
  const nom = nomFichier.replace(/\.(mjs|js|ts)$/, "");
  const cfg = extraireConfig(source, fichier);
  const chemins = [...enListe(cfg.path), ...declarationsEdge.filter((d) => d.function === nom).map((d) => d.path)];
  if (!chemins.length) continue;
  edges.push({ nom, fichier: path.relative(path.join(build, "cloudflare"), fichier), chemins, exclus: enListe(cfg.excludedPath) });
}

/* ---------- redirections : _redirects d'abord, puis netlify.toml (ordre Netlify) ---------- */
const redirections = [];
const fichierRedirects = lire(path.join(build, publication, "_redirects"));
for (const ligne of (fichierRedirects || "").split("\n")) {
  const l = ligne.replace(/#.*$/, "").trim();
  if (!l) continue;
  const parts = l.split(/\s+/);
  const [from, to] = parts;
  let status = 301, force = false;
  for (const p of parts.slice(2)) {
    const m = p.match(/^(\d{3})(!?)$/);
    if (m) { status = Number(m[1]); force = m[2] === "!"; }
    else if (!p.includes("=")) throw new Error(`_redirects : option non prise en charge « ${p} » dans « ${l} »`);
    else throw new Error(`_redirects : condition non prise en charge « ${p} » dans « ${l} »`);
  }
  redirections.push({ from, to, status, force });
}
for (const r of enListe(toml.redirects)) {
  if (r.conditions || r.query || r.signed || r.headers) {
    throw new Error(`netlify.toml : règle avec conditions non prise en charge : ${JSON.stringify(r)}`);
  }
  redirections.push({ from: r.from, to: r.to, status: r.status || 301, force: !!r.force });
}

/* ---------- en-têtes : _headers puis netlify.toml ---------- */
const entetes = [];
const fichierHeaders = lire(path.join(build, publication, "_headers"));
let courant = null;
for (const ligne of (fichierHeaders || "").split("\n")) {
  if (!ligne.trim() || ligne.trim().startsWith("#")) continue;
  if (!/^\s/.test(ligne)) { courant = { for: ligne.trim(), values: {} }; entetes.push(courant); continue; }
  const i = ligne.indexOf(":");
  if (courant && i > 0) courant.values[ligne.slice(0, i).trim()] = ligne.slice(i + 1).trim();
}
for (const h of enListe(toml.headers)) entetes.push({ for: h.for, values: { ...h.values } });

/* ---------- formulaires Netlify (data-netlify="true" ou attribut netlify) ---------- */
const formulaires = {};
const parcourir = (dir) => {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) { if (!["node_modules", ".git", "cloudflare", "netlify"].includes(f.name)) parcourir(p); continue; }
    if (!f.name.endsWith(".html")) continue;
    const html = fs.readFileSync(p, "utf8");
    for (const m of html.matchAll(/<form\b[^>]*>/gi)) {
      const balise = m[0];
      if (!/\sdata-netlify\s*=\s*["']?true["']?(?=[\s>\/])|\snetlify(?=[\s>=\/])/i.test(balise)) continue;
      const nom = (balise.match(/\sname\s*=\s*["']([^"']+)/i) || [])[1];
      if (!nom) continue;
      formulaires[nom] = {
        pot: (balise.match(/netlify-honeypot\s*=\s*["']([^"']+)/i) || [])[1] || null,
        action: (balise.match(/\saction\s*=\s*["']([^"']+)/i) || [])[1] || null,
      };
    }
  }
};
parcourir(path.join(build, publication));

/* ---------- crons ---------- */
const crons = {};
for (const f of fonctions.filter((f) => f.planifiee)) (crons[f.planifiee] ||= []).push(f.nom);

/* ---------- écriture ---------- */
const dirCf = path.join(build, "cloudflare");
fs.mkdirSync(dirCf, { recursive: true });
// Copie de l'adaptateur d'exécution seulement (pas les tests ni ce générateur)
fs.mkdirSync(path.join(dirCf, "adaptateur"), { recursive: true });
fs.copyFileSync(path.join(ICI, "front-statique.js"), path.join(dirCf, "adaptateur", "front-statique.js"));
fs.cpSync(path.join(ICI, "netlify"), path.join(dirCf, "adaptateur", "netlify"), { recursive: true });

const imports = [...fonctions.map((f, i) => `import * as f${i} from ${JSON.stringify(f.fichier.startsWith(".") ? f.fichier : "./" + f.fichier)};`),
  ...edges.map((e, i) => `import * as e${i} from ${JSON.stringify(e.fichier.startsWith(".") ? e.fichier : "./" + e.fichier)};`)];
const description = {
  nom: config.name,
  fonctions: fonctions.map((f, i) => ({ ...f, fichier: undefined, module: `@@f${i}@@` })),
  edges: edges.map((e, i) => ({ ...e, fichier: undefined, module: `@@e${i}@@` })),
  redirections, entetes, crons, formulaires,
};
fs.writeFileSync(path.join(dirCf, "genere.mjs"),
  `// Généré par adaptateur/generer.mjs — ne pas modifier à la main\n${imports.join("\n")}\n\nexport default ${
    JSON.stringify(description, null, 2).replace(/"@@(\w+)@@"/g, "$1")};\n`);
// Décodeur Opus (vocaux WhatsApp) : module WebAssembly précompilé au build (voir build/extraire_opus.mjs)
let initOpus = "";
const paquet = JSON.parse(lire(path.join(build, "package.json")) || "{}");
if ({ ...paquet.dependencies }["ogg-opus-decoder"] || { ...paquet.dependencies }["opus-decoder"]) {
  execFileSync(process.execPath, [path.join(ICI, "build", "extraire_opus.mjs"), build, path.join(dirCf, "opus-decoder.wasm")], { stdio: "inherit" });
  initOpus = `import moduleOpus from "./opus-decoder.wasm";\nimport { OpusDecoder } from "opus-decoder";\nOpusDecoder.module = moduleOpus;\n`;
}
fs.writeFileSync(path.join(dirCf, "worker.mjs"),
  `// Point d'entrée Cloudflare : fait tourner le site Netlify tel quel (voir cloudflare/adaptateur)\n` + initOpus +
  `import site from "./genere.mjs";\nimport { creerWorker } from "./adaptateur/netlify/routeur.js";\n` +
  `export { StockageBlobs } from "./adaptateur/netlify/routeur.js";\nexport default creerWorker(site);\n`);

// Wrangler interprète lui-même _redirects/_headers (syntaxe plus stricte que Netlify) : le routeur
// les applique déjà, on les retire du dossier publié (copie de build, le dépôt n'est pas touché).
for (const f of ["_redirects", "_headers"]) {
  const p = path.join(build, publication, f);
  if (fs.existsSync(p)) fs.renameSync(p, path.join(build, "cloudflare", f + ".netlify"));
}

const ignorer = ["node_modules", "cloudflare", "netlify", ".wrangler", "wrangler.jsonc", ".assetsignore",
  "netlify.toml", "_redirects", "_headers",
  ".git", ".gitignore", ".DS_Store", ".netlify", ...(config.nePasPublier || [])];
fs.writeFileSync(path.join(build, publication, ".assetsignore"), ignorer.join("\n") + "\n");

const avecArrierePlan = fonctions.some((f) => f.arrierePlan);
const wrangler = {
  $schema: "node_modules/wrangler/config-schema.json",
  name: config.name,
  main: "cloudflare/worker.mjs",
  compatibility_date: config.compatibility_date || "2026-10-01",
  compatibility_flags: ["nodejs_compat"],
  assets: { directory: publication, binding: "ASSETS", run_worker_first: true, html_handling: "none", not_found_handling: "none" },
  alias: {
    "@netlify/blobs": "./cloudflare/adaptateur/netlify/blobs.js",
    "@netlify/database": "./cloudflare/adaptateur/netlify/database.js",
  },
  durable_objects: { bindings: [{ name: "BLOBS", class_name: "StockageBlobs" }] },
  migrations: [{ tag: "v1", new_sqlite_classes: ["StockageBlobs"] }],
  observability: { enabled: true },
  vars: config.vars || {},
  workers_dev: config.workers_dev ?? true,
};
if (fs.existsSync(path.join(build, "node_modules", "@eshaz", "web-worker"))) {
  wrangler.alias["@eshaz/web-worker"] = "./cloudflare/adaptateur/netlify/stub-web-worker.js";
}
if (config.routes) wrangler.routes = config.routes;
if (config.limits) wrangler.limits = config.limits;
// Applis bavardes avec leurs données (Durable Objects en Europe centrale, Neon à Francfort) :
// leur code tourne à Francfort plutôt qu'au plus près du visiteur
if (config.placement) wrangler.placement = config.placement;
// Formulaires : e-mail de notification par Cloudflare Email Service (domaine à activer d'abord)
if (config.email) wrangler.send_email = [{ name: "EMAIL" }];
if (config.hyperdrive) wrangler.hyperdrive = [{ binding: "HYPERDRIVE", id: config.hyperdrive }];
if (avecArrierePlan) {
  const file = config.file_arriere_plan || `${config.name}-arriere-plan`;
  wrangler.queues = {
    producers: [{ binding: "FILE_ARRIERE_PLAN", queue: file }],
    consumers: [{ queue: file, max_batch_size: 1, max_retries: 2, max_concurrency: 5 }],
  };
}
// Les crons ne sont branchés que sur décision explicite (cronsActifs) : jamais pendant les essais
if (config.cronsActifs && Object.keys(crons).length) wrangler.triggers = { crons: Object.keys(crons) };
else wrangler.triggers = { crons: [] };
fs.writeFileSync(path.join(build, "wrangler.jsonc"),
  "// Généré par adaptateur/generer.mjs à partir de netlify.toml — ne pas modifier à la main\n" + JSON.stringify(wrangler, null, 2) + "\n");

/* ---------- bilan ---------- */
console.log(`Site ${config.name} — publication « ${publication} »`);
for (const f of fonctions) {
  console.log(`  fonction ${f.nom.padEnd(32)} ${f.planifiee ? "cron " + f.planifiee : f.arrierePlan ? "arrière-plan" : f.chemins.join(", ") || "/.netlify/functions/" + f.nom}`);
}
for (const e of edges) console.log(`  edge     ${e.nom.padEnd(32)} ${e.chemins.join(", ")}`);
for (const [n, f] of Object.entries(formulaires)) console.log(`  formulaire « ${n} » (pot de miel : ${f.pot || "aucun"})`);
console.log(`  ${redirections.length} règle(s) de redirection, ${entetes.length} règle(s) d'en-têtes, ${Object.keys(crons).length} expression(s) cron ${config.cronsActifs ? "(ACTIVES)" : "(inactives)"}`);
