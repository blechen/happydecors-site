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
    <button class="uni-card" data-u="${u.key}" style="--uc:${UCOLOR[u.key]}">
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

  function getFiltered() {
    const q = query.trim().toLowerCase();
    return DECORS.filter(d => {
      if (activeU !== "all" && d.u !== activeU) return false;
      if (q) {
        const hay = (d.name + " " + d.theme + " " + uLabel[d.u]).toLowerCase();
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
    const d = DECORS.find(x => x.id === id);
    const on = selected.has(id);
    btn.dataset.added = String(on);
    btn.textContent = on ? "✓ Ajouté à ma demande" : "+ Ajouter à ma demande";
  });

  function syncSelection() {
    selN.textContent = String(selected.size);
    selBar.hidden = selected.size === 0;
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
  const lb = $("#lightbox"), lbImg = $("#lbImg"), lbCap = $("#lbCap");
  let lbIndex = -1;

  function openLB(id) {
    lbIndex = current.findIndex(d => d.id === id);
    if (lbIndex < 0) return;
    showLB();
    lb.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function showLB() {
    const d = current[lbIndex];
    if (!d) return;
    lbImg.src = `assets/decors/${d.id}.jpg`;
    lbImg.alt = d.name;
    lbCap.textContent = `${d.name} — ${d.price > 0 ? d.price + "€ / 48h" : "sur devis"}`;
  }
  function moveLB(step) {
    if (!current.length) return;
    lbIndex = (lbIndex + step + current.length) % current.length;
    showLB();
  }
  function closeLB() { lb.hidden = true; document.body.style.overflow = ""; }

  grid.addEventListener("click", e => {
    const img = e.target.closest(".card-img");
    if (img) openLB(img.dataset.id);
  });
  grid.addEventListener("keydown", e => {
    const img = e.target.closest(".card-img");
    if (img && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openLB(img.dataset.id); }
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
  render();
})();
