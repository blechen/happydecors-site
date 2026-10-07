// Remplaçant de « @netlify/database » chez Cloudflare, branché par l'alias de wrangler.jsonc.
// La base est chez Neon (Postgres) ; le Worker s'y connecte par Hyperdrive (binding HYPERDRIVE),
// avec le pilote « pg », comme le faisait Netlify (driver « server »).
//
// Un Worker ne peut pas garder une connexion ouverte d'une requête à l'autre : chaque appel
// (requête HTTP, cron, message de file) reçoit son propre pool, créé à la première requête SQL
// et fermé à la fin de l'appel (voir avecBase, utilisé par le routeur). L'objet renvoyé par
// getDatabase() est une façade stable, que les applis peuvent garder en variable de module.
import pg from "pg";
import { env } from "cloudflare:workers";
import { contexteBase } from "./contexte-base.js";

export class MissingDatabaseConnectionError extends Error {
  constructor() {
    super("Aucune base configurée (binding HYPERDRIVE absent)");
    this.name = "MissingDatabaseConnectionError";
  }
}

export function getConnectionString() {
  const chaine = env.HYPERDRIVE?.connectionString || env.NETLIFY_DB_URL || env.DATABASE_URL;
  if (!chaine) throw new MissingDatabaseConnectionError();
  return chaine;
}

function poolCourant() {
  const etat = contexteBase.getStore();
  if (!etat) throw new Error("Base de données utilisée en dehors d'un appel (requête, cron ou file)");
  if (!etat.pool) {
    etat.pool = new pg.Pool({ connectionString: getConnectionString(), max: 5, idleTimeoutMillis: 0 });
    etat.pool.on("error", (e) => console.error("pool pg :", e.message));
  }
  return etat.pool;
}

const facade = {
  query: (...args) => poolCourant().query(...args),
  connect: () => poolCourant().connect(),
  end: async () => {}, // le cycle de vie est géré par avecBase
  on: () => facade,
};

export function getDatabase() {
  const connectionString = getConnectionString();
  return { driver: "server", pool: facade, connectionString, sql: undefined };
}
