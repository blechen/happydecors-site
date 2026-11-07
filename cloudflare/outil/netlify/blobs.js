// Remplaçant de « @netlify/blobs » chez Cloudflare (même API, même comportement), branché par
// l'alias de wrangler.jsonc. Chaque store est un Durable Object StockageBlobs (voir stockage.js).
// Couvre ce que les applis utilisent : getStore, get, getWithMetadata, getMetadata, set, setJSON,
// delete, list (prefix, paginate, directories) ; écritures conditionnelles onlyIfNew / onlyIfMatch.
import { env } from "cloudflare:workers";
import { contexteBase } from "./contexte-base.js";

const encodeur = new TextEncoder();
const decodeur = new TextDecoder();

// Chaque store est un objet créé DANS L'UNION EUROPÉENNE (juridiction « eu », données personnelles
// = RGPD) et placé en Europe de l'Ouest, au plus près des utilisateurs et des Workers parisiens.
export function stub(nom, envX = env) {
  if (!envX.BLOBS) throw new Error("Stockage Blobs non configuré (binding BLOBS absent)");
  let ns;
  try {
    ns = envX.BLOBS.jurisdiction("eu");
  } catch (e) {
    // seul le simulateur local (tests) ne gère pas les juridictions ; en ligne, on refuse de continuer
    if (envX.ENV_LOCAL !== "1") throw e;
    ns = envX.BLOBS;
  }
  return ns.get(ns.idFromName(nom), { locationHint: "weur" });
}

// Les applis lisent souvent des centaines de clés d'un coup (Promise.all(list.map(get))). Chez
// Netlify chaque lecture est une requête HTTP parallèle ; ici, les lectures lancées dans le même
// tour de boucle sont regroupées en un seul appel au Durable Object (par paquets de 500).
// Regroupement propre à chaque appel (requête, cron…) : jamais de mélange entre deux requêtes.
function lireGroupe(nom, cle) {
  const appel = contexteBase.getStore();
  if (!appel) return stub(nom).lire(cle);
  appel.lectures ??= new Map();
  return new Promise((ok, ko) => {
    let file = appel.lectures.get(nom);
    if (!file) {
      file = [];
      appel.lectures.set(nom, file);
      setTimeout(() => envoyer(appel, nom), 0);
    }
    file.push({ cle, ok, ko });
  });
}
async function envoyer(appel, nom) {
  const file = appel.lectures.get(nom) || [];
  appel.lectures.delete(nom);
  for (let i = 0; i < file.length; i += 500) {
    const paquet = file.slice(i, i + 500);
    try {
      const res = paquet.length === 1 ? [await stub(nom).lire(paquet[0].cle)] : await stub(nom).lirePlusieurs(paquet.map((p) => p.cle));
      paquet.forEach((p, j) => p.ok(res[j]));
    } catch (e) {
      paquet.forEach((p) => p.ko(e));
    }
  }
}

async function versOctets(data) {
  if (typeof data === "string") return encodeur.encode(data).buffer;
  if (data instanceof ArrayBuffer) return data;
  if (ArrayBuffer.isView(data)) return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  if (data instanceof Blob) return data.arrayBuffer();
  if (data instanceof ReadableStream) return new Response(data).arrayBuffer();
  throw new TypeError("Type de donnée Blobs non pris en charge");
}

function convertir(octets, type) {
  switch (type) {
    case "arrayBuffer": return octets;
    case "blob": return new Blob([octets]);
    case "json": return JSON.parse(decodeur.decode(octets));
    case "stream": return new Response(octets).body;
    default: return decodeur.decode(octets);
  }
}

function verifierCle(cle) {
  if (typeof cle !== "string" || cle === "") throw new Error("Clé de blob invalide");
}

class Store {
  constructor(nom) { this.nom = nom; }

  async get(cle, options = {}) {
    verifierCle(cle);
    const r = await lireGroupe(this.nom, cle);
    return r ? convertir(r.octets, options.type) : null;
  }

  async getWithMetadata(cle, options = {}) {
    verifierCle(cle);
    const r = await lireGroupe(this.nom, cle);
    if (!r) return null;
    if (options.etag && options.etag === r.etag) return { data: null, etag: r.etag, metadata: r.meta };
    return { data: convertir(r.octets, options.type), etag: r.etag, metadata: r.meta };
  }

  async getMetadata(cle) {
    verifierCle(cle);
    const r = await stub(this.nom).metadonnees(cle);
    return r ? { etag: r.etag, metadata: r.meta } : null;
  }

  async set(cle, data, options = {}) {
    verifierCle(cle);
    if (options.onlyIfNew && options.onlyIfMatch !== undefined) throw new Error("onlyIfNew et onlyIfMatch sont exclusifs");
    return stub(this.nom).ecrire(cle, await versOctets(data), {
      metadata: options.metadata, onlyIfNew: !!options.onlyIfNew, onlyIfMatch: options.onlyIfMatch,
    });
  }

  setJSON(cle, data, options = {}) {
    return this.set(cle, JSON.stringify(data), options);
  }

  async delete(cle) {
    verifierCle(cle);
    await stub(this.nom).supprimer(cle);
  }

  async #toutes(prefixe) {
    const blobs = [];
    let apres = "";
    for (;;) {
      const page = await stub(this.nom).lister(prefixe, apres, 1000);
      for (const l of page) blobs.push({ key: l.cle, etag: l.etag });
      if (page.length < 1000) return blobs;
      apres = page[page.length - 1].cle;
    }
  }

  #regrouper(blobs, prefixe, dossiers) {
    if (!dossiers) return { blobs, directories: [] };
    const directories = new Set(), directs = [];
    for (const b of blobs) {
      const reste = b.key.slice(prefixe.length);
      const i = reste.indexOf("/");
      if (i === -1) directs.push(b);
      else directories.add(prefixe + reste.slice(0, i));
    }
    return { blobs: directs, directories: [...directories] };
  }

  list(options = {}) {
    const prefixe = options.prefix || "";
    const resultat = this.#toutes(prefixe).then((b) => this.#regrouper(b, prefixe, options.directories));
    if (!options.paginate) return resultat;
    return { async *[Symbol.asyncIterator]() { yield await resultat; } };
  }

  async deleteAll() {
    const tous = await this.#toutes("");
    for (const b of tous) await stub(this.nom).supprimer(b.key);
    return { deletedBlobs: tous.length };
  }
}

export function getStore(entree, options) {
  const nom = typeof entree === "string" ? entree : entree?.name;
  if (!nom) throw new Error("getStore : nom de store manquant");
  return new Store(nom);
}

export const getDeployStore = getStore;
export function connectLambda() {}
export function setEnvironmentContext() {}
export async function listStores() {
  throw new Error("listStores n'est pas disponible chez Cloudflare");
}
