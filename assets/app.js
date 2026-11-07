/* ============================================================
   Happy Décors — interactions
   Dépend de assets/decors.js (UNIVERSES, DECORS)
   ============================================================ */
(function () {
  "use strict";

  // Couleur par univers
  const UCOLOR = {
    amour: "#FF4D6D", animaux: "#1FBFA8", gourmandises: "#FF6FB5",
    villes: "#3BA7FF", espace: "#7B61FF", halloween: "#FF7A1A",
    fetes: "#2BB673", pop: "#F2A900", ete: "#14B8C4", ambiance: "#B968FF",
  };
  const uLabel = {}, uEmoji = {};
  UNIVERSES.forEach(u => { uLabel[u.key] = u.label; uEmoji[u.key] = u.emoji; });

  // Image de fond par univers (photos de soirée)
  const UNI_BG = {
    amour: "assets/gallery/g02_coeurs.jpg",
    animaux: "assets/gallery/g01_tigre.jpg",
    gourmandises: "assets/gallery/g08_candyland.jpg",
    villes: "assets/gallery/g06_paris.jpg",
    espace: "assets/gallery/g07_espace.jpg",
    halloween: "assets/gallery/g27_halloween.jpg",
    fetes: "assets/gallery/g18_noel.jpg",
    pop: "assets/gallery/g23_spiderman.jpg",
    ete: "assets/gallery/g10_tropical.jpg",
    ambiance: "assets/gallery/g11_noirblanc.jpg",
  };

  // ---------- Échelle : hauteur approx. (m), relevée dans les devis/commandes ----------
  const HEIGHTS = {
    // Nouveaux décors (commandes 2023-2025)
    DG_131: 2.2, DG_132: 2.1, DG_133: 2.2, DG_135: 2.2, DG_136: 1.2,
    DG_137: 1.6, DG_138: 2, DG_140: 2.6, DG_142: 2.5, DG_143: 2.2,
    // Décors existants
    DG_130: 4.3, DG_032: 2.4, DG_015: 1.8, DG_091: 1.9, DG_069: 1.8, DG_006: 2.3,
    DG_049: 5.5, DG_017: 2.3, DG_018: 1.5, DG_019: 1.2, DG_078: 3.4, DG_058: 1.8,
    DG_088: 2.5, DG_083: 1.6, DG_052: 3.9, DG_007: 1.5, DG_080: 1.7, DG_081: 1.7,
    DG_051: 1.7, DG_100: 5.4, DG_102: 5.6, DG_098: 5.5, DG_095: 5.5,
  };
  const fmtH = m => (Number.isInteger(m) ? m + " m" : String(m).replace(".", ",") + " m");
  const capOf = d => `${d.name} — ${d.price > 0 ? d.price + "€ / 48h" : "sur devis"}`;
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
  DECORS.forEach(d => { counts[d.u] = (counts[d.u] || 0) + 1; });

  // Cartes d'univers (section Univers)
  universGrid.innerHTML = UNIVERSES.map(u => `
    <button class="uni-card${UNI_BG[u.key] ? " has-bg" : ""}" data-u="${u.key}" style="--uc:${UCOLOR[u.key]}${UNI_BG[u.key] ? `; background-image:url('${UNI_BG[u.key]}')` : ""}">
      <span class="uni-emoji">${u.emoji}</span>
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
    .concat(UNIVERSES.map(u => `
      <button class="chip" data-u="${u.key}" aria-pressed="false" style="--cc:${UCOLOR[u.key]}">
        <span class="c-emoji">${u.emoji}</span>${u.label}
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
      if (activeU !== "all" && d.u !== activeU) return false;
      if (q) {
        const hay = norm(d.name + " " + d.theme + " " + uLabel[d.u]);
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
          <span class="card-price ${d.price > 0 ? "" : "devis"}">${fmtPrice(d.price)}</span>
          <button class="card-add" data-add="${d.id}" data-added="${added}">
            ${added ? "✓ Ajouté à ma demande" : "+ Ajouter à ma demande"}
          </button>
        </div>
      </article>`;
  }

  function render() {
    current = getFiltered();
    current.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    grid.innerHTML = current.map(cardHTML).join("");
    const n = current.length;
    resultCount.textContent = n === DECORS.length
      ? `${n} décors disponibles`
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
    { src: "assets/gallery/gv1_mario.mp4",      poster: "assets/gallery/gv1_mario.jpg",      cap: "Mario, Spider-Man & nuages sous les lasers",                 video: true },
    { src: "assets/gallery/g01_tigre.jpg",      cap: "Arche Tigre face à la foule" },
    { src: "assets/gallery/g06_paris.jpg",      cap: "Paris — Moulin Rouge & Tour Eiffel" },
    { src: "assets/gallery/g03_araignee.jpg",   cap: "Araignée géante & sa toile" },
    { src: "assets/gallery/gv7_araignee.mp4",   poster: "assets/gallery/gv7_araignee.jpg",   cap: "Araignée géante devant la scène DJ",   video: true },
    { src: "assets/gallery/gv3_papillons.mp4",  poster: "assets/gallery/gv3_papillons.jpg",  cap: "Chat du Pays des Merveilles & papillons fluo",        video: true },
    { src: "assets/gallery/g02_coeurs.jpg",     cap: "Arche de cœurs roses" },
    { src: "assets/gallery/g04_jurassic.jpg",   cap: "Univers Jurassic — T-Rex" },
    { src: "assets/gallery/g05_dragon.jpg",     cap: "Dragon chinois & lanternes" },
    { src: "assets/gallery/gv8_dragon.mp4",     poster: "assets/gallery/gv8_dragon.jpg",     cap: "Dragon & lanternes rouges",            video: true },
    { src: "assets/gallery/gv2_clown.mp4",      poster: "assets/gallery/gv2_clown.jpg",      cap: "Clown géant & lasers",           video: true },
    { src: "assets/gallery/g27_halloween.jpg",  cap: "Ambiance Halloween" },
    { src: "assets/gallery/g28_fantomes.jpg",   cap: "Fantômes au-dessus de la foule" },
    { src: "assets/gallery/g16_baleine.jpg",    cap: "Baleine suspendue au-dessus de la piste" },
    { src: "assets/gallery/gv10_baleine.mp4",   poster: "assets/gallery/gv10_baleine.jpg",   cap: "Baleine géante en vol",                video: true },
    { src: "assets/gallery/gv5_espace.mp4",     poster: "assets/gallery/gv5_espace.jpg",     cap: "Planètes, étoiles & pastèque",           video: true },
    { src: "assets/gallery/g07_espace.jpg",     cap: "Navette & planètes — Espace" },
    { src: "assets/gallery/g26_ovni.jpg",       cap: "OVNI & planète" },
    { src: "assets/gallery/gv9_ovni.mp4",       poster: "assets/gallery/gv9_ovni.jpg",       cap: "OVNI & planètes sous le néon",         video: true },
    { src: "assets/gallery/g24_fusee.jpg",      cap: "Fusée orange" },
    { src: "assets/gallery/g25_avion.jpg",      cap: "Avion suspendu" },
    { src: "assets/gallery/gv4_arcenciel.mp4",  poster: "assets/gallery/gv4_arcenciel.jpg",  cap: "Arc-en-ciel, Pégase & papillons",              video: true },
    { src: "assets/gallery/g08_candyland.jpg",  cap: "Arche Candyland" },
    { src: "assets/gallery/g20_banane.jpg",     cap: "Bananes & sphères miroir" },
    { src: "assets/gallery/g09_californie.jpg", cap: "Combi VW — ambiance Flower Power" },
    { src: "assets/gallery/g10_tropical.jpg",   cap: "Arche perroquet & palmiers" },
    { src: "assets/gallery/g22_emojis.jpg",     cap: "Emojis géants en arc" },
    { src: "assets/gallery/g23_spiderman.jpg",  cap: "Arche Spider-Man & toiles lumineuses" },
    { src: "assets/gallery/g17_chats.jpg",      cap: "Chat du Cheshire & Aristochats" },
    { src: "assets/gallery/g21_chateau.jpg",    cap: "Arche château & boules miroir" },
    { src: "assets/gallery/gv6_noel.mp4",       poster: "assets/gallery/gv6_noel.jpg",       cap: "Cadeaux & étoiles de Noël",            video: true },
    { src: "assets/gallery/g18_noel.jpg",       cap: "Cadeaux, étoiles & sapins (Noël)" },
    { src: "assets/gallery/g19_paques.jpg",     cap: "Lapin géant & œufs dorés (Pâques)" },
    { src: "assets/gallery/g12_papillons.jpg",  cap: "Papillons fluo & lanternes" },
    { src: "assets/gallery/gv11_neon.mp4",      poster: "assets/gallery/gv11_neon.jpg",      cap: "« Ici, je t'aime » — papillons & lanternes", video: true },
    { src: "assets/gallery/g15_fluo.jpg",       cap: "Étoiles violettes devant la scène DJ" },
    { src: "assets/gallery/gv12_nuages.mp4",    poster: "assets/gallery/gv12_nuages.jpg",    cap: "Nuages, étoiles & avion",             video: true },
    { src: "assets/gallery/g14_lanternes.jpg",  cap: "Lanternes ethniques & toiles fluo" },
    { src: "assets/gallery/g11_noirblanc.jpg",  cap: "Bal noir & blanc" },
    { src: "assets/gallery/g13_rooftop.jpg",    cap: "Rooftop — chat porte-bonheur & lanternes" },
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
    galleryGrid.innerHTML = GALLERY.map((g, i) => `
      <button class="gal-item${g.video ? " is-video" : ""}" data-i="${i}" aria-label="${g.video ? "Lire la vidéo" : "Agrandir"} : ${g.cap}">
        <img src="${g.video ? g.poster : g.src}" alt="${g.cap}" loading="lazy" />
        ${g.video ? '<span class="gal-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>' : ""}
        <span class="gal-cap">${g.cap}</span>
      </button>`).join("");
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
