# Mentor Call

Superviseur IA personnel pour le terrain : je débriefe chaque RDV, l'app transcrit **en local**,
Claude analyse selon une grille de vente précise, et je récupère chaque jour une seule action
prioritaire pour le lendemain.

**Confidentialité** — tout vit sur cette machine : la base SQLite (`data/mentor.db`), l'audio et les
transcriptions. Seul le **texte** transcrit part vers l'API Anthropic, au moment où tu cliques sur
« Analyser ». L'audio ne quitte jamais le Mac.

---

## Installation

```bash
npm install
```

## Lancer l'app

### Toujours disponible (recommandé)

```bash
npm run service:install
```

Installe un service macOS (`launchd`) : l'app démarre **à chaque ouverture de session** et
**redémarre toute seule** si elle plante. Rien à lancer, jamais — `http://localhost:3000` répond en
permanence.

| Commande | Effet |
| --- | --- |
| `npm run service:status` | l'app tourne-t-elle ? compte Claude connecté ? whisper prêt ? |
| `npm run service:restart` | redémarrage immédiat (après un changement de code) |
| `npm run service:logs` | journal en direct |
| `npm run service:uninstall` | retire le démarrage automatique |

Journaux dans `data/logs/` (`serveur.log` et `serveur-erreurs.log`).

### Raccourci double-clic

**« Lancer Mentor Call.command »** à la racine du projet : double-clic dans le Finder → démarre le
serveur s'il dort, puis ouvre la page. Pratique même sans le service installé. Tu peux le glisser
dans le Dock ou en faire un alias sur le Bureau.

### À la main

```bash
npm start
```

→ http://localhost:3000. La base `data/mentor.db` est créée au premier lancement.
`npm run dev` relance le serveur à chaque modification de fichier.

## Moteur d'analyse : deux options

`MOTEUR_IA` dans `.env` décide par où passent les analyses. Bascule d'une ligne, aucun code à
toucher :

| Valeur | Chemin | Facturation |
| --- | --- | --- |
| `cli` (défaut) | CLI Claude Code (`~/.local/bin/claude`) | abonnement Claude |
| `api` | API Anthropic via le SDK | crédits d'API |

Dans les deux cas, le compte utilisé doit avoir soit des crédits, soit un abonnement couvrant
l'usage : le transport ne change pas la facturation. Avec `api`, la sortie JSON est garantie par
schéma côté serveur ; avec `cli`, elle est demandée dans le prompt puis extraite défensivement
(`extraireJson` dans `server/claude-cli.js`).

Modèle utilisé par le CLI : `CLAUDE_CLI_MODEL` (`sonnet` par défaut, `opus` pour une analyse plus
fine mais plus gourmande).

## Connexion à Claude — deux clics, aucun Terminal

Sur le tableau de bord, bloc « État du système » :

1. **Connecter mon compte Claude** → Claude s'ouvre dans ton navigateur
2. Tu te connectes, la page affiche un **code** → tu le colles dans le champ de l'app → **Valider**

C'est tout. Un lien **se déconnecter** apparaît ensuite au même endroit.

Sous le capot, l'app pilote `claude auth login --claudeai` (le CLI Claude Code, installé dans
`~/.local/bin/claude`) : le code d'autorisation ne sert qu'à être transmis au CLI, il n'est ni
stocké ni journalisé, et les identifiants restent gérés par Claude Code. La déconnexion nettoie
aussi le profil `ant` s'il en traîne un, car il masquerait l'abonnement.

**Piège à connaître** — si Claude Code est connecté via un profil « plateforme développeur »
(`~/.config/anthropic`), c'est ce profil qui gagne, et les requêtes sont facturées en crédits d'API
au lieu de l'abonnement. Le tableau de bord le détecte et affiche « Claude Code sur le mauvais
compte » : reconnecte-toi avec le bouton, il fait le ménage avant.

**Alternative** — pour passer par une clé d'API classique, mets `MOTEUR_IA=api` et
`ANTHROPIC_API_KEY` dans `.env` (clé sur https://console.anthropic.com/settings/keys).

### Transcription locale — déjà installée

whisper.cpp est compilé dans `vendor/whisper.cpp/` (binaire `main`) avec les modèles
`ggml-small.bin` et `ggml-base.bin`. Rien d'autre à installer : **ffmpeg n'est pas nécessaire**,
le navigateur produit directement du WAV 16 kHz mono.

Homebrew n'a pas servi (l'installation locale date de 2020 et ne connaît plus `whisper-cpp`) —
le binaire a été compilé depuis les sources, sans Metal (inutile sur un Mac Intel).

Pour recompiler après un `git clean` :

```bash
cd vendor/whisper.cpp && GGML_NO_METAL=1 make -j4
```

**Vitesse vs précision** — mesuré sur ce Mac (i7-8750H) :

| Modèle | Taille | Vitesse | Quand l'utiliser |
| --- | --- | --- | --- |
| `ggml-small.bin` (défaut) | 488 Mo | ~1× temps réel | débriefs où la précision compte |
| `ggml-base.bin` | 148 Mo | ~3× plus rapide | quand tu veux le texte tout de suite |

Pour basculer, change `WHISPER_MODEL` dans `.env` :

