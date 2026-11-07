// Génère des pages d'atterrissage SEO par thème (mariage, Halloween, entreprise, anniversaire).
// Pages statiques réutilisant styles.css. À lancer avant déploiement.
import fs from "fs";
const g = {};
new Function("g", fs.readFileSync("assets/decors.js", "utf8") + ";g.DECORS=DECORS;g.UNIVERSES=UNIVERSES;g.inUniverse=inUniverse;")(g);
const { DECORS, UNIVERSES, inUniverse } = g;
const UCOLOR = Object.fromEntries(UNIVERSES.map(u => [u.key, u.color]));
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const byId = id => DECORS.find(d => d.id === id);
const byU = u => DECORS.filter(d => inUniverse(d, u));
const prixMin = Math.min(...DECORS.filter(d => d.price > 0).map(d => d.price));
const prixMax = Math.max(...DECORS.map(d => d.price));
const pick = (...ids) => ids.map(byId).filter(Boolean);
const uniq = arr => { const s = new Set(), o = []; for (const d of arr) if (d && !s.has(d.id)) { s.add(d.id); o.push(d); } return o; };

const PAGES = [
  {
    slug: "location-decors-gonflables-mariage-paris",
    cible: "votre mariage",
    title: "Décors gonflables pour mariage à Paris | Happy Décors",
    desc: "Arches, cœurs et décors gonflables géants à louer pour votre mariage à Paris. Effet waouh garanti, gonfleur fourni, retrait 75003. Demandez votre devis.",
    kicker: "Mariage",
    h1: "Des décors gonflables géants pour votre mariage",
    intro: "Une arche de cœurs à l'entrée, des nuages et des étoiles au-dessus de la piste, un photocall qui fait le tour des stories… Nos décors gonflables transforment votre mariage et marquent vos invités dès l'arrivée. Vous récupérez tout plié à Paris, le gonfleur est fourni.",
    decors: uniq([...byU("amour"), ...pick("DG_010","DG_009","DG_092","DG_042","DG_043","DG_058","DG_057","DG_011","DG_090")]),
    faq: [
      ["Combien coûte un décor gonflable pour un mariage ?", `Nos décors se louent à partir de ${prixMin} € les 48 h (petits décors) jusqu'à ${prixMax} € pour les plus grandes arches. On vous fait un devis précis selon votre sélection et votre lieu.`],
      ["Quand faut-il réserver ?", "Idéalement 3 à 4 semaines à l'avance, surtout pour les week-ends de mai à septembre qui partent vite."],
      ["Peut-on les installer dans un jardin ou en extérieur ?", "Oui, par météo favorable (ni pluie, ni vent fort). On vous conseille le lestage et l'ancrage adaptés."],
    ],
  },
  {
    slug: "location-decors-gonflables-halloween-paris",
    cible: "votre soirée Halloween",
    title: "Décors gonflables Halloween à louer à Paris | Happy Décors",
    desc: "Araignée géante, clown d'horreur, fantômes, maison hantée… Location de décors gonflables Halloween géants à Paris. Gonfleur fourni, devis en un message.",
    kicker: "Halloween",
    h1: "Décors gonflables géants pour Halloween",
    intro: "Une araignée de plusieurs mètres sur sa toile, un clown d'horreur suspendu, des fantômes au-dessus de la piste… De quoi donner des frissons à votre soirée Halloween. Pensez à réserver tôt : octobre est notre pic.",
    decors: uniq([...byU("halloween"), ...pick("DG_024","DG_057")]),
    faq: [
      ["Quels décors pour une soirée Halloween réussie ?", "L'araignée géante, la tête de clown « Ça », les fantômes, Dracula et la maison Psychose font un ensemble très impressionnant. On vous aide à composer selon votre lieu."],
      ["Quand réserver pour Halloween ?", "Dès septembre : les week-ends autour du 31 octobre sont très demandés."],
      ["Comment éclairer les décors en soirée ?", "Un projecteur suffit ; la plupart ont aussi un éclairage LED interne (E27) pour un rendu dramatique."],
    ],
  },
  {
    slug: "location-decors-gonflables-noel-paris",
    cible: "votre soirée de Noël ou du Nouvel An",
    title: "Décors gonflables de Noël à louer à Paris | Happy Décors",
    desc: "Sapins géants, cadeaux, étoiles, diamants : décors gonflables de Noël et du Nouvel An à louer à Paris. Gonfleur fourni, devis en un message.",
    kicker: "Noël & Nouvel An",
    h1: "Décors gonflables géants pour Noël et le Nouvel An",
    intro: "Des sapins géants, des cadeaux surdimensionnés, des étoiles et des diamants au plafond… Nos décors gonflables mettent tout de suite l'ambiance des fêtes dans votre soirée de Noël, d'entreprise ou entre amis, comme dans votre réveillon du Nouvel An. Vous récupérez tout plié à Paris, le gonfleur est fourni.",
    decors: uniq([...byU("noel"), ...pick("DG_057","DG_137","DG_042","DG_035","DG_036")]),
    faq: [
      ["Quels décors pour une soirée de Noël d'entreprise ?", "Les sapins géants et les cadeaux posent le décor dès l'entrée ; les étoiles, les lanternes et les diamants habillent le plafond et la piste. On vous aide à composer selon la taille de votre salle."],
      ["Quand réserver pour Noël et le Nouvel An ?", "Dès novembre : les soirées de fin d'année se concentrent sur les trois premières semaines de décembre et le 31."],
      ["Fournissez-vous un devis et une facture ?", "Oui, devis puis facture au nom de votre société ; l'installation sur place est possible sur devis."],
    ],
  },
  {
    slug: "location-arches-gonflables-paris",
    cible: "votre événement",
    title: "Location d'arches gonflables géantes à Paris | Happy Décors",
    desc: "Arche cœur, Candyland, château, dinosaure, Spider-Man… Location d'arches gonflables géantes à Paris pour l'entrée de vos événements. Gonfleur fourni.",
    kicker: "Arches gonflables",
    h1: "Des arches gonflables géantes pour l'entrée de votre événement",
    intro: "Une arche géante à l'entrée, et vos invités savent tout de suite dans quel univers ils entrent : cœur pour un mariage, château, Candyland, dinosaure, fantômes pour Halloween… Les plus grandes dépassent 5 mètres de haut et deviennent le photocall préféré de la soirée. Vous les récupérez pliées à Paris, le gonfleur est fourni.",
    decors: DECORS.filter(d => d.name.startsWith("Arche")),
    faq: [
      ["Combien coûte la location d'une arche gonflable ?", `De ${Math.min(...DECORS.filter(d => d.name.startsWith("Arche")).map(d => d.price))} € à ${Math.max(...DECORS.filter(d => d.name.startsWith("Arche")).map(d => d.price))} € les 48 h selon le modèle. On vous fait un devis précis selon votre sélection.`],
      ["Quelle hauteur font les arches ?", "Les plus grandes dépassent 5 mètres de haut. On vous donne les dimensions exactes de chaque arche avec le devis, pour vérifier qu'elle passe dans votre lieu."],
      ["Comment l'arche reste-t-elle gonflée ?", "Grâce au gonfleur électrique fourni, qui tourne pendant tout l'événement : une simple prise 220 V suffit."],
    ],
  },
  {
    slug: "location-decors-gonflables-evenement-entreprise-paris",
    cible: "votre événement",
    title: "Décors gonflables événements d'entreprise Paris | Happy Décors",
    desc: "Décors gonflables géants à louer pour vos soirées d'entreprise, lancements et séminaires à Paris. Devis et facture, gonfleur fourni, installation possible.",
    kicker: "Entreprise",
    h1: "Des décors gonflables géants pour vos événements d'entreprise",
    intro: "Soirée de fin d'année, lancement de produit, séminaire ou stand : nos décors géants créent l'effet waouh et font sortir les téléphones. Devis et facture, gonfleur fourni, installation possible sur demande.",
    decors: uniq([...DECORS.filter(d => d.featured), ...pick("DG_131","DG_063","DG_032","DG_108","DG_130","DG_008","DG_100","DG_098","DG_028")]),
    faq: [
      ["Fournissez-vous une facture et un devis ?", "Oui, devis puis facture au nom de votre société. Paiement à la remise du décor, ou 50 %/50 % avec installation."],
      ["Pouvez-vous installer sur place ?", "Oui, l'installation et le démontage sont possibles sur devis, avec sécurisation adaptée au public."],
      ["Peut-on associer plusieurs décors ?", "Oui : une arche à l'entrée et des décors suspendus au-dessus de la piste font un ensemble très efficace. Ajoutez-les à votre demande, on vous fait un devis global."],
    ],
  },
  {
    slug: "location-decors-gonflables-anniversaire-paris",
    cible: "votre anniversaire",
    title: "Décors gonflables pour anniversaire à Paris | Happy Décors",
    desc: "Décors gonflables géants à louer pour un anniversaire à Paris : 30, 40, 50 ans, soirées à thème. Effet waouh, gonfleur fourni, devis en un message.",
    kicker: "Anniversaire",
    h1: "Des décors gonflables géants pour un anniversaire inoubliable",
    intro: "30, 40, 50 ans ou soirée à thème : marquez le coup avec un décor géant. Candyland gourmand, héros pop, univers tropical ou rétro 90's… à vous de choisir l'ambiance.",
    decors: uniq([...byU("gourmandises").slice(0, 5), ...byU("heros").slice(0, 4), ...byU("contes").slice(0, 4), ...pick("DG_011","DG_069","DG_013","DG_046")]),
    faq: [
      ["Quel budget pour décorer un anniversaire ?", `De ${prixMin} € à ${prixMax} € par décor selon la taille. Un bel ensemble pour une salle tourne souvent autour de 300 à 600 €.`],
      ["Livrez-vous ou faut-il venir chercher ?", "Retrait rue du Temple (Paris 3ᵉ). Un envoi par colis est possible à votre charge."],
      ["Les décors tiennent-ils toute la soirée ?", "Oui, le gonfleur tourne en continu sur une simple prise 220 V."],
    ],
  },
];

