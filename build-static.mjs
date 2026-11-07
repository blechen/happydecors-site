// Pré-génère le catalogue + les univers en HTML statique (SEO : contenu visible par Google).
// Le JS (app.js) remplace ensuite ces blocs pour les visiteurs. À lancer avant chaque déploiement.
import fs from "fs";

const g = {};
new Function("g", fs.readFileSync("assets/decors.js", "utf8") + ";g.DECORS=DECORS;g.UNIVERSES=UNIVERSES;")(g);
const { DECORS, UNIVERSES } = g;

const UCOLOR = {
  amour: "#FF4D6D", animaux: "#1FBFA8", gourmandises: "#FF6FB5",
  villes: "#3BA7FF", espace: "#7B61FF", halloween: "#FF7A1A",
  fetes: "#2BB673", pop: "#F2A900", ete: "#14B8C4", ambiance: "#B968FF",
};
const UNI_BG = {
  amour: "assets/gallery/g02_coeurs.jpg", animaux: "assets/gallery/g01_tigre.jpg",
  gourmandises: "assets/gallery/g08_candyland.jpg", villes: "assets/gallery/g06_paris.jpg",
  espace: "assets/gallery/g07_espace.jpg", halloween: "assets/gallery/g27_halloween.jpg",
  fetes: "assets/gallery/g18_noel.jpg", pop: "assets/gallery/g23_spiderman.jpg",
  ete: "assets/gallery/g10_tropical.jpg", ambiance: "assets/gallery/g11_noirblanc.jpg",
};
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const counts = {};
DECORS.forEach(d => { counts[d.u] = (counts[d.u] || 0) + 1; });
const uLabel = {}; UNIVERSES.forEach(u => uLabel[u.key] = u.label);

const card = d => `
      <article class="card" style="--cc:${UCOLOR[d.u]}">
        <div class="card-img" data-id="${d.id}" role="button" tabindex="0" aria-label="Agrandir ${esc(d.name)}">
          <span class="card-theme">${esc(d.theme)}</span>
          <img src="assets/decors/${d.id}.jpg" alt="${esc(d.name)} — décor gonflable géant à louer à Paris (${esc(d.theme)})" loading="lazy" width="500" height="500" />
        </div>
        <div class="card-body">
          <h3 class="card-name">${esc(d.name)}</h3>
          <span class="card-price ${d.price > 0 ? "" : "devis"}">${d.price > 0 ? d.price + "€ <small>/ 48h</small>" : "Sur devis"}</span>
          <button class="card-add" data-add="${d.id}" data-added="false">+ Ajouter à ma demande</button>
        </div>
      </article>`;

const uni = u => `
    <button class="uni-card${UNI_BG[u.key] ? " has-bg" : ""}" data-u="${u.key}" style="--uc:${UCOLOR[u.key]}${UNI_BG[u.key] ? `; background-image:url('${UNI_BG[u.key]}')` : ""}">
      <span class="uni-emoji">${u.emoji}</span>
      <span class="uni-name">${esc(u.label)}</span>
      <span class="uni-count">${counts[u.key] || 0} décors</span>
    </button>`;

const grid = DECORS.map(card).join("");
const unis = UNIVERSES.map(uni).join("");

let html = fs.readFileSync("index.html", "utf8");
html = html.replace(/(<!--GRID_START-->)[\s\S]*?(<!--GRID_END-->)/, `$1${grid}\n      $2`);
html = html.replace(/(<!--UNI_START-->)[\s\S]*?(<!--UNI_END-->)/, `$1${unis}\n    $2`);
fs.writeFileSync("index.html", html);
console.log(`Pré-rendu : ${DECORS.length} fiches + ${UNIVERSES.length} univers injectés dans index.html`);
