#!/usr/bin/env bash
# =============================================================================
# Lance les tests d'isolement sur un PostgreSQL local jetable.
# Usage : bash supabase/tests/local/lancer_tests.sh
# Prérequis : PostgreSQL 15 ou plus récent installé (commandes initdb, pg_ctl, psql).
# Code de sortie 0 si tous les tests sont « OK », 1 sinon.
# =============================================================================
set -euo pipefail

RACINE="$(cd "$(dirname "$0")/../../.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
export PATH="$PGBIN:$PATH"

DOSSIER="$(mktemp -d)"
PORT="${PORT:-54329}"
trap 'pg_ctl -D "$DOSSIER/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DOSSIER"' EXIT

# PostgreSQL refuse de tourner en tant que root : on utilise alors l'utilisateur « postgres ».
EXEC=()
if [ "$(id -u)" = "0" ]; then
  chown -R postgres "$DOSSIER" 2>/dev/null || true
  chmod 755 "$DOSSIER"
  EXEC=(runuser -u postgres --)
fi

"${EXEC[@]}" initdb -D "$DOSSIER/data" -U postgres --auth=trust --encoding=UTF8 --locale=C.UTF-8 >/dev/null
"${EXEC[@]}" pg_ctl -D "$DOSSIER/data" -o "-p $PORT -k $DOSSIER -c listen_addresses=''" -l "$DOSSIER/log" -w start >/dev/null

PSQL=(psql -h "$DOSSIER" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)

echo "1. Imitation de Supabase"
"${PSQL[@]}" -f "$RACINE/supabase/tests/local/imitation_supabase.sql"
for f in "$RACINE"/supabase/migrations/*.sql; do
  echo "2. Migration $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
echo "3. Données de démonstration"
"${PSQL[@]}" -f "$RACINE/supabase/seed.sql"
echo "3 bis. Données de démonstration relancées (aucun doublon attendu)"
"${PSQL[@]}" -f "$RACINE/supabase/seed.sql"
echo "4. Tests"
RESULTATS="$("${PSQL[@]}" -P pager=off -f "$RACINE/supabase/tests/isolement.test.sql")"
echo "$RESULTATS"

TOTAL=$(echo "$RESULTATS" | grep -cE '^\s+[0-9]+ \| (OK|ÉCHEC)' || true)
ECHECS=$(echo "$RESULTATS" | grep -cE '^\s+[0-9]+ \| ÉCHEC' || true)
echo
if [ "$TOTAL" -gt 0 ] && [ "$ECHECS" -eq 0 ]; then
  echo "Résultat : $TOTAL tests, tous OK."
else
  echo "Résultat : $ECHECS échec(s) sur $TOTAL tests."
  exit 1
fi
