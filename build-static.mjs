// Pré-génère le catalogue + les univers en HTML statique (SEO : contenu visible par Google).
// Le JS (app.js) remplace ensuite ces blocs pour les visiteurs. À lancer avant chaque déploiement.
import fs from "fs";

const g = {};
new Function("g", fs.readFileSync("assets/decors.js", "utf8") + ";g.DECORS=DECORS;g.sizeText=sizeText;g.UNIVERSES=UNIVERSES;g.universesInOrder=universesInOrder;g.inUniverse=inUniverse;")(g);
const { sizeText, DECORS, UNIVERSES, universesInOrder, inUniverse } = g;

const UCOLOR = {}, UNI_BG = {};
UNIVERSES.forEach(u => { UCOLOR[u.key] = u.color; if (u.bg) UNI_BG[u.key] = u.bg; });
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const counts = {};
UNIVERSES.forEach(u => { counts[u.key] = DECORS.filter(d => inUniverse(d, u.key)).length; });
const uLabel = {}; UNIVERSES.forEach(u => uLabel[u.key] = u.label);

const card = d => `
      <article class="card" style="--cc:${UCOLOR[d.u]}">
        <div class="card-img" data-id="${d.id}" role="button" tabindex="0" aria-label="Agrandir ${esc(d.name)}">
          <span class="card-theme">${esc(d.theme)}</span>
          <img src="assets/decors/${d.id}.jpg" alt="${esc(d.name)} — décor gonflable géant à louer à Paris (${esc(d.theme)})" loading="lazy" width="500" height="500" />
        </div>
        <div class="card-body">
          <h3 class="card-name">${esc(d.name)}</h3>
          ${d.qte ? `<span class="card-qte">${d.qte} disponibles</span>` : ""}${sizeText(d.id) ? `<span class="card-size">${sizeText(d.id)}</span>` : ""}<span class="card-price ${d.price > 0 ? "" : "devis"}">${d.price > 0 ? d.price + (d.qte ? "€ <small>l'unité · 48h</small>" : "€ <small>/ 48h</small>") : "Sur devis"}</span>
          <button class="card-add" data-add="${d.id}" data-added="false">+ Ajouter à ma demande</button>
        </div>
      </article>`;

const uni = u => `
    <button class="uni-card${UNI_BG[u.key] ? " has-bg" : ""}" data-u="${u.key}" style="--uc:${UCOLOR[u.key]}${UNI_BG[u.key] ? `; background-image:url('${UNI_BG[u.key]}')` : ""}">
      ${u.soon ? '<span class="uni-soon">Bientôt</span>' : ""}<span class="uni-emoji">${u.emoji}</span>
      <span class="uni-name">${esc(u.label)}</span>
      <span class="uni-count">${counts[u.key] || 0} décors</span>
    </button>`;

const grid = DECORS.map(card).join("");
const ordered = universesInOrder();
const GRP = { occasion: "Occasions", couleur: "Couleurs &amp; ambiances", univers: "Univers" };
const unis = Object.keys(GRP).map(gk => { const l = ordered.filter(u => u.grp === gk); return l.length ? `<h3 class="uni-grp">${GRP[gk]}</h3><div class="univers-grid">${l.map(uni).join("")}</div>` : ""; }).join("");

let html = fs.readFileSync("index.html", "utf8");
html = html.replace(/(<!--GRID_START-->)[\s\S]*?(<!--GRID_END-->)/, `$1${grid}\n      $2`);
html = html.replace(/(<!--UNI_START-->)[\s\S]*?(<!--UNI_END-->)/, `$1${unis}\n    $2`);
fs.writeFileSync("index.html", html);
console.log(`Pré-rendu : ${DECORS.length} fiches + ${UNIVERSES.length} univers injectés dans index.html`);