const card = d => `
          <a class="card" href="/#catalogue" style="--cc:${UCOLOR[d.u]}">
            <div class="card-img">
              <span class="card-theme">${esc(d.theme)}</span>
              <img src="/assets/decors/${d.id}.jpg" alt="${esc(d.name)} — décor gonflable géant à louer à Paris (${esc(d.theme)})" loading="lazy" width="500" height="500" />
            </div>
            <div class="card-body">
              <h3 class="card-name">${esc(d.name)}</h3>
              ${d.qte ? `<span class="card-qte">${d.qte} disponibles</span>` : ""}<span class="card-price ${d.price > 0 ? "" : "devis"}">${d.price > 0 ? d.price + (d.qte ? "€ <small>l'unité · 48h</small>" : "€ <small>/ 48h</small>") : "Sur devis"}</span>
            </div>
          </a>`;

const wa = "https://wa.me/33669579840?text=Bonjour%20Happy%20D%C3%A9cors%2C%20je%20cherche%20un%20d%C3%A9cor%20pour...";

const page = p => `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(p.title)}</title>
  <meta name="description" content="${esc(p.desc)}" />
  <meta name="theme-color" content="#FF4D6D" />
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
  <link rel="canonical" href="https://happydecors.fr/${p.slug}/" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${esc(p.title)}" />
  <meta property="og:description" content="${esc(p.desc)}" />
  <meta property="og:image" content="https://happydecors.fr/assets/og.jpg" />
  <meta property="og:url" content="https://happydecors.fr/${p.slug}/" />
  <meta property="og:site_name" content="Happy Décors" />
  <meta property="og:locale" content="fr_FR" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Hanken+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/assets/styles.css" />
  <script type="application/ld+json">
  { "@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Happy Décors","item":"https://happydecors.fr/"},{"@type":"ListItem","position":2,"name":"${esc(p.kicker)}","item":"https://happydecors.fr/${p.slug}/"}] }
  </script>
  <script type="application/ld+json">
  { "@context":"https://schema.org","@type":"FAQPage","mainEntity":[${p.faq.map(([q, a]) => `{"@type":"Question","name":"${esc(q)}","acceptedAnswer":{"@type":"Answer","text":"${esc(a)}"}}`).join(",")}] }
  </script>
</head>
<body>
<header class="site-header" id="top">
  <div class="wrap header-inner">
    <a class="brand" href="/" aria-label="Happy Décors — accueil">
      <span class="brand-mark" aria-hidden="true"><span class="brand-balloon"></span></span>
      <span class="brand-text">Happy<span class="brand-accent">Décors</span></span>
    </a>
    <nav class="nav" aria-label="Navigation principale">
      <a href="/#catalogue">Tous les décors</a>
      <a href="/#realisations">Réalisations</a>
      <a href="/#faq">FAQ</a>
      <a href="/#contact">Contact</a>
    </nav>
    <a class="btn btn-primary header-cta" href="/#contact">Demander un devis</a>
  </div>
</header>
<main>
  <section class="hero">
    <div class="blob blob-1" aria-hidden="true"></div>
    <div class="blob blob-2" aria-hidden="true"></div>
    <div class="wrap hero-inner">
      <div class="hero-copy">
        <span class="eyebrow">${esc(p.kicker)} · Paris · depuis 2010</span>
        <h1 class="hero-title">${esc(p.h1)}</h1>
        <p class="hero-sub">${esc(p.intro)}</p>
        <div class="hero-cta">
          <a class="btn btn-primary btn-lg" href="/#contact">Demander un devis →</a>
          <a class="btn btn-ghost btn-lg" href="/#catalogue">Voir tous les décors</a>
        </div>
      </div>
    </div>
  </section>

  <section class="catalogue"><div class="wrap">
    <header class="section-head">
      <span class="kicker">Nos décors</span>
      <h2>Idées de décors pour ${esc(p.cible)}</h2>
      <p class="section-lead">Une sélection parmi nos plus de 100 décors gonflables. <a href="/#catalogue">Voir tout le catalogue →</a></p>
    </header>
    <div class="grid">${p.decors.map(card).join("")}
    </div>
  </div></section>

  <section class="faq"><div class="wrap">
    <header class="section-head">
      <span class="kicker">Questions fréquentes</span>
      <h2>Vos questions sur la location</h2>
    </header>
    <div class="faq-list">
      ${p.faq.map(([q, a]) => `<details class="faq-item"><summary>${esc(q)}</summary><div class="faq-a"><p>${esc(a)}</p></div></details>`).join("\n      ")}
    </div>
    <p class="faq-cta">Envie d'en savoir plus ? <a class="btn btn-primary" href="/#contact">Demandez votre devis →</a></p>
  </div></section>

  <section class="contact" id="contact"><div class="wrap contact-inner">
    <div class="contact-copy">
      <span class="kicker">Parlons-en</span>
      <h2>Dites-nous votre projet.</h2>
      <p class="contact-lead">Décrivez ${esc(p.cible)} et votre thème : on vous répond en un message avec les décors disponibles et un devis.</p>
      <a class="btn btn-whatsapp" href="${wa}" target="_blank" rel="noopener"><span aria-hidden="true">💬</span> Écrire sur WhatsApp</a>
      <p style="margin-top:14px"><a href="/#contact" class="btn btn-primary btn-lg">Remplir le formulaire</a></p>
    </div>
  </div></section>
</main>
<footer class="site-footer"><div class="wrap footer-inner">
  <div class="footer-brand"><span class="brand-text">Happy<span class="brand-accent">Décors</span></span>
    <p>Location de décors gonflables géants à Paris, depuis 2010.</p></div>
  <nav class="footer-nav" aria-label="Pied de page">
    <a href="/location-decors-gonflables-mariage-paris/">Mariage</a>
    <a href="/location-decors-gonflables-halloween-paris/">Halloween</a>
    <a href="/location-decors-gonflables-noel-paris/">Noël</a>
    <a href="/location-arches-gonflables-paris/">Arches</a>
    <a href="/location-decors-gonflables-evenement-entreprise-paris/">Entreprise</a>
    <a href="/location-decors-gonflables-anniversaire-paris/">Anniversaire</a>
    <a href="/#catalogue">Tous les décors</a>
    <a href="/mentions-legales.html">Mentions légales</a>
  </nav>
</div></footer>
<div class="mobile-cta">
  <a class="btn btn-primary" href="/#contact">Demander un devis</a>
  <a class="mcta-wa" href="${wa}" target="_blank" rel="noopener" aria-label="Écrire sur WhatsApp"><span aria-hidden="true">💬</span></a>
</div>
</body>
</html>`;

