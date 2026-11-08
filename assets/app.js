/* ============================================================
   Happy Décors — interactions
   Dépend de assets/decors.js (UNIVERSES, DECORS)
   ============================================================ */
(function () {
  "use strict";

  // Couleur, libellé et photo de fond par univers (définis dans decors.js)
  const UNIS = universesInOrder();
  const UCOLOR = {}, uLabel = {}, UNI_BG = {};
  UNIVERSES.forEach(u => { UCOLOR[u.key] = u.color; uLabel[u.key] = u.label; if (u.bg) UNI_BG[u.key] = u.bg; });
  const uLabels = d => [d.u].concat(d.also || []).map(k => uLabel[k]).join(" ");

  // ---------- Échelle : hauteur approx. (m), relevée dans les devis/commandes ----------
  const HEIGHTS = {
    // Nouveaux décors (commandes 2023-2025)
    DG_131: 2.2, DG_132: 2.1, DG_133: 2.2, DG_135: 2.2, DG_136: 1.2,
    DG_137: 1.6, DG_138: 2, DG_140: 2.6, DG_142: 2.5, DG_143: 2.2,
    DG_144: 1.4, DG_145: 1.6, DG_146: 1.4, DG_147: 1.2,
    // Décors existants
    DG_130: 4.3, DG_032: 2.4, DG_015: 1.8, DG_091: 1.9, DG_069: 1.8, DG_006: 2.3,
    DG_049: 5.5, DG_017: 2.3, DG_018: 1.5, DG_019: 1.2, DG_078: 3.4, DG_058: 1.8,
    DG_088: 2.5, DG_083: 1.6, DG_052: 3.9, DG_007: 1.5, DG_080: 1.7, DG_081: 1.7,
    DG_051: 1.7, DG_100: 5.4, DG_102: 5.6, DG_098: 5.5, DG_095: 5.5,
  };
  const fmtH = m => (Number.isInteger(m) ? m + " m" : String(m).replace(".", ",") + " m");
  const capOf = d => `${d.name}${d.qte ? " (" + d.qte + " disponibles)" : ""} — ${d.price > 0 ? d.price + "€" + (d.qte ? " l'unité" : "") + " / 48h" : "sur devis"}`;
  function mediaBadge(d) {
    const m = (typeof MEDIA !== "undefined" && MEDIA[d.id]) || {};
    const n = 1 + (m.photos ? m.photos.length : 0) + (m.video ? 1 : 0);
    if (n <= 1) return "";
    const play = m.video ? '<svg class="mb-play" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>' : '';
    return `<span class="card-media" aria-hidden="true">${play}<svg class="mb-ph" viewBox="0 0 24 24"><path d="M9 4 7.8 5.6H5A1.8 1.8 0 0 0 3.2 7.4v9.2A1.8 1.8 0 0 0 5 18.4h14a1.8 1.8 0 0 0 1.8-1.8V7.4A1.8 1.8 0 0 0 19 5.6h-2.8L15 4Zm3 3.9a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6Z"/></svg>${n}</span>`;
  }

  const $ = sel => document.querySelector(sel);
  const fmtPrice = p => p > 0
    ? `${p}€ <small>/ 48h</small>`
    : `Sur devis`;

  // ---------- État ----------
  let activeU = "all";
  let query = "";
  const selected = new Set();

  // ---------- Éléments ----------
  const grid = $("#grid");
  const filters = $("#filters");
  const universGrid = $("#universGrid");
  const searchInput = $("#searchInput");
  const resultCount = $("#resultCount");
  const emptyMsg = $("#empty");

  // ======================================================
  //  UNIVERS : cartes + puces de filtre
  // ======================================================
  const counts = {};
  UNIVERSES.forEach(u => { counts[u.key] = DECORS.filter(d => inUniverse(d, u.key)).length; });

  // Cartes d'univers (section Univers)
  universGrid.innerHTML = UNIS.map(u => `
    <button class="uni-card${UNI_BG[u.key] ? " has-bg" : ""}" data-u="${u.key}" style="--uc:${UCOLOR[u.key]}${UNI_BG[u.key] ? `; background-image:url('${UNI_BG[u.key]}')` : ""}">
      ${u.soon ? '<span class="uni-soon">Bientôt</span>' : ""}<span class="uni-emoji">${u.emoji}</span>
      <span class="uni-name">${u.label}</span>
      <span class="uni-count">${counts[u.key] || 0} décors</span>
    </button>`).join("");

  universGrid.addEventListener("click", e => {
    const btn = e.target.closest(".uni-card");
    if (!btn) return;
    setUniverse(btn.dataset.u);
    document.getElementById("catalogue").scrollIntoView({ behavior: "smooth" });
  });

  // Puces de filtre (toolbar du catalogue)
  const chipsHTML = [`<button class="chip" data-u="all" aria-pressed="true">Tout voir</button>`]
    .concat(UNIS.map(u => `
      <button class="chip" data-u="${u.key}" aria-pressed="false" style="--cc:${UCOLOR[u.key]}">
        <span class="c-emoji">${u.emoji}</span>${u.short || u.label}
      </button>`)).join("");
  filters.innerHTML = chipsHTML;

  filters.addEventListener("click", e => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    setUniverse(chip.dataset.u);
  });

  function setUniverse(u) {
    activeU = u;
    filters.querySelectorAll(".chip").forEach(c =>
      c.setAttribute("aria-pressed", String(c.dataset.u === u)));
    render();
  }

  // ======================================================
  //  CATALOGUE : rendu + filtrage
  // ======================================================
  let current = []; // liste filtrée courante (pour la lightbox)

  const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe").replace(/æ/g, "ae");
  function getFiltered() {
    const q = norm(query.trim());
    return DECORS.filter(d => {
      if (activeU !== "all" && !inUniverse(d, activeU)) return false;
      if (q) {
        const hay = norm(d.name + " " + d.theme + " " + uLabels(d));
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function cardHTML(d) {
    const cc = UCOLOR[d.u];
    const added = selected.has(d.id);
    return `
      <article class="card" style="--cc:${cc}">
        <div class="card-img" data-id="${d.id}" role="button" tabindex="0" aria-label="Agrandir ${d.name}">
          <span class="card-theme">${d.theme}</span>
          ${mediaBadge(d)}
          <span class="card-zoom"><svg viewBox="0 0 24 24"><path d="M15 3h6v6h-2V6.4l-3.3 3.3-1.4-1.4L17.6 5H15V3ZM3 15h2v2.6l3.3-3.3 1.4 1.4L6.4 19H9v2H3v-6Z"/></svg></span>
          <img src="assets/decors/${d.id}.jpg" alt="${d.name} — décor gonflable (${d.theme})" loading="lazy" />
        </div>
        <div class="card-body">
          <span class="card-name">${d.name}</span>
          ${d.qte ? `<span class="card-qte">${d.qte} disponibles</span>` : ""}
          <span class="card-price ${d.price > 0 ? "" : "devis"}">${d.price > 0 && d.qte ? `${d.price}€ <small>l'unité · 48h</small>` : fmtPrice(d.price)}</span>
          <button class="card-add" data-add="${d.id}" data-added="${added}">
            ${added ? "✓ Ajouté à ma demande" : "+ Ajouter à ma demande"}
          </button>
        </div>
      </article>`;
  }

  function render() {
    current = getFiltered();
    // Dans un univers : ses décors propres d'abord, puis ceux qui s'y associent ; vedettes en tête
    const rank = d => (activeU !== "all" && d.u !== activeU ? 2 : 0) + (d.featured ? 0 : 1);
    current.sort((a, b) => rank(a) - rank(b));
    grid.innerHTML = current.map(cardHTML).join("");
    const n = current.length;
    resultCount.textContent = n === DECORS.length
      ? `Plus de 100 décors disponibles`
      : `${n} décor${n > 1 ? "s" : ""} ${activeU !== "all" ? "· " + uLabel[activeU] : ""}`;
    emptyMsg.hidden = n > 0;
  }

  // Recherche
  searchInput.addEventListener("input", () => { query = searchInput.value; render(); });
  $("#resetSearch").addEventListener("click", () => {
    query = ""; searchInput.value = ""; setUniverse("all");
  });

  // ======================================================
  //  SÉLECTION (panier de demande)
  // ======================================================
  const selBar = $("#selectionBar");
  const selN = $("#selN");
  const decorsField = $("#f-decors");

  grid.addEventListener("click", e => {
    const btn = e.target.closest(".card-add");
    if (!btn) return;
    const id = btn.dataset.add;
    if (selected.has(id)) selected.delete(id); else selected.add(id);
    syncSelection();
    const on = selected.has(id);
    btn.dataset.added = String(on);
    btn.textContent = on ? "✓ Ajouté à ma demande" : "+ Ajouter à ma demande";
  });

  function syncSelection() {
    selN.textContent = String(selected.size);
    selBar.hidden = selected.size === 0;
    document.body.classList.toggle("has-sel", selected.size > 0);
    const names = [...selected].map(id => (DECORS.find(d => d.id === id) || {}).name).filter(Boolean);
    if (names.length) decorsField.value = names.join(", ");
    else if (decorsField.dataset.auto !== "0") decorsField.value = "";
  }
  // si l'utilisateur tape à la main, on arrête d'écraser
  decorsField.addEventListener("input", () => { decorsField.dataset.auto = "0"; });

  $("#selClear").addEventListener("click", () => {
    selected.clear();
    grid.querySelectorAll(".card-add").forEach(b => { b.dataset.added = "false"; b.textContent = "+ Ajouter à ma demande"; });
    syncSelection();
  });
  $("#selGo").addEventListener("click", () => {
    document.getElementById("contact").scrollIntoView({ behavior: "smooth" });
  });

  // ======================================================
  //  LIGHTBOX
  // ======================================================
  // « Nos réalisations » — photos + vidéos d'événements
  const GALLERY = [
    { src: "assets/gallery/gv46_ocean_t7.mp4", poster: "assets/gallery/gv46_ocean_t7.jpg", cap: "Sous l'océan au T7 : dauphin, pieuvre & poissons-clowns", video: true },
    { src: "assets/gallery/gv49_astronaute_t7.mp4", poster: "assets/gallery/gv49_astronaute_t7.jpg", cap: "Astronaute géant en apesanteur au T7", video: true },
    { src: "assets/gallery/gv37_lune.mp4", poster: "assets/gallery/gv37_lune.jpg", cap: "Halloween : la Grande Lune face à la Tour Eiffel", video: true },
    { src: "assets/gallery/gv47_ovni_t7.mp4", poster: "assets/gallery/gv47_ovni_t7.jpg", cap: "Galaxy au T7 : soucoupe volante OVNI", video: true },
    { src: "assets/gallery/gv41_montgolfiere.mp4", poster: "assets/gallery/gv41_montgolfiere.jpg", cap: "Glace géante au coucher du soleil", video: true },
    { src: "assets/gallery/g08_candyland.jpg",  cap: "Arche Candyland" },
    { src: "assets/gallery/gv50_lune_astronaute_t7.mp4", poster: "assets/gallery/gv50_lune_astronaute_t7.jpg", cap: "Grande Lune & astronaute, salle prête au T7", video: true },
    { src: "assets/gallery/gv48_navette_t7.mp4", poster: "assets/gallery/gv48_navette_t7.jpg", cap: "Navette spatiale au-dessus de la piste du T7", video: true },
    { src: "assets/gallery/gv32_ariel.mp4", poster: "assets/gallery/gv32_ariel.jpg", cap: "La Petite Sirène au T7", video: true },
    { src: "assets/gallery/g17_chats.jpg",      cap: "Chat du Cheshire & Aristochats" },
    { src: "assets/gallery/gv38_marguerites.mp4", poster: "assets/gallery/gv38_marguerites.jpg", cap: "Marguerites géantes au coucher du soleil", video: true },
    { src: "assets/gallery/gv44_boules_arcenciel.mp4", poster: "assets/gallery/gv44_boules_arcenciel.jpg", cap: "Boules arc-en-ciel au crépuscule", video: true },
    { src: "assets/gallery/gv19_piscine_ballons.mp4", poster: "assets/gallery/gv19_piscine_ballons.jpg", cap: "Piscine de ballons au T7, vue sur la Tour Eiffel", video: true },
    { src: "assets/gallery/g06_paris.jpg",      cap: "Paris — Moulin Rouge & Tour Eiffel" },
    { src: "assets/gallery/gv10_baleine.mp4",   poster: "assets/gallery/gv10_baleine.jpg",   cap: "Baleine géante en vol",                video: true },
    { src: "assets/gallery/gv33_pieuvre.mp4", poster: "assets/gallery/gv33_pieuvre.jpg", cap: "Pieuvre rose géante", video: true },
    { src: "assets/gallery/gv45_poisson_clown.mp4", poster: "assets/gallery/gv45_poisson_clown.jpg", cap: "Poisson-clown géant face à la Tour Eiffel", video: true },
    { src: "assets/gallery/g35_requin.jpg", cap: "Requin géant" },
    { src: "assets/gallery/g31_clown.jpg", cap: "Tête de clown géante (Halloween)" },
    { src: "assets/gallery/g23_spiderman.jpg",  cap: "Arche Spider-Man & toiles lumineuses" },
    { src: "assets/gallery/gv31_canopee_blanche.mp4", poster: "assets/gallery/gv31_canopee_blanche.jpg", cap: "Bal en Blanc : canopée de ballons blancs", video: true },
    { src: "assets/gallery/gv36_eclair.mp4", poster: "assets/gallery/gv36_eclair.jpg", cap: "Éclair géant", video: true },
    { src: "assets/gallery/g19_paques.jpg",     cap: "Lapin géant & œufs dorés (Pâques)" },
    { src: "assets/gallery/g13_rooftop.jpg",    cap: "Rooftop — chat porte-bonheur & lanternes" },
    { src: "assets/gallery/g01_tigre.jpg",      cap: "Arche Tigre face à la foule" },
    { src: "assets/gallery/gv1_mario.mp4",      poster: "assets/gallery/gv1_mario.jpg",      cap: "Mario, Spider-Man & nuages sous les lasers",                 video: true },
    { src: "assets/gallery/g03_araignee.jpg",   cap: "Araignée géante & sa toile" },
    { src: "assets/gallery/g02_coeurs.jpg",     cap: "Arche de cœurs roses" },
    { src: "assets/gallery/g36_coeur_aile.jpg", cap: "Cœur ailé" },
    { src: "assets/gallery/g04_jurassic.jpg",   cap: "Univers Jurassic — T-Rex" },
    { src: "assets/gallery/g05_dragon.jpg",     cap: "Dragon chinois & lanternes" },
    { src: "assets/gallery/g27_halloween.jpg",  cap: "Ambiance Halloween" },
    { src: "assets/gallery/g07_espace.jpg",     cap: "Navette & planètes — Espace" },
    { src: "assets/gallery/gv39_zodiac.mp4", poster: "assets/gallery/gv39_zodiac.jpg", cap: "Zodiac : planètes & étoiles au plafond", video: true },
    { src: "assets/gallery/gv42_planete_eiffel.mp4", poster: "assets/gallery/gv42_planete_eiffel.jpg", cap: "Planète géante face à la Tour Eiffel", video: true },
    { src: "assets/gallery/gv35_planetes_fluo.mp4", poster: "assets/gallery/gv35_planetes_fluo.jpg", cap: "Planètes & toiles fluo", video: true },
    { src: "assets/gallery/gv40_arbres_fluo.mp4", poster: "assets/gallery/gv40_arbres_fluo.jpg", cap: "Arbres & étoiles fluo", video: true },
    { src: "assets/gallery/gv9_ovni.mp4",       poster: "assets/gallery/gv9_ovni.jpg",       cap: "OVNI & planètes sous le néon",         video: true },
    { src: "assets/gallery/g24_fusee.jpg",      cap: "Fusée orange" },
    { src: "assets/gallery/g25_avion.jpg",      cap: "Avion suspendu" },
    { src: "assets/gallery/gv4_arcenciel.mp4",  poster: "assets/gallery/gv4_arcenciel.jpg",  cap: "Arc-en-ciel, Pégase & papillons",              video: true },
    { src: "assets/gallery/g20_banane.jpg",     cap: "Bananes & sphères miroir" },
    { src: "assets/gallery/g09_californie.jpg", cap: "Combi VW — ambiance Flower Power" },
    { src: "assets/gallery/g10_tropical.jpg",   cap: "Arche perroquet & palmiers" },
    { src: "assets/gallery/g22_emojis.jpg",     cap: "Emojis géants en arc" },
    { src: "assets/gallery/g30_university.jpg", cap: "Colonne de ballons « University »" },
    { src: "assets/gallery/g37_mur_arcenciel.jpg", cap: "Pride : murs de ballons arc-en-ciel" },
    { src: "assets/gallery/gv20_plafond_ballons.mp4", poster: "assets/gallery/gv20_plafond_ballons.jpg", cap: "Plafond de ballons au-dessus de la scène", video: true },
    { src: "assets/gallery/g21_chateau.jpg",    cap: "Arche château & boules miroir" },
    { src: "assets/gallery/g18_noel.jpg",       cap: "Cadeaux, étoiles & sapins (Noël)" },
    { src: "assets/gallery/gv15_pegase.mp4", poster: "assets/gallery/gv15_pegase.jpg", cap: "Pégase en vol au-dessus de la piste", video: true },
    { src: "assets/gallery/gv34_noel.mp4", poster: "assets/gallery/gv34_noel.jpg", cap: "Noël : sucres d'orge & étoiles", video: true },
    { src: "assets/gallery/g12_papillons.jpg",  cap: "Papillons fluo & lanternes" },
    { src: "assets/gallery/g15_fluo.jpg",       cap: "Étoiles violettes devant la scène DJ" },
    { src: "assets/gallery/g14_lanternes.jpg",  cap: "Lanternes ethniques & toiles fluo" },
    { src: "assets/gallery/g11_noirblanc.jpg",  cap: "Bal noir & blanc" },
    { src: "assets/gallery/gv43_masque.mp4", poster: "assets/gallery/gv43_masque.jpg", cap: "Masque vénitien géant", video: true },
  ];

  const lb = $("#lightbox"), lbImg = $("#lbImg"), lbVid = $("#lbVid"), lbCap = $("#lbCap"), lbAdd = $("#lbAdd");
  let lbItems = [];   // [{ src, cap }]
  let lbIndex = -1;
  let lbDecorId = null;
  function syncLbAdd() {
    if (!lbDecorId) return;
    const on = selected.has(lbDecorId);
    lbAdd.textContent = on ? "✓ Ajouté à ma demande" : "+ Ajouter à ma demande";
  }

  function openLBList(items, i) {
    if (!items.length || i < 0) return;
    lbItems = items; lbIndex = i;
    showLB();
    lbAdd.hidden = !lbDecorId;
    syncLbAdd();
    lb.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function openLB(id) {
    const d = DECORS.find(x => x.id === id);
    if (!d) return;
    lbDecorId = id;
    const m = (typeof MEDIA !== "undefined" && MEDIA[d.id]) || {};
    const items = [{ src: `assets/decors/${d.id}.jpg`, cap: capOf(d), h: HEIGHTS[d.id] }];
    (m.photos || []).forEach(p => items.push({ src: `assets/decors/${p}`, cap: capOf(d) }));
    if (m.video) items.push({ src: `assets/decors/${m.video}`, cap: capOf(d), video: true });
    openLBList(items, 0);
  }
  function showLB() {
    const it = lbItems[lbIndex];
    if (!it) return;
    if (it.video) {
      lbImg.hidden = true;
      lbVid.hidden = false;
      lbVid.muted = true;
      lbVid.src = it.src;
      lbVid.play().catch(() => {});
    } else {
      lbVid.pause();
      lbVid.hidden = true;
      lbVid.removeAttribute("src");
      lbImg.hidden = false;
      lbImg.src = it.src;
      lbImg.alt = it.cap;
    }
    lbCap.textContent = it.cap + (it.h ? ` · ≈ ${fmtH(it.h)}` : "");
  }
  function moveLB(step) {
    if (!lbItems.length) return;
    lbIndex = (lbIndex + step + lbItems.length) % lbItems.length;
    showLB();
  }
  function closeLB() { lbVid.pause(); lb.hidden = true; document.body.style.overflow = ""; }

  grid.addEventListener("click", e => {
    const img = e.target.closest(".card-img");
    if (img) openLB(img.dataset.id);
  });
  grid.addEventListener("keydown", e => {
    const img = e.target.closest(".card-img");
    if (img && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openLB(img.dataset.id); }
  });

  // Galerie « Nos réalisations »
  const galleryGrid = $("#galleryGrid");
  if (galleryGrid) {
    // On affiche les 24 premières ; « Voir plus » dévoile la suite par paquets (page légère sur mobile)
    const PAS = 24;
    let montrees = 0;
    const tuile = (g, i) => `
      <button class="gal-item${g.video ? " is-video" : ""}" data-i="${i}" aria-label="${g.video ? "Lire la vidéo" : "Agrandir"} : ${g.cap}">
        <img src="${g.video ? g.poster : g.src}" alt="${g.cap}" loading="lazy" />
        ${g.video ? '<span class="gal-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>' : ""}
        <span class="gal-cap">${g.cap}</span>
      </button>`;
    const plus = document.createElement("button");
    plus.type = "button";
    plus.className = "btn btn-ghost gal-more";
    galleryGrid.after(plus);
    const montrer = () => {
      const fin = Math.min(GALLERY.length, montrees + PAS);
      galleryGrid.insertAdjacentHTML("beforeend", GALLERY.slice(montrees, fin).map((g, k) => tuile(g, montrees + k)).join(""));
      montrees = fin;
      const reste = GALLERY.length - montrees;
      plus.hidden = reste <= 0;
      plus.textContent = `Voir plus de réalisations (${reste})`;
    };
    montrer();
    plus.addEventListener("click", montrer);
    galleryGrid.addEventListener("click", e => {
      const it = e.target.closest(".gal-item");
      if (it) { lbDecorId = null; openLBList(GALLERY, +it.dataset.i); }
    });
  }

  lbAdd.addEventListener("click", () => {
    if (!lbDecorId) return;
    if (selected.has(lbDecorId)) selected.delete(lbDecorId); else selected.add(lbDecorId);
    syncSelection();
    syncLbAdd();
    const b = grid.querySelector(`.card-add[data-add="${lbDecorId}"]`);
    if (b) { const on = selected.has(lbDecorId); b.dataset.added = String(on); b.textContent = on ? "✓ Ajouté à ma demande" : "+ Ajouter à ma demande"; }
  });
  $("#lbClose").addEventListener("click", closeLB);
  $("#lbPrev").addEventListener("click", () => moveLB(-1));
  $("#lbNext").addEventListener("click", () => moveLB(1));
  lb.addEventListener("click", e => { if (e.target === lb) closeLB(); });
  document.addEventListener("keydown", e => {
    if (lb.hidden) return;
    if (e.key === "Escape") closeLB();
    if (e.key === "ArrowLeft") moveLB(-1);
    if (e.key === "ArrowRight") moveLB(1);
  });

  // ======================================================
  //  MENU MOBILE
  // ======================================================
  const burger = $("#burger"), mobileMenu = $("#mobileMenu");
  burger.addEventListener("click", () => {
    const open = burger.getAttribute("aria-expanded") === "true";
    burger.setAttribute("aria-expanded", String(!open));
    mobileMenu.hidden = open;
  });
  mobileMenu.addEventListener("click", e => {
    if (e.target.closest("a")) { burger.setAttribute("aria-expanded", "false"); mobileMenu.hidden = true; }
  });

  // ======================================================
  //  FORMULAIRE (Netlify Forms + envoi AJAX)
  // ======================================================
  const form = $("#contactForm");
  const okMsg = $("#formSuccess"), errMsg = $("#formError"), submitBtn = $("#submitBtn");

  form.addEventListener("submit", e => {
    e.preventDefault();
    okMsg.hidden = true; errMsg.hidden = true;
    submitBtn.disabled = true; submitBtn.textContent = "Envoi…";

    const data = new URLSearchParams(new FormData(form)).toString();
    fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: data })
      .then(r => {
        if (!r.ok) throw new Error("net");
        form.reset(); selected.clear(); syncSelection();
        grid.querySelectorAll(".card-add").forEach(b => { b.dataset.added = "false"; b.textContent = "+ Ajouter à ma demande"; });
        okMsg.hidden = false;
        okMsg.scrollIntoView({ behavior: "smooth", block: "center" });
      })
      .catch(() => { errMsg.hidden = false; })
      .finally(() => { submitBtn.disabled = false; submitBtn.textContent = "Envoyer ma demande"; });
  });

  // ======================================================
  //  DIVERS
  // ======================================================
  $("#year").textContent = new Date().getFullYear();
  document.querySelectorAll(".js-count").forEach(e => { e.textContent = DECORS.length; });
  render();
})();
