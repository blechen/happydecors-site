/* ============================================================
   Happy Décors — catalogue
   Pour modifier : éditez ce fichier (nom, prix, univers) puis
   enregistrez. Le site se met à jour tout seul au déploiement.
   - price : en euros pour 48h, TOUJOURS à l'unité  (0 = "Sur devis")
   - qte   : nombre d'exemplaires disponibles (affiché « N disponibles » + « l'unité »)
   - u     : clé d'univers (voir UNIVERSES ci-dessous)
   - featured : true = mis en avant sur la page d'accueil
   - L'image attendue est : assets/decors/<id>.jpg
   ============================================================ */

const UNIVERSES = [
  // Occasions : triées automatiquement selon la prochaine date (la plus proche en premier)
  { key: "halloween",    label: "Halloween", short: "Halloween",                emoji: "🎃", color: "#FF7A1A", date: "10-31", bg: "assets/gallery/uni/g03_araignee.jpg" },
  { key: "noel",         label: "Noël & Nouvel An", short: "Noël",         emoji: "🎄", color: "#2BB673", date: "12-25", bg: "assets/gallery/uni/g18_noel.jpg" },
  { key: "asie",         label: "Nouvel An chinois", short: "Nouvel An chinois",        emoji: "🏮", color: "#DC2626", date: "02-01", bg: "assets/gallery/uni/g05_dragon.jpg" },
  { key: "amour",        label: "Mariage & Saint-Valentin", short: "Mariage", emoji: "💗", color: "#FF4D6D", date: "02-14", bg: "assets/gallery/uni/g02_coeurs.jpg" },
  { key: "paques",       label: "Pâques & Printemps", short: "Pâques",       emoji: "🐣", color: "#8DBF2E", date: "04-05", bg: "assets/gallery/uni/g19_paques.jpg" },
  { key: "ete",          label: "Été & Tropical", short: "Été",           emoji: "🌴", color: "#F2A900", date: "06-21", bg: "assets/gallery/uni/g10_tropical.jpg" },
  // Thèmes
  { key: "mer",          label: "Sous la mer", short: "Sous la mer",              emoji: "🐙", color: "#0EA5E9", bg: "assets/gallery/uni/g16_baleine.jpg" },
  { key: "animaux",      label: "Jungle & Animaux", short: "Animaux",         emoji: "🐯", color: "#14A38B", bg: "assets/gallery/uni/g01_tigre.jpg" },
  { key: "contes",       label: "Contes & Disney", short: "Contes & Disney",          emoji: "🏰", color: "#A855F7", bg: "assets/gallery/uni/g21_chateau.jpg" },
  { key: "heros",        label: "Super-héros & Jeux vidéo", short: "Super-héros", emoji: "⚡️", color: "#4F46E5", bg: "assets/gallery/uni/g23_spiderman.jpg" },
  { key: "espace",       label: "Espace", short: "Espace",                   emoji: "🚀", color: "#7B61FF", bg: "assets/gallery/uni/g07_espace.jpg" },
  { key: "gourmandises", label: "Gourmandises", short: "Gourmandises",             emoji: "🍭", color: "#FF6FB5", bg: "assets/gallery/uni/g08_candyland.jpg" },
  { key: "pop",          label: "Pop, Rétro & Disco", short: "Pop & Disco",       emoji: "🪩", color: "#E11D74", bg: "assets/gallery/uni/g22_emojis.jpg" },
  { key: "chic",         label: "Bal masqué & Glamour", short: "Glamour",     emoji: "🎭", color: "#334155", bg: "assets/gallery/uni/g11_noirblanc.jpg" },
  { key: "villes",       label: "Paris & Voyage", short: "Voyage",           emoji: "🗼", color: "#3B82F6", bg: "assets/gallery/uni/g06_paris.jpg" },
  { key: "ambiance",     label: "Ambiance & Déco", short: "Ambiance",          emoji: "✨", color: "#D946EF", bg: "assets/gallery/uni/g14_lanternes.jpg" },
];

// Un décor appartient à son univers principal (u) + éventuellement à d'autres (also)
function inUniverse(d, key) { return d.u === key || (d.also || []).includes(key); }

