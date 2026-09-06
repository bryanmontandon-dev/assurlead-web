#!/bin/bash
# Double-clique ce fichier pour ouvrir Mentor Call.
# S'il ne tourne pas déjà, il est démarré ; sinon on ouvre simplement la page.
RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$RACINE" || exit 1

PORT="$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2 | tr -d ' ' || true)"
PORT="${PORT:-3000}"
URL="http://localhost:$PORT"
ETIQUETTE="com.bryanmathys.mentor-call"

repond() { curl -fsS "$URL/api/health" >/dev/null 2>&1; }

if repond; then
  echo "Mentor Call tourne déjà."
else
  if launchctl print "gui/$(id -u)/$ETIQUETTE" >/dev/null 2>&1; then
    echo "Réveil du service…"
    launchctl kickstart -k "gui/$(id -u)/$ETIQUETTE" 2>/dev/null
  else
    echo "Démarrage du serveur…"
    mkdir -p data/logs
    nohup "$(command -v node)" --disable-warning=ExperimentalWarning server/index.js \
      >> data/logs/serveur.log 2>> data/logs/serveur-erreurs.log &
  fi

  printf "Attente"
  for _ in $(seq 1 20); do
    repond && break
    printf "."
    sleep 0.5
  done
  echo ""
fi

if repond; then
  echo "✅ Ouverture de $URL"
  open "$URL"
  sleep 1
else
  echo "❌ Le serveur n'a pas démarré."
  echo "   Dernières erreurs :"
  tail -12 data/logs/serveur-erreurs.log 2>/dev/null
  echo ""
  echo "Appuie sur Entrée pour fermer."
  read -r
fi
