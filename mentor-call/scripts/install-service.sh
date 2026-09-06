#!/bin/bash
# Installe Mentor Call comme service macOS : démarrage automatique à l'ouverture
# de session, et redémarrage tout seul en cas de plantage.
set -e

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ETIQUETTE="com.bryanmathys.mentor-call"
PLIST="$HOME/Library/LaunchAgents/$ETIQUETTE.plist"
NODE="$(command -v node)"
PORT="$(grep -E '^PORT=' "$RACINE/.env" 2>/dev/null | cut -d= -f2 | tr -d ' ' || true)"
PORT="${PORT:-3000}"

if [ -z "$NODE" ]; then
  echo "❌ Node introuvable. Installe Node 22.13 ou plus récent, puis relance."
  exit 1
fi

mkdir -p "$RACINE/data/logs" "$HOME/Library/LaunchAgents"

# Un serveur lancé à la main occuperait le port : on le laisse la place au service.
AUTRE="$(lsof -nP -iTCP:$PORT -sTCP:LISTEN -t 2>/dev/null | head -1 || true)"
if [ -n "$AUTRE" ]; then
  echo "→ Arrêt du serveur déjà lancé sur le port $PORT (PID $AUTRE)"
  kill "$AUTRE" 2>/dev/null || true
  sleep 1
fi

cat > "$PLIST" <<PLISTFIN
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$ETIQUETTE</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>--disable-warning=ExperimentalWarning</string>
    <string>$RACINE/server/index.js</string>
  </array>
  <key>WorkingDirectory</key><string>$RACINE</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>$RACINE/data/logs/serveur.log</string>
  <key>StandardErrorPath</key><string>$RACINE/data/logs/serveur-erreurs.log</string>
</dict>
</plist>
PLISTFIN

CIBLE="gui/$(id -u)"
launchctl bootout "$CIBLE/$ETIQUETTE" 2>/dev/null || true
launchctl bootstrap "$CIBLE" "$PLIST"
launchctl enable "$CIBLE/$ETIQUETTE"

printf "→ Démarrage"
for _ in $(seq 1 20); do
  if curl -fsS "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
    echo ""
    echo "✅ Mentor Call tourne sur http://localhost:$PORT"
    echo "   Il redémarrera tout seul à chaque ouverture de session."
    echo "   Journal : $RACINE/data/logs/serveur.log"
    exit 0
  fi
  printf "."
  sleep 0.5
done

echo ""
echo "⚠️  Le service est installé mais ne répond pas encore."
echo "   Regarde : tail -20 $RACINE/data/logs/serveur-erreurs.log"
exit 1