```bash
WHISPER_MODEL=vendor/whisper.cpp/models/ggml-base.bin
```

## Prérequis techniques

- **Node.js ≥ 22.13** — la base utilise le module natif `node:sqlite`, donc aucune dépendance
  native à compiler.
- macOS (testé sur Darwin 24) ; le serveur n'écoute que sur `127.0.0.1`.

## Structure

```
server/           serveur Express, base de données, appels API
  index.js        point d'entrée, routes montées, gestion d'erreurs
  db.js           SQLite : schéma, migrations, helpers, grille de pondération
  http.js         validation d'entrées et erreurs API
  analyze.js      appel Claude (sortie JSON garantie par schéma) + normalisation
  transcribe.js   pilotage de whisper.cpp, suivi de progression, purge de l'audio
  routes/         calls.js (CRUD + audio + analyse), daily.js, stats.js
public/           frontend vanilla (aucun build, chargement instantané)
  index.html      tableau de bord · record.html débrief · call-detail.html fiche analysée
  daily.html      point du jour · clients.html portefeuille · objectifs.html suivi mensuel
  js/api.js       client HTTP, libellés partagés, navigation (source unique)
  js/audio-wav.js conversion micro → WAV 16 kHz mono dans le navigateur
prompts/          prompts d'analyse, éditables sans toucher au code
vendor/           whisper.cpp compilé + modèles — jamais commité
data/             base SQLite + audio temporaire — jamais commité
```

## Le carnet des points à travailler

Chaque analyse verse ce qui a coincé dans un carnet, affiché **sur la page de débrief** — donc sous
les yeux au moment où tu prépares ou débriefes un RDV.

- **Regroupés par catégorie** : découverte, objections, closing, produit, rythme, why, courtier.
- Chaque point porte **la phrase à réutiliser telle quelle**, pas un conseil abstrait.
- Un point ne disparaît **qu'après 3 utilisations** (bouton « Utilisé »), pas une seule.
- S'il **ressort d'une analyse ultérieure**, son compteur repart à zéro et il est marqué
  « relevé N× » : c'est qu'il n'était pas acquis.
- Les doublons sont fusionnés automatiquement (comparaison des mots porteurs, seuil 0,45), donc le
  carnet ne gonfle pas à chaque analyse.

Réglages dans `server/points.js` : `REPETITIONS_PAR_DEFAUT` (3) et `SEUIL_DOUBLON`.

## Les grilles d'évaluation

Chaque call est noté sur **la grille de vente** (découverte, objections, closing, produit,
rythme — pondérée pour le score global) et sur une **grille secondaire « réflexe courtier »**
(comparaison marché, indépendance du conseil, vision portefeuille). La seconde n'entre pas dans
le score global : elle mesure les compétences que le métier de courtier exigera, pour les
construire dès maintenant.

S'y ajoute la méthode **Start With Why** (Sinek) : une note d'ancrage du POURQUOI (le client a-t-il
exprimé ce qu'il protège **avant** qu'on parle produit ?), un conseil propre au call, et une
question ouverte prête à poser au prochain RDV. C'est l'antidote direct à l'objection prix — une
prime n'est « chère » que si elle ne pèse contre rien.

Tout est défini dans `prompts/system-analysis.md`, éditable sans toucher au code.

## API

| Méthode | Route | Rôle |
| --- | --- | --- |
| GET | `/api/health` | état du serveur, de la base et de la configuration |
| POST | `/api/calls` | créer un call (mode obligatoire) |
| GET | `/api/calls` | liste filtrable (`statut`, `produit_vise`, `resultat`, `limit`) |
| GET | `/api/calls/:id` | détail complet |
| PATCH | `/api/calls/:id` | modifier contexte, transcript, « marqué comme travaillé » |
| DELETE | `/api/calls/:id` | supprimer |
| POST | `/api/calls/:id/audio` | envoyer un WAV → lance la transcription locale (renvoie un `job_id`) |
| GET | `/api/transcription/:jobId` | progression puis texte ; l'audio est supprimé dès la fin |
| GET | `/api/transcription/etat` | whisper est-il prêt (binaire + modèle) |
| POST | `/api/calls/:id/analyser` | analyse Claude → scores, points, action prioritaire |
| GET · POST · PATCH · DELETE | `/api/clients[/:id]` | fiches clients (le détail renvoie l'historique des calls) |
| GET | `/api/daily/:date?` | point du jour (défaut : aujourd'hui) |
| POST | `/api/daily/:date/generer` | synthèse Claude de la journée + action pour demain |
| PUT | `/api/daily/:date/mapro` | saisir la MAPRO du jour |
| GET | `/api/stats/overview` | KPI du tableau de bord (semaine, MAPRO, streak) |
| GET | `/api/stats/series?jours=30` | séries de scores pour les courbes |
| GET | `/api/stats/repartition` | performance par produit / type de client / résultat |
| GET · PUT | `/api/stats/objectifs[/:mois]` | objectifs mensuels |

### Règle MAPRO

Pour un jour donné, la saisie manuelle (`daily_summaries.mapro_jour`) fait autorité ; sans saisie,
l'app somme les montants des calls signés de ce jour. Pas de double comptage.