// Univers dans l'ordre d'affichage : occasions de la plus proche à la plus lointaine, puis thèmes.
// soon = occasion dans les 60 prochains jours.
function universesInOrder(today) {
  const t = today || new Date();
  const t0 = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
  const days = mmdd => {
    const [m, d] = mmdd.split("-").map(Number);
    let x = Date.UTC(t.getFullYear(), m - 1, d);
    if (x < t0) x = Date.UTC(t.getFullYear() + 1, m - 1, d);
    return Math.round((x - t0) / 864e5);
  };
  const occ = UNIVERSES.filter(u => u.date).map(u => ({ ...u, days: days(u.date) })).sort((a, b) => a.days - b.days);
  occ.forEach(u => { u.soon = u.days <= 60; });
  return occ.concat(UNIVERSES.filter(u => !u.date));
}

const DECORS = [
  { id: "DG_110", name: "American Horror Story", theme: "Halloween",    u: "halloween",    price: 50 },
  { id: "DG_108", name: "Araignée géante",       theme: "Animaux",      u: "animaux",      price: 250, also: ["halloween"] },
  { id: "DG_107", name: "Arc-en-ciel",           theme: "Ambiance",     u: "ambiance",     price: 50, also: ["paques", "contes", "pop"] },
  { id: "DG_106", name: "Arche Candyland",       theme: "Candyland",    u: "gourmandises", price: 300, featured: true },
  { id: "DG_105", name: "Arche Château",         theme: "Disney",       u: "contes",          price: 300 },
  { id: "DG_104", name: "Arche Cœur",            theme: "Amour",        u: "amour",        price: 300, featured: true },
  { id: "DG_103", name: "Arche Dinosaure",       theme: "Jurassic",     u: "animaux",          price: 350, featured: true },
  { id: "DG_100", name: "Arche Disney",          theme: "Disney",       u: "contes",          price: 350, featured: true },
  { id: "DG_102", name: "Arche Fantômes",        theme: "Halloween",    u: "halloween",    price: 300 },
  { id: "DG_101", name: "Arche Grèce",           theme: "Grèce",        u: "villes",       price: 300 },
  { id: "DG_099", name: "Arche Scream",          theme: "Halloween",    u: "halloween",    price: 300 },
  { id: "DG_098", name: "Arche Spiderman",       theme: "Super-Héros",  u: "heros",          price: 300 },
  { id: "DG_097", name: "Arche Tigre",           theme: "Animaux",      u: "animaux",      price: 300 },
  { id: "DG_096", name: "Arche Tropicale",       theme: "Tropical",     u: "ete",          price: 300, also: ["animaux"] },
  { id: "DG_095", name: "Arche Western",         theme: "Western",      u: "villes",       price: 300 },
  { id: "DG_093", name: "Avion",                 theme: "Voyage",       u: "villes",       price: 250 },
  { id: "DG_091", name: "Baleine",               theme: "Animaux",      u: "mer",      price: 250 },
  { id: "DG_089", name: "Banana Split",          theme: "Candyland",    u: "gourmandises", price: 50 },
  { id: "DG_088", name: "Banane géante",         theme: "Fruits",       u: "gourmandises", price: 180 },
  { id: "DG_033", name: "Bonbons M&M's",         theme: "Candyland",    u: "gourmandises", price: 130 },
  { id: "DG_087", name: "Bouche Kiss",           theme: "Amour",        u: "amour",        price: 50 },
  { id: "DG_074", name: "Bouteille Coca",        theme: "Plage & Été",  u: "ete",          price: 180, also: ["pop"] },
  { id: "DG_056", name: "Bouteille Mr. Propre",  theme: "Pop",          u: "pop",          price: 150 },
  { id: "DG_086", name: "Burger",                theme: "Fast Food",    u: "gourmandises", price: 50, also: ["pop"] },
  { id: "DG_084", name: "Cabine de plage",       theme: "Plage & Été",  u: "ete",          price: 150 },
  { id: "DG_085", name: "Cabine téléphonique",   theme: "Londres",      u: "villes",       price: 150 },
  { id: "DG_083", name: "Cadeaux de Noël",       theme: "Noël",         u: "noel",        price: 100 },
  { id: "DG_081", name: "Cerises 2D",            theme: "Fruits",       u: "gourmandises", price: 50 },
  { id: "DG_080", name: "Cerises 3D",            theme: "Fruits",       u: "gourmandises", price: 50 },
  { id: "DG_079", name: "Chat Aristochats",      theme: "Animaux",      u: "contes",      price: 180, also: ["animaux"] },
  { id: "DG_078", name: "Chat du Pays des Merveilles", theme: "Animaux", u: "contes",     price: 180, also: ["animaux"] },
  { id: "DG_077", name: "Chats photo",           theme: "Animaux",      u: "animaux",      price: 50 },
  { id: "DG_076", name: "Chauves-souris",        theme: "Halloween",    u: "halloween",    price: 50 },
  { id: "DG_075", name: "Chien",                 theme: "Animaux",      u: "animaux",      price: 180 },
  { id: "DG_012", name: "Chien Snoopy",          theme: "Pop",          u: "pop",          price: 180 },
  { id: "DG_072", name: "Cœur 2D",               theme: "Amour",        u: "amour",        price: 60 },
  { id: "DG_070", name: "Cœur 3D",               theme: "Amour",        u: "amour",        price: 50 },
  { id: "DG_073", name: "Cœur Diamant",          theme: "Amour",        u: "amour",        price: 50 },
  { id: "DG_071", name: "Cœur étoiles",          theme: "Amour",        u: "amour",        price: 50 },
  { id: "DG_069", name: "Combi Van VW",          theme: "Plage & Été",  u: "ete",          price: 180, also: ["pop"] },
  { id: "DG_067", name: "Couteau Halloween",     theme: "Halloween",    u: "halloween",    price: 150 },
  { id: "DG_031", name: "Décor New-York",        theme: "New-York",     u: "villes",       price: 150 },
  { id: "DG_066", name: "Décor Paris",           theme: "Paris",        u: "villes",       price: 160, also: ["chic"] },
  { id: "DG_065", name: "Diamants",              theme: "Glitter",      u: "chic",     price: 60, also: ["noel"] },
  { id: "DG_064", name: "Dracula",               theme: "Halloween",    u: "halloween",    price: 60 },
  { id: "DG_063", name: "Dragon chinois",        theme: "Asie",         u: "asie",       price: 250, featured: true },
  { id: "DG_062", name: "Dragon fantastique",    theme: "Animaux",      u: "contes",      price: 180 },
  { id: "DG_061", name: "Drapeaux olympiques",   theme: "Olympiques",   u: "villes",        price: 180 },
  { id: "DG_090", name: "Drapés pour bal",       theme: "Bal",          u: "chic",     price: 0, also: ["amour"] },
  { id: "DG_060", name: "Emojis",           theme: "Emojis",       u: "pop",          price: 50, qte: 5 },
  { id: "DG_058", name: "Étoiles blanches", theme: "Plafond",      u: "ambiance",     price: 50, qte: 4, also: ["noel", "amour", "espace"] },
  { id: "DG_059", name: "Étoiles filantes",      theme: "Ambiance",     u: "ambiance",     price: 50, also: ["noel", "espace"] },
  { id: "DG_057", name: "Étoiles violettes",theme: "Plafond",      u: "ambiance",     price: 50, qte: 4, also: ["espace"] },
  { id: "DG_047", name: "Flacon de pilules",     theme: "Pop",          u: "pop",          price: 100 },
  { id: "DG_055", name: "Flamants roses",        theme: "Tropical",     u: "ete",          price: 50, also: ["animaux"] },
  { id: "DG_054", name: "Flash",                 theme: "Super-Héros",  u: "heros",          price: 50 },
  { id: "DG_053", name: "Fleurs rampantes", theme: "Tropical",     u: "ete",          price: 150, qte: 4, also: ["paques"] },
  { id: "DG_052", name: "Fleurs sur tiges",      theme: "Tropical",     u: "ete",          price: 150, also: ["paques"] },
  { id: "DG_051", name: "Fraises 2D",            theme: "Fruits",       u: "gourmandises", price: 50 },
  { id: "DG_049", name: "Fusée Tintin",          theme: "Espace",       u: "espace",       price: 150 },
  { id: "DG_048", name: "Glace géante",          theme: "Candyland",    u: "gourmandises", price: 150, also: ["ete"] },
  { id: "DG_045", name: "Kangourou",             theme: "Animaux",      u: "animaux",      price: 80 },
  { id: "DG_042", name: "Lanternes baroques", theme: "Lanternes",  u: "chic",     price: 50, qte: 4, also: ["amour", "ambiance"] },
  { id: "DG_041", name: "Lanternes chinoises", theme: "Lanternes",u: "asie",     price: 20, qte: 40, also: ["ambiance"] },
  { id: "DG_043", name: "Lanternes ethniques",  theme: "Lanternes",u: "ambiance",     price: 60, qte: 9 },
  { id: "DG_040", name: "Lanternes à motifs",  theme: "Lanternes",u: "ambiance",     price: 50, qte: 12 },
  { id: "DG_039", name: "Lanternes de Noël",theme: "Noël",         u: "noel",        price: 50, qte: 4 },
  { id: "DG_038", name: "Lapin",                 theme: "Animaux",      u: "paques",      price: 180, also: ["animaux"] },
  { id: "DG_046", name: "Logo I Love 90's",      theme: "Rétro 90's",   u: "pop",          price: 60 },
  { id: "DG_016", name: "Maison Psychose",       theme: "Halloween",    u: "halloween",    price: 150 },
  { id: "DG_036", name: "Masque doré de carnaval", theme: "Bal masqué", u: "chic",     price: 130 },
  { id: "DG_035", name: "Masque vénitien",       theme: "Bal masqué",   u: "chic",     price: 150 },
  { id: "DG_032", name: "Navette spatiale NASA", theme: "Espace",       u: "espace",       price: 250 },
  { id: "DG_092", name: "Lanternes noir & blanc", theme: "Ambiance", u: "ambiance",   price: 50, qte: 8, also: ["halloween", "chic"] },
  { id: "DG_029", name: "Œufs de Pâques dorés", theme: "Pâques",   u: "paques",        price: 80, qte: 4 },
  { id: "DG_027", name: "Palmiers",              theme: "Plage & Été",  u: "ete",          price: 150 },
  { id: "DG_026", name: "Palmiers Surf",         theme: "Plage & Été",  u: "ete",          price: 150 },
  { id: "DG_025", name: "Panda",                 theme: "Animaux",      u: "animaux",      price: 80, also: ["asie"] },
  { id: "DG_024", name: "Papillons fluo UV",     theme: "Fluo",         u: "ambiance",     price: 20, also: ["paques"] },
  { id: "DG_001", name: "Pastèque",              theme: "Fruits",       u: "gourmandises", price: 100, also: ["ete"] },
  { id: "DG_023", name: "Pégase / Licorne ailée",theme: "Animaux",      u: "contes",      price: 250, featured: true },
  { id: "DG_021", name: "Phare marin",           theme: "Mer",          u: "mer",      price: 150 },
  { id: "DG_034", name: "Pharmacie",             theme: "Pop",          u: "pop",          price: 130 },
  { id: "DG_020", name: "Pikachu",               theme: "Pop",          u: "heros",          price: 80 },
  { id: "DG_017", name: "Grande Lune",           theme: "Espace",       u: "espace",       price: 130, also: ["halloween"] },
  { id: "DG_019", name: "Planètes (120 cm)", theme: "Espace",       u: "espace",       price: 50, qte: 2 },
  { id: "DG_018", name: "Planètes (150 cm)", theme: "Espace",       u: "espace",       price: 70, qte: 4 },
  { id: "DG_030", name: "Pot Nutella",           theme: "Candyland",    u: "gourmandises", price: 130 },
  { id: "DG_015", name: "Requin",                theme: "Mer",          u: "mer",      price: 150, also: ["ete"] },
  { id: "DG_014", name: "Sapins de Noël",   theme: "Noël",         u: "noel",        price: 150, qte: 2 },
  { id: "DG_022", name: "Sirène",                theme: "Mer",          u: "mer",      price: 150, also: ["contes"] },
  { id: "DG_013", name: "Smiley 90's",           theme: "Rétro 90's",   u: "pop",          price: 50 },
  { id: "DG_011", name: "Soleil",                theme: "Plage & Été",  u: "ete",          price: 180, featured: true },
  { id: "DG_028", name: "Soucoupe volante OVNI", theme: "Espace",       u: "espace",       price: 250, featured: true },
  { id: "DG_009", name: "Sphères avec drapé", theme: "Halloween",  u: "halloween",    price: 50, qte: 4 },
  { id: "DG_010", name: "Sphères miroir",  theme: "Disco",   u: "pop",     price: 40, qte: 10, also: ["noel", "chic", "ambiance"], horsLoc: true },
  { id: "DG_008", name: "Statue de la Liberté",  theme: "New-York",     u: "villes",       price: 180, featured: true },
  { id: "DG_007", name: "Sucettes Lollipop",     theme: "Candyland",    u: "gourmandises", price: 60 },
  { id: "DG_006", name: "Télécabine",            theme: "Montagne",     u: "villes",       price: 100, also: ["noel"] },
  { id: "DG_005", name: "Tortues",               theme: "Mer",          u: "mer",      price: 80, qte: 2, also: ["ete"] },
  { id: "DG_130", name: "Tour Eiffel",           theme: "Paris",        u: "villes",       price: 150, also: ["amour"], featured: true },
  { id: "DG_004", name: "Tour médiévale",        theme: "Fantastique",  u: "contes",          price: 120 },
  { id: "DG_003", name: "Triangles 90's",        theme: "Rétro 90's",   u: "pop",          price: 50 },
  { id: "DG_002", name: "Vespa",                 theme: "Italie",       u: "villes",       price: 150, also: ["ete"] },
  { id: "DG_094", name: "Voiture Austin Mini",   theme: "Londres",      u: "villes",       price: 250 },
  { id: "DG_000", name: "Wonder Woman",          theme: "Super-Héros",  u: "heros",          price: 60 },

  /* --- Nouveaux décors (commandes 2023-2025) --- */
  { id: "DG_131", name: "Pieuvre géante",        theme: "Animaux",      u: "mer",      price: 250, featured: true },
  { id: "DG_132", name: "Spider-Man en vol",     theme: "Super-Héros",  u: "heros",          price: 250 },
  { id: "DG_133", name: "Mario volant",          theme: "Pop",          u: "heros",          price: 220 },
  { id: "DG_135", name: "Astronaute",            theme: "Espace",       u: "espace",       price: 250, featured: true },
  { id: "DG_136", name: "Boules arc-en-ciel", theme: "Ambiance",   u: "ambiance",     price: 50, qte: 4, also: ["pop"] },
  { id: "DG_137", name: "Nuages",           theme: "Ambiance",     u: "ambiance",     price: 150, qte: 2, also: ["amour", "contes"] },
  { id: "DG_138", name: "Maneki-neko",           theme: "Asie",         u: "asie",       price: 150 },
  { id: "DG_140", name: "Tête de clown géante",  theme: "Halloween",    u: "halloween",    price: 220, featured: true },
  { id: "DG_142", name: "Cœur ailé",             theme: "Amour",        u: "amour",        price: 150 },
  { id: "DG_143", name: "Couronne royale",       theme: "Royauté",      u: "chic",     price: 150, also: ["contes"] },
  { id: "DG_144", name: "Poisson-clown géant",   theme: "Mer",          u: "mer",          price: 120, qte: 2, also: ["ete"] },
  { id: "DG_145", name: "Dauphins",              theme: "Mer",          u: "mer",          price: 100, qte: 2, also: ["ete"] },
  { id: "DG_146", name: "Marguerites géantes",   theme: "Printemps",    u: "paques",       price: 90, qte: 4, also: ["ete", "amour"] },
  { id: "DG_147", name: "Boules sucre d'orge",   theme: "Noël",         u: "noel",         price: 50, qte: 4, also: ["gourmandises"] },
].filter(d => !d.horsLoc); // horsLoc: true = momentanément plus en location (masqué partout, retirer la marque pour le remettre)
