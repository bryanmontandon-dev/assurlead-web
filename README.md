# AssurLead & Network Studio

Copilote d'acquisition pour courtier en assurance — Vaud, Valais et Genève.
**Page web statique**, hébergeable sur GitHub Pages. Aucun serveur, aucune installation.

## Les 6 modules

| Module | Ce qu'il fait |
| --- | --- |
| 📈 Dashboard | KPI, relances dues, barre de progression vers le cap portefeuille |
| ✉️ Approche digitale | E-mails + séquence LinkedIn 3 étapes, selon profil / canton / angle / ton |
| 📅 Événements | Annuaire réseau romand pré-chargé (VD, VS, GE), filtres |
| 🎙️ Débrief & analyse | Dictée ou saisie, analyse locale sur la grille de vente, points à améliorer |
| 🎯 Playbook terrain | Icebreakers, pitch, objections, closing + **Start with Why** et **Ligne droite** |
| 📇 CRM express | Capture post-rencontre, relances, recherche, export CSV |
| 🎓 Training | 26 fiches (santé, prévoyance/vie, choses, PME, méthodes de vente) + quiz de 11 situations |
| 📥 Import & base | Import CSV avec mapping auto, notes texte, le fichier unique, dédoublonnage |

## Les deux méthodes

L'app est construite autour de deux cadres, présents dans le générateur de messages,
le playbook, l'analyse de débrief et le training :

- **Start with Why** (Sinek) — Pourquoi → Comment → Quoi. C'est l'antidote à l'objection
  prix : une prime n'est « chère » que si elle ne pèse contre rien.
- **La Ligne droite** (Belfort) — trois certitudes, qualification, bouclage, demande explicite.

⚠️ De la Ligne droite, l'app garde la **structure** et écarte explicitement les **leviers de
pression** (rareté fabriquée, amplification de la peur, insistance après un non) :
incompatibles avec un devoir de conseil, et contre-productifs sur un portefeuille qui vit
de renouvellements et de recommandations. Le marché suisse fournit de vraies échéances —
clôture fiscale du 3a, délai de résiliation LAMal : aucun besoin d'en inventer.
Cet avertissement figure dans l'app, onglet Playbook → Ligne droite.

## Le module Débrief — comment il analyse

L'app est **statique** : pas de serveur, donc aucun appel possible à une IA (il faudrait y
exposer une clé). L'analyse repose donc sur des **règles explicites** appliquées à la grille
de vente, dans `js/analyse.js` :

**Start with Why**
- position du POURQUOI par rapport au premier mot produit

**Ligne droite (Jordan Belfort)**
- risque chiffré par le client lui-même (qualification)
- certitude « toi » : as-tu dit quelque chose qui ne t'arrange pas ?
- certitude « ta méthode » : as-tu expliqué comment tu compares ?
- bouclage des objections vs passage en force
- demande d'engagement explicite et date précise

**Grille de vente**
- questions ouvertes comptées (découverte)
- défense frontale du prix vs retour au besoin
- ratio « je » / « vous », demande de recommandation

10 critères pondérés, groupés par méthode dans le résultat.

Moins nuancé qu'un modèle de langage, mais **reproductible, instantané, gratuit et hors
connexion**. Chaque point faible sort avec une phrase directement prononçable au prochain RDV.

⚠️ La dictée vocale du navigateur envoie ta voix aux serveurs d'Apple ou de Google.
Acceptable pour ton propre débrief, à ne jamais utiliser pour enregistrer un client.

## La base de données : un seul fichier

Tout tient dans **un objet JSON unique**. Au premier lancement, l'app demande
où le ranger — avant même le code d'accès.

### Option 1 — fichier lié (Chrome / Edge sur ordinateur)

Tu désignes `assurlead-base.json` dans ton dossier iCloud, et l'app **y écrit
toute seule** à chaque modification (écriture différée d'une seconde, pour ne
pas faire tourner iCloud en boucle). Rien à exporter à la main.

Le fichier de départ est déjà créé ici :

```
~/Library/Mobile Documents/com~apple~CloudDocs/AssurLead/assurlead-base.json
```

Il contient la structure vide et les 7 repères réseau romands.

### Option 2 — stockage de l'appareil (Safari, iPhone)

Safari n'implémente pas l'écriture directe dans un fichier, ni sur Mac ni sur
iPhone. Les données restent alors dans le navigateur, et tu les envoies vers
iCloud avec **Exporter** dans l'onglet *Import & base*. Sur iPhone, le fichier
téléchargé s'enregistre dans l'app **Fichiers**, où tu peux le déposer sur iCloud.

### Dans les deux cas

- **Réimporter** le fichier sur un autre appareil → tu retrouves tout.
- La fusion est **idempotente** : réimporter deux fois le même fichier ne crée
  aucun doublon.

⚠️ En option 2, vider les données de navigation efface la base. Exporte régulièrement.

## Le code d'accès

Demandé après le choix du stockage. **À la première ouverture, il est saisi
deux fois** — il n'est récupérable nulle part, donc autant éviter la faute de frappe.

## Confidentialité

La page est publique (GitHub Pages), **les données ne le sont pas** : elles ne
quittent jamais l'appareil, il n'existe aucun serveur pour les recevoir.

Le code d'accès protège l'ouverture sur ton téléphone. Sois lucide sur sa portée :
sur une page statique, il empêche un curieux d'ouvrir l'app, pas quelqu'un de
déterminé qui inspecterait le stockage du navigateur. La vraie protection reste
le verrouillage de ton iPhone.

## Mettre en ligne sur GitHub Pages

1. Crée un dépôt (`assurlead-web`), en **privé** si tu veux, et dépose les fichiers.
2. Dépôt → **Settings** → **Pages**.
3. *Source* : **Deploy from a branch** · Branche : **main** · Dossier : **/ (root)**.
4. **Save**. Après une à deux minutes, l'adresse s'affiche en haut de la page.

Note : sur un compte gratuit, un site Pages est **public** même depuis un dépôt privé.
Ce n'est pas un problème ici — le code n'a rien de secret, et tes données restent
sur ton appareil.

## Sur l'iPhone

Ouvre l'adresse dans Safari → bouton **Partager** → **Sur l'écran d'accueil**.
L'app s'ouvre en plein écran, sans barre d'adresse, et fonctionne **hors connexion**
une fois chargée.

## Tester en local

```bash
cd ~/Downloads/assurlead-web && python3 -m http.server 8600
```

→ http://localhost:8600 (l'ouverture directe du fichier ne marche pas : les
modules JavaScript exigent un serveur, même minimal).

## Fichiers

```
index.html              structure + verrou
style.css               thème sombre, cibles tactiles larges
manifest.webmanifest    icône et mode plein écran
icone-180.png           icône d'écran d'accueil
.nojekyll               empêche GitHub de filtrer les fichiers
js/donnees.js           le fichier unique : stockage, export, import, fusion
js/fichier.js           liaison au fichier iCloud (File System Access)
js/contenus.js          templates de messages, playbook, repères réseau
js/modules.js           les 6 modules
js/app.js               démarrage en 2 étapes, verrou, navigation
```
