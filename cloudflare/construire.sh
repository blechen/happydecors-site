#!/bin/bash
# Construction Cloudflare (Workers Builds) : même build que Netlify, puis génération du Worker
# à partir de netlify.toml (voir cloudflare/outil/generer.mjs). Ne pas modifier : généré par la
# migration (~/Downloads/migration-cloudflare/outils/paquet_depot.sh).
set -euo pipefail
cd "$(dirname "$0")/.."
export TZ=Europe/Paris
export COMMIT_REF="${WORKERS_CI_COMMIT_SHA:-$(git rev-parse HEAD 2>/dev/null || echo local)}"
true
node cloudflare/outil/generer.mjs . cloudflare/site.json
