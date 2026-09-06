# PROJET : Mentor Call — Superviseur IA pour Bryan Mathys

## 0. Contexte

Je suis Bryan Mathys, conseiller en assurance chez Zurich Assurance (agent d'agence, Suisse romande, région Villeneuve/Riviera). 10 mois d'expérience, 300 clients au portefeuille, AFA validé. Objectif : 4'000-5'000 CHF de MAPRO (commission) par mois dès septembre, puis devenir un des meilleurs conseillers de Suisse romande.

**Mon profil de vente actuel** :
- Closing fort (>80% sur renouvellements et certaines nouvelles affaires)
- Feeling client / relation = ma plus grande force
- Blocages : volume de RDV qualifiés insuffisant, gestion de l'objection prix sur les gros tickets, aisance PME encore limitée

Cette app doit devenir mon **superviseur et mentor personnel** : j'enregistre ou je débriefe chaque call/RDV, l'app transcrit, une IA (toi, Claude, via l'API) analyse selon une grille précise, et je reçois chaque jour un point clair avec ce qui a marché, ce qui a coincé, et une micro-action pour le lendemain. L'objectif : progression mesurable et rapide, pas du feedback vague.

**Construis cette app en local sur mon Mac. Elle doit tourner en autonomie, stocker toutes mes données en local (confidentialité clients obligatoire — aucune donnée client ne doit sortir de ma machine sauf l'appel à l'API Claude pour l'analyse), et être utilisable au quotidien sans friction.**

---

## 1. Vue d'ensemble fonctionnelle

Le cycle d'usage quotidien :

1. Après chaque RDV/call → j'ouvre l'app → je choisis **Débrief oral** (je parle 2-3 min dans le micro pour résumer l'échange) ou **Enregistrement** (si consentement obtenu)
2. L'app transcrit automatiquement (en local, pas de cloud tiers pour l'audio)
3. Je remplis un mini-formulaire contextuel (2-3 champs : type de client, produit visé, résultat)
4. L'app envoie la transcription + le contexte à l'API Claude avec un prompt d'analyse détaillé
5. Je reçois une **analyse structurée** immédiatement : scores par dimension, points forts, points à corriger, citations précises de ce que j'ai dit, suggestion de reformulation
6. En fin de journée → je consulte le **Point du jour** : synthèse de tous mes calls, tendance, une seule action prioritaire pour demain
7. Vue **hebdomadaire/mensuelle** : courbes de progression par compétence, corrélation avec ma MAPRO réelle (entrée manuelle), objectifs

---

## 2. Stack technique

- **Backend** : Node.js + Express (serveur local, port 3000)
- **Frontend** : HTML/CSS/JS vanilla ou React léger (Vite) — priorité simplicité et vitesse de chargement, pas de sur-ingénierie
- **Base de données** : SQLite (fichier local unique, `data/mentor.db`) — zéro serveur externe, tout reste sur ma machine
- **Transcription audio** : `whisper.cpp` ou `faster-whisper` en local (Python) — **pas d'API cloud pour l'audio brut**, confidentialité client absolue. Modèle recommandé : `small` ou `medium` (bon compromis vitesse/précision en français)
- **Analyse IA** : API Anthropic (Claude) — seul le **texte transcrit anonymisé si possible** est envoyé, jamais l'audio
- **Stockage clé API** : fichier `.env` local, jamais commité, ajouté au `.gitignore` dès l'init
- **Lancement** : un seul script `npm run start` qui lance backend + sert le frontend sur `http://localhost:3000`

Justification : tout en local = zéro dépendance à un service tiers pour mes données clients (obligation LPD), et l'app doit être utilisable même sans connexion sauf pour l'appel Claude d'analyse.

---

## 3. Structure de fichiers à créer

```
mentor-call/
├── CLAUDE.md                  (ce fichier)
├── .env.example
├── .gitignore
├── package.json
├── server/
│   ├── index.js               (serveur Express)
│   ├── db.js                  (init + requêtes SQLite)
│   ├── transcribe.js          (wrapper whisper local)
│   ├── analyze.js             (appel API Claude + parsing)
│   └── routes/
│       ├── calls.js
│       ├── daily.js
│       └── stats.js
├── public/
│   ├── index.html              (dashboard principal)
│   ├── record.html             (page enregistrement/débrief)
│   ├── call-detail.html        (vue détail d'un call analysé)
│   ├── daily.html               (point du jour)
│   ├── stats.html               (vue hebdo/mensuelle)
│   ├── css/style.css
│   └── js/
│       ├── recorder.js          (MediaRecorder API)
│       ├── dashboard.js
│       └── charts.js            (Chart.js pour les courbes de progression)
├── data/
│   ├── mentor.db                (créé au premier lancement)
│   └── recordings/              (fichiers audio temporaires, supprimés après transcription)
└── prompts/
    └── system-analysis.md       (le prompt d'analyse — voir section 7, à garder éditable séparément)
```

---

## 4. Modèle de données (schéma SQLite)

```sql
CREATE TABLE calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  mode TEXT NOT NULL,                    -- 'debrief' | 'enregistrement'
  client_type TEXT,                      -- 'portefeuille_existant' | 'nouveau_prospect' | 'recommandation'
  produit_vise TEXT,                     -- 'vie_3a' | 'pme' | 'non_vie' | 'bilan_general' | 'autre'
  resultat TEXT,                         -- 'signe' | 'a_relancer' | 'perdu' | 'rdv2_planifie'
  montant_mapro REAL,                    -- si signé, MAPRO généré (CHF)
  transcript TEXT,
  duree_secondes INTEGER,

  score_decouverte INTEGER,              -- 0-10
  score_objections INTEGER,              -- 0-10
  score_closing INTEGER,                 -- 0-10
  score_produit INTEGER,                 -- 0-10
  score_rythme INTEGER,                  -- 0-10
  score_global INTEGER,                  -- 0-10 (moyenne pondérée)

  points_forts TEXT,                     -- JSON array
  points_ameliorer TEXT,                 -- JSON array
  citations_precises TEXT,               -- JSON array {citation, commentaire, reformulation_suggeree}
  action_prioritaire TEXT,               -- 1 phrase, LA chose à corriger en priorité

  analyse_brute_json TEXT                -- réponse JSON complète de l'IA, pour audit/debug
);

CREATE TABLE daily_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT UNIQUE NOT NULL,
  nb_calls INTEGER,
  score_moyen_jour REAL,
  synthese TEXT,                         -- texte généré par l'IA
  action_demain TEXT,
  mapro_jour REAL
);

CREATE TABLE objectifs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mois TEXT,                             -- '2026-09'
  mapro_cible REAL,
  mapro_reel REAL,
  nb_rdv_cible INTEGER,
  nb_rdv_reel INTEGER
);
```

---

## 5. Fonctionnalités détaillées

### 5.1 Capture (deux modes)

**Mode Débrief (par défaut, recommandé)**
- Bouton unique "Débriefer ce call"
- J'enregistre 1-3 minutes où je résume à voix haute : profil client, ce que j'ai dit, ce qu'il a répondu, objections rencontrées, résultat
- Aucun problème légal — c'est ma propre voix, mes propres notes

**Mode Enregistrement (si consentement obtenu du client)**
- Bouton "Enregistrer un call" avec un rappel visuel obligatoire avant de démarrer : *"As-tu informé le client que cet échange est enregistré à des fins de qualité ?"* — case à cocher obligatoire avant que le bouton d'enregistrement ne s'active
- Utilise `MediaRecorder` API (navigateur) pour capter le micro Mac
- Fichier audio supprimé automatiquement après transcription réussie (seul le texte est conservé)

**Formulaire contextuel après capture (rapide, 4 champs max)** :
- Type de client (select)
- Produit visé (select)
- Résultat (select)
- MAPRO générée si signé (champ libre CHF)

### 5.2 Transcription locale

- Whisper local (`whisper.cpp` ou `faster-whisper`), modèle français
- Traitement asynchrone avec indicateur de progression ("Transcription en cours...")
- Transcript affiché et éditable avant envoi à l'analyse (je peux corriger une erreur de transcription)

### 5.3 Moteur d'analyse IA

- Bouton "Analyser" une fois le transcript validé
- Appel à l'API Claude avec le prompt système détaillé en section 7
- Résultat structuré en JSON, parsé et affiché dans une interface claire (voir 5.4)
- Temps de réponse affiché, retry automatique si erreur API

### 5.4 Vue détail d'un call analysé

Affichage en sections :
- Scores par dimension (barres visuelles 0-10) : Découverte / Gestion objections / Closing / Maîtrise produit / Rythme-écoute
- Score global
- 2-3 points forts (avec citation exacte extraite du transcript)
- 2-3 points à améliorer (avec citation exacte + reformulation suggérée par l'IA)
- Action prioritaire : UNE phrase, la chose la plus importante à corriger
- Bouton "Marquer comme travaillé" pour suivre si j'ai retenu la leçon

### 5.5 Point du jour (Daily)

Générée automatiquement en fin de journée (ou à la demande) :
- Nombre de calls analysés aujourd'hui
- Score moyen du jour + comparaison à la veille (↑↓)
- Synthèse texte : ce qui s'est bien passé, ce qui s'est répété comme problème
- **Une seule action pour demain** — pas une liste, UNE priorité claire
- MAPRO du jour saisie manuellement, cumul du mois affiché face à l'objectif

### 5.6 Vue hebdomadaire / mensuelle (Stats)

- Courbes de progression (Chart.js) : évolution de chaque score dans le temps
- Répartition par type de produit (où je suis fort/faible)
- Répartition par résultat (taux de signature réel calculé automatiquement depuis les données, pas déclaratif)
- Comparaison MAPRO réelle vs objectif mensuel
- Détection automatique de pattern : *"Tu perds le plus de points sur 'gestion objections' quand le produit visé est PME"* — l'app doit chercher ces corrélations simples dans les données stockées

### 5.7 Objectifs et suivi de progression

- Page pour définir mes objectifs mensuels (MAPRO cible, nb de RDV cible)
- Suivi automatique de l'écart
- Système de "streak" : nombre de jours consécutifs où j'ai débriefé au moins 1 call — gamification légère pour maintenir la discipline

---

## 6. La grille d'évaluation (à respecter strictement dans le prompt d'analyse)

Chaque call est noté sur 5 dimensions, 0 à 10 chacune :

**1. Découverte (0-10)**
- Le conseiller a-t-il posé des questions ouvertes avant de parler produit ?
- A-t-il exploré les projets de vie / peurs / projections du client (pas seulement les faits financiers) ?
- A-t-il fait quantifier le risque par le client lui-même plutôt que de l'affirmer ?
- A-t-il utilisé une structure proche du masque de découverte (situation familiale, financière, objectifs, couvertures actuelles) ?

**2. Gestion des objections (0-10)**
- Face à une objection (notamment prix), a-t-il appliqué la méthode 4 temps : Accueillir → Isoler → Requalifier → Recadrer ?
- A-t-il évité de défendre le prix frontalement ?
- A-t-il ramené la conversation sur le besoin/risque avant de reparler du prix ?
- A-t-il évité de céder immédiatement (rabais, produit dégradé sans requalification) ?

**3. Closing (0-10)**
- A-t-il demandé explicitement l'engagement ("Sur cette base, on peut avancer ?") ?
- A-t-il fixé une date précise de suivi si pas de closing immédiat (jamais de "je vous rappelle" vague) ?
- A-t-il demandé des recommandations en fin de signature ?
- A-t-il évité de laisser un silence gênant sans relance ?

**4. Maîtrise produit (0-10)**
- Les explications techniques (vie/3a/PME/non-vie) sont-elles exactes et claires ?
- A-t-il su répondre aux questions techniques du client sans hésitation ?
- A-t-il proposé une solution adaptée au profil (pas un produit générique) ?

**5. Rythme et écoute (0-10)**
- Ratio parole conseiller/client équilibré (viser 30/70 en faveur du client) ?
- Silences bien utilisés (pas de peur du silence après une question importante) ?
- A-t-il laissé le client terminer ses phrases sans couper ?

**Score global = moyenne pondérée** : Découverte 25%, Objections 20%, Closing 25%, Produit 15%, Rythme 15%

---

## 7. Prompt système pour l'analyse IA (fichier `prompts/system-analysis.md`)

Ce prompt doit être utilisé tel quel dans `server/analyze.js` lors de l'appel à l'API Claude. Le garder dans un fichier séparé pour pouvoir l'ajuster sans toucher au code.

```
Tu es le superviseur et mentor personnel de Bryan Mathys, conseiller en assurance chez Zurich Assurance en Suisse romande. Ton rôle est d'analyser la transcription d'un call ou RDV client (ou d'un débrief oral qu'il en a fait) et de produire une évaluation précise, honnête et actionnable — jamais complaisante, jamais dure gratuitement.

CONTEXTE SUR BRYAN :
- 10 mois d'expérience, closing fort (>80% sur renouvellements), feeling client excellent
- Objectif : 4'000-5'000 CHF de MAPRO/mois
- Points faibles connus : volume de RDV, gestion objection prix sur gros tickets, PME
- Il utilise une méthode de découverte structurée (situation familiale, financière, objectifs de vie, inventaire des couvertures) et une méthode de traitement d'objection en 4 temps (Accueillir / Isoler / Requalifier / Recadrer)

GRILLE D'ÉVALUATION — note chaque dimension de 0 à 10 :
1. Découverte : questions ouvertes, exploration émotionnelle/projective, quantification du risque par le client, structure complète
2. Gestion des objections : méthode 4 temps appliquée, pas de défense frontale du prix, retour au besoin avant le prix
3. Closing : demande d'engagement explicite, date de suivi fixée si pas de closing, demande de recommandation
4. Maîtrise produit : exactitude technique, clarté, adéquation au profil client
5. Rythme et écoute : ratio de parole, gestion des silences, absence de coupures de parole

INSTRUCTIONS :
- Base-toi UNIQUEMENT sur ce qui est dans la transcription. Ne suppose jamais ce qui n'est pas dit.
- Si le call est un débrief oral (pas une transcription mot à mot du client), adapte : évalue ce que Bryan rapporte avoir fait et dit, avec plus de prudence sur les scores car l'information est indirecte.
- Cite des passages EXACTS de la transcription pour justifier chaque point fort et chaque point à améliorer. Ne fais jamais de feedback vague sans preuve textuelle.
- Pour chaque point à améliorer, propose une reformulation concrète et immédiatement utilisable — pas de théorie, une phrase qu'il pourrait dire au prochain call.
- Sois direct et honnête sur les faiblesses, mais jamais dévalorisant. L'objectif est la progression rapide, pas le confort.
- Identifie UNE SEULE action prioritaire — la chose qui aura le plus d'impact sur sa MAPRO si elle est corrigée en premier. Ne dilue jamais avec une liste de 5 choses.

FORMAT DE RÉPONSE — réponds UNIQUEMENT en JSON valide, structure exacte :

{
  "score_decouverte": 0,
  "score_objections": 0,
  "score_closing": 0,
  "score_produit": 0,
  "score_rythme": 0,
  "score_global": 0,
  "points_forts": [
    {"citation": "...", "commentaire": "..."}
  ],
  "points_ameliorer": [
    {"citation": "...", "commentaire": "...", "reformulation_suggeree": "..."}
  ],
  "action_prioritaire": "Une phrase claire et actionnable pour le prochain call."
}
```

---

## 8. Le prompt pour la synthèse quotidienne (`server/routes/daily.js`)

À utiliser pour générer le "Point du jour" en agrégeant tous les calls analysés dans la journée :

```
Tu es le mentor quotidien de Bryan. Voici les analyses de tous ses calls/RDV d'aujourd'hui (scores et points clés de chaque call, format JSON en entrée).

Produis une synthèse courte et actionnable :
1. Un résumé en 2-3 phrases de la journée (tendance générale, pas un résumé call par call)
2. Le pattern le plus répété aujourd'hui (positif ou négatif) s'il y en a un
3. UNE SEULE action pour demain — la priorité absolue basée sur ce qui a eu le plus d'impact négatif aujourd'hui, ou à consolider si la journée a été bonne

Ton ton : direct, factuel, orienté action. Pas de motivation vide, pas de flatterie. Un mentor exigeant mais juste.

Réponds en JSON :
{
  "synthese": "...",
  "pattern_detecte": "...",
  "action_demain": "..."
}
```

---

## 9. Exigences UI/UX

- Interface en français, sobre, rapide (pas de framework lourd, chargement instantané)
- Palette : neutre/professionnelle (bleu foncé, gris, blanc) — cohérent avec un usage pro quotidien
- Mobile-friendly pour la page de débrief (utilisable depuis le téléphone via le navigateur si le Mac tourne en serveur sur le même réseau local — bonus, pas prioritaire v1)
- Dashboard principal = ce que je vois en premier : score moyen de la semaine, MAPRO du mois vs objectif, dernier "point du jour", bouton "Nouveau débrief" bien visible
- Aucune donnée envoyée à un tiers autre que l'API Anthropic pour le texte d'analyse — mentionner cette garantie explicitement dans l'app (footer ou page "Confidentialité")

---

## 10. Setup et premiers pas

Instructions à inclure dans un `README.md` généré automatiquement :

1. `npm install` à la racine
2. Copier `.env.example` en `.env`, renseigner `ANTHROPIC_API_KEY`
3. Installer whisper local (`pip install faster-whisper` ou binaire `whisper.cpp`) — documenter la méthode choisie
4. `npm run start` → app disponible sur `http://localhost:3000`
5. Premier lancement : la base SQLite se crée automatiquement dans `data/mentor.db`

---

## 11. Priorités de build (dans cet ordre)

1. Backend + DB + structure de base qui tourne
2. Capture audio + transcription locale fonctionnelle (tester avec un call de test)
3. Appel API Claude + parsing JSON + affichage résultat sur une page simple
4. Formulaire contextuel + stockage complet en DB
5. Dashboard principal + vue détail d'un call
6. Point du jour (agrégation quotidienne)
7. Vue stats hebdo/mensuelle avec graphiques
8. Polish UI, gamification (streaks), page confidentialité

**Construis et teste étape par étape, ne pas tout écrire d'un coup sans validation intermédiaire. Demande-moi de tester après chaque étape majeure avant de continuer.**

---

## 12. Roadmap V2 (à ne PAS construire maintenant, juste noter)

- Coaching en temps réel pendant l'appel (alertes discrètes)
- Intégration avec le CRM Zurich (si API disponible)
- Comparaison automatique avec les 300 clients du portefeuille (croiser calls et clients réels)
- Export mensuel PDF pour suivi personnel long terme
- Mode "simulation" : jouer un objection contre l'IA pour s'entraîner avant un vrai RDV
