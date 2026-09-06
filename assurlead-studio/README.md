# AssurLead & Network Studio

Copilote d'acquisition pour courtier en assurance — Vaud & Valais.
Streamlit, un seul fichier, données locales en SQLite.

## Fichiers

```
assurlead-studio/
├── app.py                      tout l'applicatif (6 modules + login + PWA)
├── requirements.txt            dépendances
├── .gitignore                  protège secrets.toml et data/
├── .streamlit/
│   ├── config.toml             thème sombre + réglages serveur
│   ├── secrets.toml.example    modèle — à copier
│   └── secrets.toml            TON mot de passe (jamais commité)
└── data/
    └── assurlead.db            base SQLite, créée au 1er lancement
```

## Lancer en local

Ton Python système est en 3.7, trop ancien pour Streamlit (3.9+ requis).
`uv` a été installé : il embarque son propre Python sans toucher au système.

```bash
cd ~/Downloads/assurlead-studio
cp .streamlit/secrets.toml.example .streamlit/secrets.toml   # mets ton mot de passe
.venv/bin/python -m streamlit run app.py
```

→ http://localhost:8501

Pour recréer l'environnement de zéro :

```bash
uv venv --python 3.12 && uv pip install -r requirements.txt
```

## Sur iPhone

**Même réseau Wi-Fi**, sans rien héberger :

```bash
.venv/bin/python -m streamlit run app.py --server.address 0.0.0.0
```

Streamlit affiche une *Network URL* (`http://192.168.x.x:8501`). Ouvre-la dans
Safari → bouton Partager → **Sur l'écran d'accueil**. L'app s'ouvre en plein
écran, sans barre d'adresse.

## Modules

| Module | Rôle |
| --- | --- |
| 📈 Dashboard | KPI, barre de progression vers le cap portefeuille, taux de conversion |
| ✉️ Approche digitale | E-mails + séquence LinkedIn 3 étapes, selon profil / canton / angle / ton |
| 📅 Événements | Annuaire réseau romand, filtres, suivi À venir / Inscrit / Effectué |
| 🎯 Playbook terrain | Icebreakers, pitch, objections, closing réseau |
| 📇 CRM express | Capture rapide post-rencontre, relances, export CSV |
| 📥 Import & base | CSV/Excel avec mapping auto, notes PDF/TXT, sauvegarde, dédoublonnage |

## Sécurité

- Verrou par mot de passe à l'ouverture, comparaison à temps constant (`hmac.compare_digest`).
- Mot de passe lu dans `st.secrets["APP_PASSWORD"]`, sinon la variable
  d'environnement `APP_PASSWORD`. Un mot de passe par défaut existe pour le
  premier lancement — l'app affiche un avertissement tant qu'il est actif.
- `.gitignore` exclut `secrets.toml` et `data/` : aucune donnée client ne part
  dans un dépôt.

**Ce verrou protège l'accès, pas le contenu du disque.** Le fichier
`data/assurlead.db` n'est pas chiffré : si la machine est partagée, active
FileVault (Réglages → Confidentialité et sécurité → FileVault).
