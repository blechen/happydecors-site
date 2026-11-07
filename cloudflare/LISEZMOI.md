# Dossier cloudflare/

Permet à Cloudflare de construire et servir ce site **tel que Netlify le faisait** (mêmes fonctions,
redirections, en-têtes, adresses). Généré par la migration Netlify → Cloudflare d'octobre 2026.

- `construire.sh` : commande de build de Workers Builds (build habituel du site + génération du Worker).
- `site.json` : réglages Cloudflare du site (nom du Worker, variables, fichiers non publiés…).
- `outil/` : l'adaptateur (ne pas modifier ici ; la source est dans le dossier de migration).
- Fichiers générés au build, non versionnés : `wrangler.jsonc`, `cloudflare/genere.mjs`,
  `cloudflare/worker.mjs`, `cloudflare/adaptateur/`.
