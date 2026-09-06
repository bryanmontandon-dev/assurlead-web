#!/bin/bash
# Retire le démarrage automatique. L'app reste utilisable manuellement.
ETIQUETTE="com.bryanmathys.mentor-call"
PLIST="$HOME/Library/LaunchAgents/$ETIQUETTE.plist"

launchctl bootout "gui/$(id -u)/$ETIQUETTE" 2>/dev/null && echo "→ Service arrêté" || echo "→ Service déjà arrêté"
rm -f "$PLIST" && echo "✅ Démarrage automatique retiré."
echo "   Pour relancer l'app à la main : npm start (ou double-clic sur « Lancer Mentor Call.command »)"
