// Contexte propre à chaque appel (requête HTTP, cron, message de file) : le pool Postgres de cet
// appel y est rangé par database.js et fermé à la fin par avecBase. Séparé de database.js pour que
// les sites sans base n'embarquent pas le pilote « pg ».
import { AsyncLocalStorage } from "node:async_hooks";

export const contexteBase = new AsyncLocalStorage();

// Exécute fn dans un contexte neuf ; renvoie [résultat, promesse de fermeture du pool éventuel]
export async function avecBase(fn) {
  const etat = { pool: null };
  try {
    const resultat = await contexteBase.run(etat, fn);
    return [resultat, etat.pool ? etat.pool.end().catch(() => {}) : Promise.resolve()];
  } catch (e) {
    if (etat.pool) etat.pool.end().catch(() => {});
    throw e;
  }
}
