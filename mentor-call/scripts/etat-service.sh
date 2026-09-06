#!/bin/bash
# Dit en une commande si l'app tourne, et depuis où.
RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ETIQUETTE="com.bryanmathys.mentor-call"
PORT="$(grep -E '^PORT=' "$RACINE/.env" 2>/dev/null | cut -d= -f2 | tr -d ' ' || true)"
PORT="${PORT:-3000}"

if launchctl print "gui/$(id -u)/$ETIQUETTE" >/dev/null 2>&1; then
  echo "Service au démarrage : installé"
else
  echo "Service au démarrage : non installé  (npm run service:install)"
fi

if curl -fsS "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
  echo "Serveur             : en marche → http://localhost:$PORT"
  curl -fsS "http://localhost:$PORT/api/health" | python3 -c "
import json,sys
d = json.load(sys.stdin)
c = d['config']
print('Compte Claude       :', 'connecté' if c['auth']['connecte'] else 'NON connecté')
print('Transcription       :', 'prête' if c['whisper']['pret'] else 'INCOMPLÈTE')
print('Calls en base       :', d['nb_calls'])
" 2>/dev/null
else
  echo "Serveur             : arrêté"
fi
