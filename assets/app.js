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

  const capOf = d => `${d.name}${d.qte ? " (" + d.qte + " disponibles)" : ""} — ${document.documentElement.classList.contains("np") ? "sur demande" : d.price > 0 ? d.price + "€" + (d.qte ? " l'unité" : "") + " / 48h" : "sur devis"}`;
  function mediaBadge(d) {
    const m = (typeof MEDIA !== "undefined" && MEDIA[d.id]) || {};
    const vids = (m.videos || []).concat(m.video ? [m.video] : []);
    const n = 1 + (m.photos ? m.photos.length : 0) + vids.length;
    if (n <= 1) return "";
    const play = vids.length ? '<svg class="mb-play" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>' : '';
    return `<span class="card-media" aria-hidden="true">${play}<svg class="mb-ph" viewBox="0 0 24 24"><path d="M9 4 7.8 5.6H5A1.8 1.8 0 0 0 3.2 7.4v9.2A1.8 1.8 0 0 0 5 18.4h14a1.8 1.8 0 0 0 1.8-1.8V7.4A1.8 1.8 0 0 0 19 5.6h-2.8L15 4Zm3 3.9a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6Z"/></svg>${n}</span>`;
  }

  const $ = sel => document.querySelector(sel);
  const fmtPrice = p => p > 0
    ? `${p}€ <small>/ 48h</small>`
    : `Sur devis`;

  // ---------- État ----------
  const PAGE = 24;
  let shown = PAGE;
  let activeU = "all";
  let query = "";
  const selected = new Set();

  // ---------- Éléments ----------
  const grid = $("#grid");
  const universGrid = $("#universGrid");
  const searchInput = $("#searchInput");
  const resultCount = $("#resultCount");
  const emptyMsg = $("#empty");

  // ======================================================
  //  UNIVERS : cartes + puces de filtre
  // ======================================================
  const counts = {};
  UNIVERSES.forEach(u => { counts[u.key] = DECORS.filter(d => inUniverse(d, u.key)).length; });

  // Un seul menu : bandeau de thèmes (tout par défaut, on touche un thème pour filtrer, on retouche pour tout revoir)
  const chip = (key, label, ph, count, color) => `<button class="uni-chip${activeU === key ? " on" : ""}" data-u="${key}" aria-pressed="${activeU === key}"${color ? ` style="--uc:${color}"` : ""}>${ph}<span class="uni-name">${label}</span><span class="uni-count">${count}</span></button>`;
  const stripHTML = () => chip("all", "Tous", '<span class="uni-chip-ph all">✨</span>', DECORS.length) +
    UNIS.map(u => chip(u.key, u.short || u.label, `<span class="uni-chip-ph"${UNI_BG[u.key] ? ` style="background-image:url('${UNI_BG[u.key]}')"` : ""}>${UNI_BG[u.key] ? "" : u.emoji}</span>`, counts[u.key] || 0, UCOLOR[u.key])).join("");
  universGrid.innerHTML = stripHTML();
  universGrid.addEventListener("click", e => {
    const btn = e.target.closest("[data-u]");
    if (!btn) return;
    setUniverse(btn.dataset.u === activeU ? "all" : btn.dataset.u);
  });

  const stripNext = $("#stripNext");
  const stripEdge = () => { const atEnd = universGrid.scrollLeft + universGrid.clientWidth >= universGrid.scrollWidth - 8; stripNext.hidden = atEnd; universGrid.parentElement.classList.toggle("at-end", atEnd); };
  stripNext.addEventListener("click", () => universGrid.scrollBy({ left: universGrid.clientWidth * 0.8, behavior: "smooth" }));
  universGrid.addEventListener("scroll", stripEdge, { passive: true });
  window.addEventListener("resize", stripEdge);
  setTimeout(stripEdge, 0);

  function setUniverse(u) {
    activeU = u;
    universGrid.querySelectorAll(".uni-chip").forEach(c => { const on = c.dataset.u === u; c.classList.toggle("on", on); c.setAttribute("aria-pressed", on); if (on) c.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }); });
    shown = PAGE;
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
          ${sizeText(d.id) ? `<span class="card-size">${sizeText(d.id)}</span>` : ""}
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
    grid.innerHTML = current.slice(0, shown).map(cardHTML).join("");
    const moreBtn = $("#moreBtn"), reste = current.length - shown;
    moreBtn.hidden = reste <= 0;
    moreBtn.textContent = `Voir plus de décors (${reste})`;
    const n = current.length;
    resultCount.textContent = n === DECORS.length
      ? `Plus de 150 décors disponibles`
      : `${n} décor${n > 1 ? "s" : ""} ${activeU !== "all" ? "· " + uLabel[activeU] : ""}`;
    emptyMsg.hidden = n > 0;
  }

  // Recherche
  searchInput.addEventListener("input", () => { query = searchInput.value; shown = PAGE; render(); });
  $("#moreBtn").addEventListener("click", () => { shown += PAGE; render(); });
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
    { src: "assets/gallery/gv53_wonderwoman_spiderman.mp4", poster: "assets/gallery/gv53_wonderwoman_spiderman.jpg", cap: "Super-héros au T7 : Wonder Woman, Spider-Man & étoiles en plein vol", video: true },
    { src: "assets/gallery/gv47_ovni_t7.mp4", poster: "assets/gallery/gv47_ovni_t7.jpg", cap: "Galaxy au T7 : soucoupe volante OVNI", video: true },
    { src: "assets/gallery/g38_poulpe.jpg", cap: "Poulpe rose géant au sol, salle du T7 en plein jour" },
    { src: "assets/gallery/gv41_montgolfiere.mp4", poster: "assets/gallery/gv41_montgolfiere.jpg", cap: "Glace géante au coucher du soleil", video: true },
    { src: "assets/gallery/g08_candyland.jpg",  cap: "Arche Candyland" },
    { src: "assets/gallery/g39_astronaute_salle.jpg", cap: "Astronaute géant en apesanteur au-dessus de la piste" },
    { src: "assets/gallery/gv58_pieuvre_sol.mp4", poster: "assets/gallery/gv58_pieuvre_sol.jpg", cap: "Pieuvre géante rose posée sur la piste du T7", video: true },
    { src: "assets/gallery/gv50_lune_astronaute_t7.mp4", poster: "assets/gallery/gv50_lune_astronaute_t7.jpg", cap: "Grande Lune & astronaute, salle prête au T7", video: true },
    { src: "assets/gallery/g45_plafond_blanc.jpg", cap: "Plafond de ballons géants blancs et étoiles, Bal en Blanc" },
    { src: "assets/gallery/gv48_navette_t7.mp4", poster: "assets/gallery/gv48_navette_t7.jpg", cap: "Navette spatiale au-dessus de la piste du T7", video: true },
    { src: "assets/gallery/gv32_ariel.mp4", poster: "assets/gallery/gv32_ariel.jpg", cap: "La Petite Sirène au T7", video: true },
    { src: "assets/gallery/g43_pegase_planetes.jpg", cap: "Pégase, planètes et boules colorées suspendus dans la salle" },
    { src: "assets/gallery/gv59_diable_eiffel.mp4", poster: "assets/gallery/gv59_diable_eiffel.jpg", cap: "Emoji diable géant face aux baies vitrées du T7", video: true },
    { src: "assets/gallery/g17_chats.jpg",      cap: "Chat du Cheshire & Aristochats" },
    { src: "assets/gallery/g42_dragon_or.jpg", cap: "Dragon doré géant face à la Tour Eiffel" },
    { src: "assets/gallery/gv38_marguerites.mp4", poster: "assets/gallery/gv38_marguerites.jpg", cap: "Marguerites géantes au coucher du soleil", video: true },
    { src: "assets/gallery/gv44_boules_arcenciel.mp4", poster: "assets/gallery/gv44_boules_arcenciel.jpg", cap: "Boules arc-en-ciel au crépuscule", video: true },
    { src: "assets/gallery/g44_arc_ciel_coeurs.jpg", cap: "Boule arc-en-ciel, cœurs rouges et diablotin géant" },
    { src: "assets/gallery/gv52_mer_sirene_requin.mp4", poster: "assets/gallery/gv52_mer_sirene_requin.jpg", cap: "Sous l'océan au T7 : baleine, dauphin, poisson-clown, Ariel & requin", video: true },
    { src: "assets/gallery/gv19_piscine_ballons.mp4", poster: "assets/gallery/gv19_piscine_ballons.jpg", cap: "Piscine de ballons au T7, vue sur la Tour Eiffel", video: true },
    { src: "assets/gallery/g46_ballons_blancs_salle.jpg", cap: "Salle prête : nuée de ballons blancs au-dessus de la piste" },
    { src: "assets/gallery/g06_paris.jpg",      cap: "Paris — Moulin Rouge & Tour Eiffel" },
    { src: "assets/gallery/gv10_baleine.mp4",   poster: "assets/gallery/gv10_baleine.jpg",   cap: "Baleine géante en vol",                video: true },
    { src: "assets/gallery/g48_coeur_ailes.jpg", cap: "Cœur ailé rouge et cœur violet face à la scène" },
    { src: "assets/gallery/gv56_spiderman_plongeon.mp4", poster: "assets/gallery/gv56_spiderman_plongeon.jpg", cap: "Spider-Man en plongeon au-dessus de la piste du T7", video: true },
    { src: "assets/gallery/gv33_pieuvre.mp4", poster: "assets/gallery/gv33_pieuvre.jpg", cap: "Pieuvre rose géante", video: true },
    { src: "assets/gallery/g49_levres_nuages.jpg", cap: "Lèvres, cœurs ailés, nuage bleu et étoile : décor Saint-Valentin" },
    { src: "assets/gallery/gv45_poisson_clown.mp4", poster: "assets/gallery/gv45_poisson_clown.jpg", cap: "Poisson-clown géant face à la Tour Eiffel", video: true },
    { src: "assets/gallery/g35_requin.jpg", cap: "Requin géant" },
    { src: "assets/gallery/g52_coeur_ailes_bleues.jpg", cap: "Cœur géant aux ailes bleues sous les projecteurs" },
    { src: "assets/gallery/g31_clown.jpg", cap: "Tête de clown géante (Halloween)" },
    { src: "assets/gallery/g23_spiderman.jpg",  cap: "Arche Spider-Man & toiles lumineuses" },
    { src: "assets/gallery/g55_etoiles_nuages.jpg", cap: "Étoiles et nuages blancs suspendus dans la salle" },
    { src: "assets/gallery/gv31_canopee_blanche.mp4", poster: "assets/gallery/gv31_canopee_blanche.jpg", cap: "Bal en Blanc : canopée de ballons blancs", video: true },
    { src: "assets/gallery/gv36_eclair.mp4", poster: "assets/gallery/gv36_eclair.jpg", cap: "Éclair géant", video: true },
    { src: "assets/gallery/g57_nuages.jpg", cap: "Nuage géant et ailes bleues au plafond" },
    { src: "assets/gallery/g19_paques.jpg",     cap: "Lapin géant & œufs dorés (Pâques)" },
    { src: "assets/gallery/g13_rooftop.jpg",    cap: "Rooftop — chat porte-bonheur & lanternes" },
    { src: "assets/gallery/g53_planetes_uv.jpg", cap: "Planètes et étoiles sous lumière noire, vue sur la Tour Eiffel" },
    { src: "assets/gallery/g01_tigre.jpg",      cap: "Arche Tigre face à la foule" },
    { src: "assets/gallery/gv1_mario.mp4",      poster: "assets/gallery/gv1_mario.jpg",      cap: "Mario, Spider-Man & nuages sous les lasers",                 video: true },
    { src: "assets/gallery/g54_lune_uv.jpg", cap: "Lune géante et planètes, ciel étoilé de Zodiac" },
    { src: "assets/gallery/g03_araignee.jpg",   cap: "Araignée géante & sa toile" },
    { src: "assets/gallery/g02_coeurs.jpg",     cap: "Arche de cœurs roses" },
    { src: "assets/gallery/g56_araignee_uv.jpg", cap: "Araignée géante dans sa toile sous lumière noire" },
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
    const items = [{ src: `assets/decors/${d.id}.jpg`, cap: capOf(d), h: sizeText(d.id) }];
    (m.photos || []).forEach(p => items.push({ src: `assets/decors/${p}`, cap: capOf(d) }));
    (m.video ? [m.video] : []).concat(m.videos || []).forEach(v => items.push({ src: `assets/decors/${v}`, cap: capOf(d), video: true }));
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
    lbCap.textContent = it.cap + (it.h ? ` · ${it.h}` : "") + (lbItems.length > 1 ? `  (${lbIndex + 1}/${lbItems.length})` : "");
  }
  // Balayage au doigt (mobile) : gauche = suivant, droite = précédent
  (function () {
    let x0 = null, y0 = 0;
    const fig = document.querySelector(".lightbox");
    fig.addEventListener("touchstart", e => { if (e.touches.length === 1) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; } }, { passive: true });
    fig.addEventListener("touchend", e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && e.target.tagName !== "VIDEO") moveLB(dx < 0 ? 1 : -1);
    }, { passive: true });
  })();
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
