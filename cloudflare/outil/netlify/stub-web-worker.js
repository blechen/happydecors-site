// Remplace « @eshaz/web-worker » (variante Web Worker des décodeurs audio, jamais utilisée ici) :
// sa version navigateur lit la globale « Worker » au chargement, absente des Workers Cloudflare.
export default class WebWorkerIndisponible {
  constructor() {
    throw new Error("Les Web Workers ne sont pas disponibles dans un Worker Cloudflare");
  }
}