for (const p of PAGES) {
  fs.mkdirSync(p.slug, { recursive: true });
  fs.writeFileSync(`${p.slug}/index.html`, page(p));
  console.log("écrit:", p.slug, "(", p.decors.length, "décors )");
}

// sitemap complet, avec les images (Google Images)
const appJs = fs.readFileSync("assets/app.js", "utf8");
const galerie = [...appJs.matchAll(/src: "(assets\/gallery\/g\d+[^"]*\.jpg)"/g)].map(m => m[1]);
const imgDecor = d => `https://happydecors.fr/assets/decors/${d.id}.jpg`;
const entrees = [
  { loc: "https://happydecors.fr/", images: [...DECORS.map(imgDecor), ...galerie.map(g => "https://happydecors.fr/" + g)] },
  ...PAGES.map(p => ({ loc: `https://happydecors.fr/${p.slug}/`, images: p.decors.map(imgDecor) })),
];
const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${entrees.map(e => `  <url><loc>${e.loc}</loc><lastmod>${today}</lastmod>${e.images.map(i => `<image:image><image:loc>${i}</image:loc></image:image>`).join("")}</url>`).join("\n")}\n</urlset>\n`);
console.log("sitemap.xml mis à jour (", entrees.length, "URL,", entrees.reduce((n, e) => n + e.images.length, 0), "images )");
