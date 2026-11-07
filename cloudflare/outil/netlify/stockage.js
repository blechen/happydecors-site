// Stockage des « Netlify Blobs » chez Cloudflare : un Durable Object (SQLite) par store.
//
// Pourquoi un Durable Object plutôt que KV ou R2 : les applis comptent sur la consistance forte
// de Netlify Blobs (lecture et liste immédiatement à jour après écriture) et sur les écritures
// conditionnelles (onlyIfNew / onlyIfMatch avec etag) pour leurs verrous et compteurs. Un Durable
// Object traite les opérations une par une, en transaction : ces garanties sont exactes, et
// Cloudflare garde 30 jours d'historique restaurable (point-in-time recovery).
//
// Les valeurs sont stockées en octets, découpées en morceaux de 1 Mo (limite SQLite : 2 Mo par
// ligne), ce qui permet aussi les fichiers binaires (CV des candidats).
import { DurableObject } from "cloudflare:workers";

const MORCEAU = 1024 * 1024;

export class StockageBlobs extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS blobs (
      cle TEXT PRIMARY KEY, etag TEXT NOT NULL, meta TEXT, taille INTEGER NOT NULL,
      morceaux INTEGER NOT NULL, maj INTEGER NOT NULL, etag_source TEXT)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS morceaux (
      cle TEXT NOT NULL, n INTEGER NOT NULL, octets BLOB NOT NULL, PRIMARY KEY (cle, n))`);
  }

  #ligne(cle) {
    return this.sql.exec("SELECT etag, meta, taille, morceaux, etag_source FROM blobs WHERE cle = ?", cle).toArray()[0] || null;
  }

  #octets(cle, n) {
    if (n === 1) return this.sql.exec("SELECT octets FROM morceaux WHERE cle = ? AND n = 0", cle).one().octets;
    const parties = this.sql.exec("SELECT octets FROM morceaux WHERE cle = ? ORDER BY n", cle).toArray();
    const total = parties.reduce((s, p) => s + p.octets.byteLength, 0);
    const out = new Uint8Array(total);
    let pos = 0;
    for (const p of parties) { out.set(new Uint8Array(p.octets), pos); pos += p.octets.byteLength; }
    return out.buffer;
  }

  lire(cle) {
    const l = this.#ligne(cle);
    if (!l) return null;
    return { octets: this.#octets(cle, l.morceaux), etag: l.etag, meta: l.meta ? JSON.parse(l.meta) : {} };
  }

  // Lecture groupée : un seul aller-retour pour toutes les lectures lancées ensemble
  lirePlusieurs(cles) {
    return cles.map((cle) => this.lire(cle));
  }

  metadonnees(cle) {
    const l = this.#ligne(cle);
    return l ? { etag: l.etag, meta: l.meta ? JSON.parse(l.meta) : {} } : null;
  }

  // options : { metadata, onlyIfNew, onlyIfMatch, etagSource } → { modified, etag }
  ecrire(cle, octets, options = {}) {
    const actuel = this.#ligne(cle);
    if (options.onlyIfNew && actuel) return { modified: false };
    if (options.onlyIfMatch !== undefined && (!actuel || actuel.etag !== options.onlyIfMatch)) return { modified: false };
    const etag = `"${crypto.randomUUID().replace(/-/g, "")}"`;
    const vue = new Uint8Array(octets);
    const n = Math.max(1, Math.ceil(vue.byteLength / MORCEAU));
    this.ctx.storage.transactionSync(() => {
      this.sql.exec("DELETE FROM morceaux WHERE cle = ?", cle);
      for (let i = 0; i < n; i++) {
        this.sql.exec("INSERT INTO morceaux (cle, n, octets) VALUES (?, ?, ?)", cle, i,
          vue.slice(i * MORCEAU, (i + 1) * MORCEAU));
      }
      this.sql.exec(`INSERT INTO blobs (cle, etag, meta, taille, morceaux, maj, etag_source)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (cle) DO UPDATE SET etag = excluded.etag, meta = excluded.meta, taille = excluded.taille,
          morceaux = excluded.morceaux, maj = excluded.maj, etag_source = excluded.etag_source`,
        cle, etag, options.metadata ? JSON.stringify(options.metadata) : null, vue.byteLength, n, Date.now(),
        options.etagSource ?? null);
    });
    return { modified: true, etag };
  }

  supprimer(cle) {
    this.ctx.storage.transactionSync(() => {
      this.sql.exec("DELETE FROM morceaux WHERE cle = ?", cle);
      this.sql.exec("DELETE FROM blobs WHERE cle = ?", cle);
    });
  }

  // Liste triée par clé, par pages ; « apres » = dernière clé de la page précédente
  lister(prefixe = "", apres = "", limite = 1000) {
    const fin = prefixe ? prefixe.slice(0, -1) + String.fromCharCode(prefixe.charCodeAt(prefixe.length - 1) + 1) : null;
    const lignes = this.sql.exec(
      `SELECT cle, etag, etag_source FROM blobs WHERE cle >= ? AND cle > ? ${fin ? "AND cle < ?" : ""} ORDER BY cle LIMIT ?`,
      ...(fin ? [prefixe, apres, fin, limite] : [prefixe, apres, limite])).toArray();
    return lignes;
  }

  // Diagnostic : où tourne cet objet (code d'aéroport Cloudflare) et combien de temps prend une requête
  async diagnostic() {
    const trace = await (await fetch("https://cloudflare.com/cdn-cgi/trace")).text();
    const t0 = Date.now();
    this.sql.exec("SELECT COUNT(*) FROM blobs").one();
    return { colo: (trace.match(/colo=(\w+)/) || [])[1], sqlMs: Date.now() - t0 };
  }

  // Effacement complet (copies d'essai à jeter)
  async effacerTout() {
    await this.ctx.storage.deleteAll();
    return true;
  }

  compter() {
    return this.sql.exec("SELECT COUNT(*) AS n, COALESCE(SUM(taille), 0) AS octets FROM blobs").one();
  }
}
