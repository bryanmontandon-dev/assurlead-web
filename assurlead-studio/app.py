"""
AssurLead & Network Studio
Copilote d'acquisition pour courtier en assurance — Vaud & Valais.

Un seul fichier, sections numérotées :
  1. Configuration & thème sombre
  2. PWA / iOS
  3. Base de données locale (SQLite)
  4. Authentification
  5. Module 1 — Générateur d'approche digitale
  6. Module 2 — Annuaire & agenda d'événements réseau
  7. Module 3 — Playbook terrain
  8. Module 4 — CRM mobile express
  9. Module 5 — Import & base de connaissances
 10. Module 6 — Dashboard & objectifs
 11. Navigation
"""

from __future__ import annotations

import hashlib
import hmac
import io
import json
import os
import sqlite3
from datetime import date, datetime, timedelta
from pathlib import Path

import pandas as pd
import streamlit as st

# =============================================================================
# 1. CONFIGURATION & THÈME
# =============================================================================

APP_NOM = "AssurLead & Network Studio"
RACINE = Path(__file__).parent
DOSSIER_DATA = RACINE / "data"
DOSSIER_DATA.mkdir(exist_ok=True)
CHEMIN_DB = DOSSIER_DATA / "assurlead.db"

CANTONS = ["Vaud", "Valais", "Toute la Suisse romande"]

st.set_page_config(
    page_title=APP_NOM,
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="collapsed",
)

CSS = """
<style>
  :root {
    --fond: #0C1116;
    --carte: #151C24;
    --carte-haut: #1C2530;
    --bord: #263241;
    --texte: #E8EDF2;
    --doux: #8FA3B8;
    --accent: #00C2A8;
    --chaud: #FF6B4A;
    --tiede: #FFB443;
    --froid: #6C8FB5;
  }

  /* Respiration réduite en haut : on gagne un écran sur mobile */
  .block-container { padding-top: 2.2rem; padding-bottom: 4rem; max-width: 1180px; }
  #MainMenu, footer { visibility: hidden; }

  h1, h2, h3 { letter-spacing: -0.02em; }
  h1 { font-size: 1.65rem !important; }
  h2 { font-size: 1.25rem !important; margin-top: 0.4rem !important; }

  /* Cartes */
  .carte {
    background: var(--carte);
    border: 1px solid var(--bord);
    border-radius: 14px;
    padding: 18px 20px;
    margin-bottom: 14px;
  }
  .carte-accent { border-left: 3px solid var(--accent); }
  .etiquette {
    font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.09em;
    color: var(--doux); font-weight: 700; margin-bottom: 6px;
  }

  /* Puces d'état */
  .puce {
    display: inline-block; padding: 3px 10px; border-radius: 999px;
    font-size: 0.72rem; font-weight: 700; letter-spacing: 0.03em;
    border: 1px solid var(--bord); color: var(--doux); background: var(--carte-haut);
  }
  .puce-chaud { color: var(--chaud); border-color: #4A2A22; background: #241612; }
  .puce-tiede { color: var(--tiede); border-color: #4A3B1E; background: #241D10; }
  .puce-froid { color: var(--froid); border-color: #23364A; background: #121C26; }
  .puce-ok    { color: var(--accent); border-color: #16413B; background: #0E2320; }

  /* Boutons : larges, confortables au pouce */
  .stButton > button, .stDownloadButton > button, .stFormSubmitButton > button {
    width: 100%; border-radius: 10px; padding: 0.62rem 1rem;
    font-weight: 600; border: 1px solid var(--bord); min-height: 46px;
  }
  .stButton > button[kind="primary"], .stFormSubmitButton > button[kind="primary"] {
    background: var(--accent); color: #06231F; border: none;
  }

  /* Champs */
  .stTextInput input, .stTextArea textarea, .stDateInput input, .stNumberInput input {
    background: var(--carte) !important; border-radius: 10px !important;
    border: 1px solid var(--bord) !important; font-size: 16px !important; /* 16px = pas de zoom iOS */
  }

  /* Navigation par pastilles */
  div[role="radiogroup"] { gap: 8px !important; flex-wrap: wrap; }
  div[role="radiogroup"] label {
    background: var(--carte); border: 1px solid var(--bord); border-radius: 999px;
    padding: 9px 15px; margin: 0 !important; cursor: pointer; min-height: 44px;
    display: flex; align-items: center;
  }
  div[role="radiogroup"] label:has(input:checked) {
    border-color: var(--accent); background: #0E2320; color: var(--accent);
  }
  div[role="radiogroup"] label > div:first-child { display: none; }

  /* Métriques */
  div[data-testid="stMetric"] {
    background: var(--carte); border: 1px solid var(--bord);
    border-radius: 14px; padding: 15px 17px;
  }
  div[data-testid="stMetricLabel"] { color: var(--doux); }

  .stTabs [data-baseweb="tab"] { font-size: 0.92rem; padding: 9px 14px; }
  .aide { color: var(--doux); font-size: 0.86rem; line-height: 1.5; }

  @media (max-width: 640px) {
    .block-container { padding-left: 0.9rem; padding-right: 0.9rem; }
    h1 { font-size: 1.35rem !important; }
    .carte { padding: 15px 16px; }
  }
</style>
"""

# =============================================================================
# 2. PWA / iOS — « Sur l'écran d'accueil » en plein écran
# =============================================================================

def injecter_pwa() -> None:
    """
    Streamlit n'expose pas le <head> de la page. On y insère donc les balises
    Apple depuis un composant, via window.parent.document.

    Safari lit ces balises au moment où l'utilisateur touche « Sur l'écran
    d'accueil » : une injection à l'exécution suffit donc pour obtenir une
    Web App plein écran, sans barre d'adresse.
    """
    import streamlit.components.v1 as components

    # Icône : dégradé + bouclier, encodée en SVG pour rester dans un seul fichier.
    icone = (
        "data:image/svg+xml;utf8,"
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 180 180'>"
        "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>"
        "<stop offset='0%25' stop-color='%2300C2A8'/>"
        "<stop offset='100%25' stop-color='%23046B7A'/>"
        "</linearGradient></defs>"
        "<rect width='180' height='180' rx='40' fill='url(%23g)'/>"
        "<path d='M90 36l38 16v34c0 27-16 45-38 58-22-13-38-31-38-58V52z' "
        "fill='none' stroke='%2306231F' stroke-width='9' stroke-linejoin='round'/>"
        "<path d='M70 92l14 14 28-30' fill='none' stroke='%2306231F' "
        "stroke-width='11' stroke-linecap='round' stroke-linejoin='round'/>"
        "</svg>"
    )

    components.html(
        f"""
        <script>
        (function () {{
          try {{
            var tete = window.parent.document.head;
            if (!tete || window.parent.document.getElementById('pwa-assurlead')) return;

            var marqueur = window.parent.document.createElement('meta');
            marqueur.id = 'pwa-assurlead';
            marqueur.name = 'assurlead-pwa';
            marqueur.content = 'ok';
            tete.appendChild(marqueur);

            var metas = [
              {{name: 'apple-mobile-web-app-capable', content: 'yes'}},
              {{name: 'mobile-web-app-capable', content: 'yes'}},
              {{name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent'}},
              {{name: 'apple-mobile-web-app-title', content: 'AssurLead'}},
              {{name: 'theme-color', content: '#0C1116'}},
              {{name: 'viewport',
                content: 'width=device-width, initial-scale=1, viewport-fit=cover'}}
            ];
            metas.forEach(function (m) {{
              var existant = tete.querySelector('meta[name="' + m.name + '"]');
              if (existant) existant.remove();
              var balise = window.parent.document.createElement('meta');
              balise.name = m.name;
              balise.content = m.content;
              tete.appendChild(balise);
            }});

            [['apple-touch-icon', '{icone}'], ['icon', '{icone}']].forEach(function (paire) {{
              var lien = window.parent.document.createElement('link');
              lien.rel = paire[0];
              lien.href = paire[1];
              tete.appendChild(lien);
            }});

            window.parent.document.title = 'AssurLead Studio';
          }} catch (e) {{
            /* Navigateur qui refuse l'accès au parent : l'app reste utilisable. */
          }}
        }})();
        </script>
        """,
        height=0,
    )


# =============================================================================
# 3. BASE DE DONNÉES LOCALE (SQLite)
# =============================================================================

SCHEMA = """
CREATE TABLE IF NOT EXISTS prospects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cree_le TEXT NOT NULL,
    nom TEXT NOT NULL,
    prenom TEXT,
    entreprise TEXT,
    profession TEXT,
    canal TEXT,              -- Téléphone | LinkedIn | E-mail
    contact TEXT,
    evenement TEXT,
    interet TEXT,            -- Chaud | Tiède | À nourrir
    sujet TEXT,
    action_suivi TEXT,
    date_relance TEXT,
    canton TEXT,
    statut TEXT DEFAULT 'Nouveau',
    notes TEXT,
    source TEXT DEFAULT 'Saisie manuelle'
);

CREATE TABLE IF NOT EXISTS evenements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cree_le TEXT NOT NULL,
    nom TEXT NOT NULL,
    organisateur TEXT,
    date_event TEXT,
    heure TEXT,
    lieu TEXT,
    canton TEXT,
    type_event TEXT,         -- Réseau d'affaires | Afterwork ouvert | Salon pro | Sportif/associatif
    public_cible TEXT,
    cout TEXT,               -- Gratuit | Payant
    prix TEXT,
    statut TEXT,             -- À venir | Inscrit | Effectué
    url TEXT,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS activites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cree_le TEXT NOT NULL,
    type TEXT NOT NULL,      -- email | linkedin | evenement
    cible TEXT,
    detail TEXT
);

CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cree_le TEXT NOT NULL,
    nom_fichier TEXT NOT NULL,
    type TEXT,
    taille INTEGER,
    contenu TEXT
);

CREATE TABLE IF NOT EXISTS parametres (
    cle TEXT PRIMARY KEY,
    valeur TEXT
);
"""


@st.cache_resource
def connexion() -> sqlite3.Connection:
    """Connexion unique, partagée par toutes les pages (Streamlit relance le script à chaque clic)."""
    conn = sqlite3.connect(CHEMIN_DB, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    conn.commit()
    return conn


def executer(sql: str, params: tuple = ()) -> sqlite3.Cursor:
    """
    Exécute et valide. Le curseur est renvoyé OUVERT : l'appelant peut donc
    enchaîner un .fetchone(). (Le fermer ici rendrait le résultat illisible.)
    """
    conn = connexion()
    curseur = conn.execute(sql, params)
    conn.commit()
    return curseur


def lire(sql: str, params: tuple = ()) -> pd.DataFrame:
    return pd.read_sql_query(sql, connexion(), params=params)


def parametre(cle: str, defaut: str = "") -> str:
    ligne = executer("SELECT valeur FROM parametres WHERE cle = ?", (cle,)).fetchone()
    return ligne["valeur"] if ligne else defaut


def definir_parametre(cle: str, valeur: str) -> None:
    executer(
        "INSERT INTO parametres (cle, valeur) VALUES (?, ?) "
        "ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur",
        (cle, str(valeur)),
    )


def journaliser(type_activite: str, cible: str = "", detail: str = "") -> None:
    """Trace une action d'acquisition — c'est ce qui alimente les KPI du module 6."""
    executer(
        "INSERT INTO activites (cree_le, type, cible, detail) VALUES (?, ?, ?, ?)",
        (datetime.now().isoformat(timespec="seconds"), type_activite, cible, detail[:400]),
    )


def amorcer_evenements() -> None:
    """
    Pré-remplit l'annuaire avec les organisateurs réellement actifs en Suisse
    romande. Les dates sont volontairement laissées vides : elles changent tout
    le temps, à toi de les compléter depuis le site de chaque organisateur.
    """
    if executer("SELECT COUNT(*) AS n FROM evenements").fetchone()["n"] > 0:
        return

    organisateurs = [
        ("Événement CVCI (à dater)", "CVCI — Chambre vaudoise du commerce et de l'industrie",
         "Lausanne", "Vaud", "Réseau d'affaires", "Dirigeants, PME vaudoises", "Payant",
         "https://www.cvci.ch/agenda"),
        ("Rendez-vous FER Vaud (à dater)", "FER Vaud — Fédération des entreprises romandes",
         "Lausanne", "Vaud", "Réseau d'affaires", "Indépendants, patrons de PME", "Payant",
         "https://www.fervaud.ch"),
        ("Réunion hebdomadaire BNI (à dater)", "BNI Suisse romande",
         "Lausanne / Sion", "Toute la Suisse romande", "Réseau d'affaires",
         "Indépendants, artisans, professions libérales", "Payant", "https://bnisuisse.ch"),
        ("Événement CCIV (à dater)", "Chambre valaisanne de commerce et d'industrie",
         "Sion", "Valais", "Réseau d'affaires", "Entreprises valaisannes", "Payant",
         "https://www.cci-valais.ch"),
        ("Afterwork JCI (à dater)", "Jeune Chambre Internationale",
         "Lausanne / Sion", "Toute la Suisse romande", "Afterwork ouvert",
         "Jeunes actifs, entrepreneurs 18-40", "Gratuit", "https://www.jci.ch"),
        ("Salon des métiers et de la formation", "Salons — Beaulieu",
         "Lausanne", "Vaud", "Salon pro", "Jeunes en formation, premiers emplois", "Gratuit",
         "https://www.metiersformation.ch"),
        ("Foire du Valais", "Foire du Valais", "Martigny", "Valais", "Salon pro",
         "Grand public, PME régionales", "Payant", "https://www.foireduvalais.ch"),
        ("Afterwork club sportif local (à dater)", "Club sportif / association locale",
         "À définir", "Vaud", "Sportif / associatif", "Familles, actifs locaux", "Gratuit", ""),
    ]

    for nom, orga, lieu, canton, type_e, public, cout, url in organisateurs:
        executer(
            """INSERT INTO evenements
               (cree_le, nom, organisateur, date_event, heure, lieu, canton, type_event,
                public_cible, cout, prix, statut, url, notes)
               VALUES (?, ?, ?, '', '', ?, ?, ?, ?, ?, '', 'À venir', ?, ?)""",
            (datetime.now().isoformat(timespec="seconds"), nom, orga, lieu, canton,
             type_e, public, cout, url,
             "Repère pré-chargé : vérifie la prochaine date sur le site de l'organisateur."),
        )


# =============================================================================
# 4. AUTHENTIFICATION
# =============================================================================

MDP_DEFAUT = "assurlead2026"


def mot_de_passe_attendu() -> tuple[str, bool]:
    """Renvoie (mot de passe, est_le_defaut). Priorité : secrets > variable d'env > défaut."""
    try:
        if "APP_PASSWORD" in st.secrets:
            return str(st.secrets["APP_PASSWORD"]), False
    except Exception:
        pass  # aucun fichier secrets : cas normal en local
    depuis_env = os.environ.get("APP_PASSWORD")
    if depuis_env:
        return depuis_env, False
    return MDP_DEFAUT, True


def empreinte(texte: str) -> str:
    return hashlib.sha256(texte.encode("utf-8")).hexdigest()


def ecran_login() -> bool:
    """Affiche le verrou. Renvoie True si l'accès est ouvert."""
    if st.session_state.get("authentifie"):
        return True

    attendu, est_defaut = mot_de_passe_attendu()

    _, milieu, _ = st.columns([1, 2, 1])
    with milieu:
        st.markdown(
            "<div style='text-align:center;margin:8vh 0 22px'>"
            "<div style='font-size:2.6rem'>🛡️</div>"
            "<h1 style='margin:6px 0 2px'>AssurLead Studio</h1>"
            "<p class='aide'>Copilote d'acquisition — Vaud &amp; Valais</p>"
            "</div>",
            unsafe_allow_html=True,
        )

        with st.form("login"):
            saisie = st.text_input("Mot de passe", type="password", placeholder="••••••••")
            valider = st.form_submit_button("Déverrouiller", type="primary")

        if valider:
            # compare_digest : même temps de réponse quel que soit le mot de passe.
            if hmac.compare_digest(empreinte(saisie), empreinte(attendu)):
                st.session_state["authentifie"] = True
                st.rerun()
            else:
                st.error("Mot de passe incorrect.")

        if est_defaut:
            st.warning(
                "Mot de passe par défaut actif. Définis `APP_PASSWORD` dans "
                "`.streamlit/secrets.toml` (ou dans les Secrets de ton hébergeur) "
                "avant toute mise en ligne.",
                icon="⚠️",
            )
    return False


# =============================================================================
# 5. MODULE 1 — GÉNÉRATEUR D'APPROCHE DIGITALE
# =============================================================================

PROFILS = {
    "Indépendants / PME": {
        "contexte": "la couverture d'un indépendant se construit pièce par pièce, souvent dans l'urgence du lancement",
        "douleur": "perte de gain, LPP facultative et RC professionnelle sont rarement revues après la création",
        "levier": "une structure qui a grandi depuis la signature des contrats",
        "tutoiement": False,
    },
    "Jeunes actifs / Premier emploi": {
        "contexte": "le passage du statut d'étudiant au premier salaire change toute la donne assurance",
        "douleur": "on garde souvent la police héritée des parents, sans savoir ce qu'elle couvre vraiment",
        "levier": "un premier salaire, donc une première capacité d'épargne fiscalement déductible",
        "tutoiement": True,
    },
    "Familles": {
        "contexte": "une famille cumule vite six ou sept contrats souscrits à des moments différents",
        "douleur": "les doublons s'installent sans qu'on les voie, et les franchises ne suivent plus la réalité du foyer",
        "levier": "un budget mensuel où chaque centaine de francs compte",
        "tutoiement": False,
    },
    "Nouveaux résidents en Suisse": {
        "contexte": "l'arrivée en Suisse impose une affiliation LAMal dans un délai court, souvent décidée à la hâte",
        "douleur": "le premier choix est fait sans comparaison, et rarement réexaminé ensuite",
        "levier": "un système de santé et de prévoyance qui n'a d'équivalent nulle part ailleurs",
        "tutoiement": False,
    },
    "Frontaliers": {
        "contexte": "le droit d'option entre LAMal et CMU se joue une fois, et engage durablement",
        "douleur": "beaucoup découvrent après coup les conséquences du choix initial sur la famille et la retraite",
        "levier": "une situation à cheval sur deux systèmes, où personne ne conseille vraiment",
        "tutoiement": False,
    },
}

ANGLES = {
    "Audit & Optimisation des primes": {
        "objets": [
            "Vos primes {annee} : ce qui peut encore bouger",
            "10 minutes pour vérifier vos primes",
            "Doublons d'assurance : le point rapide",
        ],
        "promesse": "identifier les doublons et les couvertures devenues inutiles, puis chiffrer précisément ce que ça représente sur l'année",
        "preuve": "Dans la plupart des dossiers que je reprends, une part du budget assurance paie deux fois la même chose sans que personne ne l'ait remarqué.",
        "astuce": "Un réflexe simple : reprenez vos polices et cherchez la protection juridique. Elle est très souvent incluse dans le ménage ET souscrite à part.",
        "action": "un audit express de 10 minutes, en visio ou autour d'un café",
    },
    "Check-up Prévoyance / 3ème Pilier": {
        "objets": [
            "3e pilier : optimiser avant la clôture fiscale",
            "Votre 3a travaille-t-il vraiment pour vous ?",
            "Prévoyance : le point qu'on repousse toujours",
        ],
        "promesse": "faire le point sur votre 3e pilier : ce qu'il vous rapporte réellement, ce qu'il vous fait économiser d'impôt, et s'il est encore adapté à votre situation",
        "preuve": "Beaucoup de 3e piliers signés il y a quelques années ne correspondent plus du tout à la situation de leur titulaire — ni en montant, ni en structure.",
        "astuce": "Un 3a bancaire et un 3a d'assurance ne jouent pas le même rôle : le premier est souple, le second couvre le risque. Le bon choix dépend surtout de votre horizon.",
        "action": "un point de 20 minutes sur votre prévoyance, sans engagement",
    },
    "Deuxième avis indépendant": {
        "objets": [
            "Un deuxième regard sur vos contrats",
            "Votre couverture, vue par un courtier indépendant",
            "Deuxième avis : vos garanties tiennent-elles la route ?",
        ],
        "promesse": "poser un deuxième regard, neutre, sur ce que vous avez déjà — sans rien remplacer si tout est cohérent",
        "preuve": "Mon rôle n'est pas de vous vendre un contrat de plus. Sur une bonne partie des dossiers que j'examine, je confirme que ce qui est en place tient la route, et je le dis.",
        "astuce": "La vraie question à poser à son assureur : « qu'est-ce qui n'est PAS couvert dans ce contrat ? » La réponse est souvent plus instructive que la brochure.",
        "action": "un échange de 15 minutes pour regarder vos contrats ensemble",
    },
    "Transition professionnelle / LPP": {
        "objets": [
            "Changement de poste : et votre LPP ?",
            "Votre 2e pilier pendant la transition",
            "Nouveau job : les 3 points assurance à régler",
        ],
        "promesse": "sécuriser la transition : avoir libre passage, couverture perte de gain et prévoyance qui ne laissent pas de trou entre deux employeurs",
        "preuve": "Le changement d'employeur est le moment où les trous de couverture apparaissent — et on ne s'en aperçoit qu'au moment où on en a besoin.",
        "astuce": "Entre deux emplois, la couverture accident de l'ancien employeur ne dure qu'un temps limité. C'est le point que presque personne ne vérifie.",
        "action": "un point rapide de 15 minutes sur votre transition",
    },
}

TONS = {
    "Professionnel & Chaleureux": {
        "ouverture": "J'espère que vous allez bien.",
        "liaison": "Si le sujet vous parle,",
        "cloture": "Au plaisir d'échanger,",
        "vouvoiement": True,
    },
    "Direct & Synthétique": {
        "ouverture": "",
        "liaison": "Si ça vous intéresse,",
        "cloture": "Bien à vous,",
        "vouvoiement": True,
    },
    "Conseil & Pédagogique": {
        "ouverture": "Je me permets de vous écrire pour une raison précise.",
        "liaison": "Si vous voulez y voir plus clair,",
        "cloture": "Bien cordialement,",
        "vouvoiement": True,
    },
}


def zone_texte(canton: str) -> str:
    return "en Suisse romande" if canton == "Toute la Suisse romande" else f"dans le canton de {canton}"


def generer_email(profil: str, canton: str, angle: str, ton: str, prenom: str, signature: str) -> dict:
    p, a, t = PROFILS[profil], ANGLES[angle], TONS[ton]
    annee = date.today().year
    appel = f"Bonjour {prenom}," if prenom.strip() else "Bonjour,"

    if ton == "Direct & Synthétique":
        corps = f"""{appel}

Je suis courtier en assurance indépendant, actif {zone_texte(canton)}.

Je propose {a['promesse']}.

Concrètement : {a['action']}. Pas de présentation produit, pas de suite si ça ne vous apporte rien.

{t['liaison']} dites-moi simplement quel jour vous arrange.

{t['cloture']}
{signature}"""

    elif ton == "Conseil & Pédagogique":
        corps = f"""{appel}

{t['ouverture']} Je suis courtier en assurance indépendant {zone_texte(canton)}, et je constate régulièrement la même chose : {p['contexte']}.

{a['preuve']}

Ce que je vous propose n'est pas une offre : c'est {a['promesse']}. Vous repartez avec une vision claire de votre situation, que nous travaillions ensemble ensuite ou non.

Un point utile en attendant, que vous pouvez vérifier vous-même :
{a['astuce']}

{t['liaison']} je vous propose {a['action']}. Vous me dites ce qui vous arrange.

{t['cloture']}
{signature}"""

    else:  # Professionnel & Chaleureux
        corps = f"""{appel}

{t['ouverture']} Je suis courtier en assurance indépendant, basé {zone_texte(canton)}.

Je m'adresse à vous parce que {p['contexte']} — et que, dans ces situations, {p['douleur']}.

Mon travail consiste à {a['promesse']}. {a['preuve']}

{t['liaison']} je vous propose {a['action']}. Si tout est déjà en ordre, je vous le dirai simplement, et vous aurez au moins la confirmation que votre couverture tient.

{t['cloture']}
{signature}"""

    return {
        "objets": [o.format(annee=annee) for o in a["objets"]],
        "corps": corps,
    }


def generer_linkedin(profil: str, canton: str, angle: str, ton: str, prenom: str, signature: str) -> list[dict]:
    p, a = PROFILS[profil], ANGLES[angle]
    appel = prenom.strip() or "Bonjour"
    court = signature.split("\n")[0].strip() if signature.strip() else "Bryan"

    return [
        {
            "titre": "Message 1 — Demande de connexion (jour J)",
            "quand": "À l'envoi de l'invitation. Aucun pitch : on ouvre une porte, on ne vend rien.",
            "texte": (
                f"Bonjour {appel}, je développe mon réseau professionnel {zone_texte(canton)} "
                f"et votre parcours a retenu mon attention. Je suis courtier en assurance "
                f"indépendant — je serais ravi de suivre votre actualité. Bonne journée !"
            ),
        },
        {
            "titre": "Message 2 — Apport de valeur (J+3)",
            "quand": "3 jours après l'acceptation. On donne quelque chose d'utile, sans rien demander.",
            "texte": (
                f"Merci pour la connexion, {appel} !\n\n"
                f"Comme je partage régulièrement des repères concrets sur les assurances en Suisse, "
                f"en voici un qui revient souvent :\n\n"
                f"{a['astuce']}\n\n"
                f"Rien à vendre derrière — si ça peut vous éviter de payer pour rien, c'est déjà utile. "
                f"Bonne fin de semaine !"
            ),
        },
        {
            "titre": "Message 3 — Invitation naturelle (J+7)",
            "quand": "7 jours après le premier échange. On propose, on n'insiste pas. Sans réponse, on laisse vivre.",
            "texte": (
                f"Bonjour {appel}, j'espère que la semaine se passe bien.\n\n"
                f"Je me disais qu'un point rapide sur vos garanties pourrait vous intéresser : "
                f"{a['promesse']}.\n\n"
                f"Ça prend {a['action'].split(',')[0].replace('un ', '').replace('une ', '')} et "
                f"ça n'engage à rien — si votre couverture est déjà cohérente, je vous le dis et "
                f"on en reste là.\n\n"
                f"Dites-moi simplement si le sujet vous parle. Belle journée,\n{court}"
            ),
        },
    ]


def page_generateur() -> None:
    st.markdown("## ✉️ Générateur d'approche digitale")
    st.markdown(
        "<p class='aide'>Choisis ta cible et ton angle : les messages se construisent "
        "autour de la réalité du profil, pas d'un modèle générique.</p>",
        unsafe_allow_html=True,
    )

    with st.container():
        c1, c2 = st.columns(2)
        profil = c1.selectbox("Profil cible", list(PROFILS.keys()))
        canton = c2.selectbox("Canton / zone", CANTONS)

        c3, c4 = st.columns(2)
        angle = c3.selectbox("Angle stratégique", list(ANGLES.keys()))
        ton = c4.selectbox("Ton de communication", list(TONS.keys()))

        c5, c6 = st.columns(2)
        prenom = c5.text_input("Prénom du destinataire", placeholder="optionnel")
        signature = c6.text_input("Ta signature", value=parametre("signature", "Bryan"))
        if signature != parametre("signature", "Bryan"):
            definir_parametre("signature", signature)

    st.divider()
    onglet_mail, onglet_li = st.tabs(["📧 E-mail", "💼 LinkedIn — séquence 3 étapes"])

    with onglet_mail:
        mail = generer_email(profil, canton, angle, ton, prenom, signature)

        st.markdown("<div class='etiquette'>Objets — teste-les, garde celui qui ouvre</div>",
                    unsafe_allow_html=True)
        for objet in mail["objets"]:
            st.code(objet, language=None)

        st.markdown("<div class='etiquette'>Corps du message</div>", unsafe_allow_html=True)
        corps = st.text_area("Corps", mail["corps"], height=380, label_visibility="collapsed")

        c1, c2 = st.columns(2)
        if c1.button("✅ Marquer comme envoyé", key="mail_envoye"):
            journaliser("email", prenom or profil, f"{angle} · {canton}")
            st.success("Compté dans tes KPI du mois.")
        c2.download_button(
            "⬇️ Télécharger (.txt)",
            f"Objet : {mail['objets'][0]}\n\n{corps}",
            file_name=f"email_{angle[:18].replace(' ', '_')}.txt",
            mime="text/plain",
        )

    with onglet_li:
        st.markdown(
            "<p class='aide'>Trois temps, espacés. Si le message 3 reste sans réponse, "
            "on n'insiste pas : on garde le contact au chaud pour plus tard.</p>",
            unsafe_allow_html=True,
        )
        for i, msg in enumerate(generer_linkedin(profil, canton, angle, ton, prenom, signature)):
            st.markdown(f"<div class='etiquette'>{msg['titre']}</div>", unsafe_allow_html=True)
            st.markdown(f"<p class='aide'>{msg['quand']}</p>", unsafe_allow_html=True)
            st.text_area(msg["titre"], msg["texte"],
                         height=170 if i else 120, label_visibility="collapsed",
                         key=f"li_{i}")
            longueur = len(msg["texte"])
            if i == 0 and longueur > 300:
                st.warning(f"{longueur} caractères — LinkedIn limite la note de connexion à 300.")
            st.write("")

        if st.button("✅ Séquence lancée", key="li_envoye"):
            journaliser("linkedin", prenom or profil, f"{angle} · {canton}")
            st.success("Comptée dans tes KPI du mois.")


# =============================================================================
# 6. MODULE 2 — ANNUAIRE & AGENDA D'ÉVÉNEMENTS RÉSEAU
# =============================================================================

TYPES_EVENT = ["Réseau d'affaires", "Afterwork ouvert", "Salon pro", "Sportif / associatif"]
STATUTS_EVENT = ["À venir", "Inscrit", "Effectué"]


def page_evenements() -> None:
    st.markdown("## 📅 Annuaire & agenda réseau")
    amorcer_evenements()

    onglet_liste, onglet_ajout = st.tabs(["📋 Agenda", "➕ Ajouter un événement"])

    with onglet_liste:
        c1, c2, c3 = st.columns(3)
        f_canton = c1.multiselect("Canton", CANTONS, default=[])
        f_type = c2.multiselect("Type", TYPES_EVENT, default=[])
        f_cout = c3.multiselect("Coût", ["Gratuit", "Payant"], default=[])
        f_statut = st.multiselect("Statut", STATUTS_EVENT, default=[])

        df = lire("SELECT * FROM evenements ORDER BY (date_event = '') ASC, date_event ASC, nom ASC")

        if f_canton:
            df = df[df["canton"].isin(f_canton)]
        if f_type:
            df = df[df["type_event"].isin(f_type)]
        if f_cout:
            df = df[df["cout"].isin(f_cout)]
        if f_statut:
            df = df[df["statut"].isin(f_statut)]

        st.markdown(
            f"<p class='aide'>{len(df)} événement(s). Les repères pré-chargés n'ont pas de date : "
            "complète-la depuis le site de l'organisateur.</p>",
            unsafe_allow_html=True,
        )

        if df.empty:
            st.info("Aucun événement ne correspond à ces filtres.")
        else:
            for _, e in df.iterrows():
                classe = {"Inscrit": "puce-ok", "Effectué": "puce-froid"}.get(e["statut"], "")
                quand = f"{e['date_event']} {e['heure']}".strip() or "date à compléter"
                st.markdown(
                    f"""<div class='carte {"carte-accent" if e["statut"] == "Inscrit" else ""}'>
                      <div style='display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap'>
                        <strong>{e['nom']}</strong>
                        <span class='puce {classe}'>{e['statut']}</span>
                      </div>
                      <p class='aide' style='margin:6px 0 0'>
                        {e['organisateur']}<br>
                        📍 {e['lieu']} ({e['canton']}) &nbsp;·&nbsp; 🗓️ {quand}<br>
                        🏷️ {e['type_event']} &nbsp;·&nbsp; 💰 {e['cout']} {e['prix']}<br>
                        👥 {e['public_cible']}
                      </p>
                    </div>""",
                    unsafe_allow_html=True,
                )

                c1, c2, c3, c4 = st.columns(4)
                if e["url"]:
                    c1.link_button("🔗 Site", e["url"])
                if c2.button("✅ Inscrit", key=f"ins_{e['id']}"):
                    executer("UPDATE evenements SET statut = 'Inscrit' WHERE id = ?", (int(e["id"]),))
                    st.rerun()
                if c3.button("🏁 Effectué", key=f"eff_{e['id']}"):
                    executer("UPDATE evenements SET statut = 'Effectué' WHERE id = ?", (int(e["id"]),))
                    journaliser("evenement", e["nom"], e["lieu"])
                    st.rerun()
                if c4.button("🗑️", key=f"del_{e['id']}"):
                    executer("DELETE FROM evenements WHERE id = ?", (int(e["id"]),))
                    st.rerun()

    with onglet_ajout:
        with st.form("ajout_event", clear_on_submit=True):
            nom = st.text_input("Nom de l'événement *")
            orga = st.text_input("Organisateur", placeholder="CVCI, FER Vaud, BNI, club local…")

            c1, c2 = st.columns(2)
            d = c1.date_input("Date", value=date.today())
            h = c2.text_input("Heure", placeholder="18:30")

            c3, c4 = st.columns(2)
            lieu = c3.text_input("Lieu / ville")
            canton = c4.selectbox("Canton", CANTONS)

            c5, c6 = st.columns(2)
            type_e = c5.selectbox("Type", TYPES_EVENT)
            cout = c6.selectbox("Coût", ["Gratuit", "Payant"])

            c7, c8 = st.columns(2)
            prix = c7.text_input("Prix", placeholder="CHF 40.–")
            statut = c8.selectbox("Statut", STATUTS_EVENT)

            public = st.text_input("Public attendu", placeholder="Dirigeants de PME, jeunes actifs…")
            url = st.text_input("Lien", placeholder="https://")
            notes = st.text_area("Notes", placeholder="Qui je veux y croiser, ce que je prépare…")

            if st.form_submit_button("Ajouter à l'agenda", type="primary"):
                if not nom.strip():
                    st.error("Le nom de l'événement est obligatoire.")
                else:
                    executer(
                        """INSERT INTO evenements
                           (cree_le, nom, organisateur, date_event, heure, lieu, canton,
                            type_event, public_cible, cout, prix, statut, url, notes)
                           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                        (datetime.now().isoformat(timespec="seconds"), nom.strip(), orga.strip(),
                         d.isoformat(), h.strip(), lieu.strip(), canton, type_e, public.strip(),
                         cout, prix.strip(), statut, url.strip(), notes.strip()),
                    )
                    st.success(f"« {nom} » ajouté.")


# =============================================================================
# 7. MODULE 3 — PLAYBOOK D'APPROCHE TERRAIN
# =============================================================================

def page_playbook() -> None:
    st.markdown("## 🎯 Playbook terrain")
    st.markdown(
        "<p class='aide'>À relire dans la voiture avant d'entrer. L'objectif d'un événement "
        "n'est pas de vendre : c'est d'obtenir le droit de recontacter.</p>",
        unsafe_allow_html=True,
    )

    o1, o2, o3, o4 = st.tabs([
        "1 · Briser la glace", "2 · Le pitch", "3 · Objections", "4 · Closing réseau",
    ])

    with o1:
        st.markdown("### Cinq entrées en matière qui ne parlent pas de travail")
        st.markdown(
            "<p class='aide'>Une accroche réussie porte sur le lieu, le moment ou l'organisateur — "
            "jamais sur soi. On parle métier seulement quand l'autre le demande.</p>",
            unsafe_allow_html=True,
        )
        accroches = [
            ("Au buffet / bar", "« Vous avez testé quoi ? Je suis devant ça depuis deux minutes sans me décider. »",
             "Universel, léger, et ça oblige l'autre à répondre autre chose que oui ou non."),
            ("À une table debout", "« Je peux me poser ici ? Je ne connais presque personne ce soir, autant assumer. »",
             "L'aveu de ne connaître personne désarme complètement. Presque tout le monde est dans le même cas."),
            ("Sur l'organisateur", "« C'est votre première fois avec [organisateur] ? J'essaie de me faire une idée avant de m'engager sur l'année. »",
             "On se place en pair qui évalue, pas en vendeur qui prospecte."),
            ("Sur l'orateur", "« Ce qu'il a dit sur [sujet], vous le vivez comme ça dans votre secteur ? »",
             "Fait parler l'autre de son métier sans jamais lui avoir demandé ce qu'il fait."),
            ("En fin de soirée", "« Je m'en vais, mais je n'ai pas voulu partir sans venir vous saluer. »",
             "Peu de monde ose. C'est mémorable, et ça ouvre naturellement sur l'échange de coordonnées."),
        ]
        for lieu, phrase, pourquoi in accroches:
            st.markdown(
                f"<div class='carte'><div class='etiquette'>{lieu}</div>"
                f"<p style='font-size:1.02rem;margin:0 0 8px'>{phrase}</p>"
                f"<p class='aide' style='margin:0'>↳ {pourquoi}</p></div>",
                unsafe_allow_html=True,
            )

    with o2:
        st.markdown("### « Et toi, tu fais quoi ? »")
        st.markdown(
            "<p class='aide'>La question arrive toujours. Ta réponse doit tenir en deux phrases "
            "et donner envie de poser la troisième question.</p>",
            unsafe_allow_html=True,
        )
        st.markdown(
            """<div class='carte carte-accent'>
              <div class='etiquette'>Version courte — 12 secondes</div>
              <p style='font-size:1.05rem;line-height:1.6'>
              « Je suis courtier en assurance indépendant. Concrètement, je fais le tri dans
              les contrats des gens — je regarde ce qui est utile, ce qui fait doublon,
              et ce qui manque vraiment. »
              </p>
            </div>""",
            unsafe_allow_html=True,
        )
        st.markdown(
            """<div class='carte'>
              <div class='etiquette'>Version longue — si on te relance</div>
              <p style='line-height:1.65'>
              « Je travaille comme un courtier local : je connais mes clients, je suis joignable,
              je me déplace. Mais je m'appuie sur des outils digitaux et de l'IA pour comparer
              beaucoup plus vite qu'avant — là où il fallait deux semaines pour un comparatif
              sérieux, j'y arrive en deux jours. Résultat : la proximité d'un courtier de
              village avec la puissance d'analyse d'une grosse structure. »
              </p>
            </div>""",
            unsafe_allow_html=True,
        )
        st.markdown(
            """<div class='carte'>
              <div class='etiquette'>Trois règles</div>
              <p class='aide' style='line-height:1.7'>
              <strong>1.</strong> Tu réponds, puis tu <strong>rends la parole</strong> :
              « et vous, qu'est-ce qui vous amène ici ? »<br>
              <strong>2.</strong> Tu ne cites <strong>aucun produit</strong>. Ni 3e pilier,
              ni LAMal, ni RC. Le produit tue la conversation.<br>
              <strong>3.</strong> Si l'autre enchaîne sur sa propre situation, tu
              <strong>écoutes sans vendre</strong>. C'est déjà gagné.
              </p>
            </div>""",
            unsafe_allow_html=True,
        )

    with o3:
        st.markdown("### Répondre sans forcer")
        objections = [
            (
                "« J'ai déjà mon courtier / mon assurance »",
                "« Tant mieux, franchement — c'est déjà mieux que la majorité des gens. "
                "Je ne cherche pas à remplacer qui que ce soit. La seule chose que je dis, "
                "c'est qu'un deuxième regard ne coûte rien : si tout est cohérent, je vous le "
                "confirme et vous êtes tranquille. Et si je vois quelque chose, vous en parlez "
                "à votre courtier actuel. »",
                "Tu valides son choix au lieu de le contredire, et tu te positionnes en avis "
                "complémentaire, pas en concurrent. La porte reste ouverte des deux côtés.",
            ),
            (
                "« L'assurance, ça ne m'intéresse pas »",
                "« Je comprends, personne ne se lève le matin en pensant à ses assurances. "
                "Moi non plus d'ailleurs, en dehors du boulot. La seule raison pour laquelle "
                "les gens finissent par s'y intéresser, c'est le budget : c'est souvent l'un "
                "des plus gros postes fixes après le loyer, et c'est un des rares qu'on peut "
                "encore faire baisser sans rien perdre. »",
                "Tu ne défends pas le sujet, tu le déplaces sur son budget — le seul angle "
                "qui intéresse quelqu'un qui vient de te dire que ça ne l'intéresse pas.",
            ),
            (
                "« Envoyez-moi une doc, je regarderai »",
                "« Je peux, mais honnêtement une doc générique ne vous apprendra rien sur "
                "votre situation. Je vous propose autre chose : donnez-moi deux minutes "
                "maintenant pour comprendre où vous en êtes, et je vous envoie quelque chose "
                "qui vous concerne vraiment. »",
                "La demande de doc est un refus poli. Tu l'acceptes sans insister, "
                "mais tu proposes plus utile — et tu obtiens souvent les deux minutes.",
            ),
        ]
        for question, reponse, pourquoi in objections:
            st.markdown(
                f"""<div class='carte'>
                  <div class='etiquette'>Objection</div>
                  <p style='font-weight:600;margin:0 0 10px'>{question}</p>
                  <p style='line-height:1.65;margin:0 0 10px'>{reponse}</p>
                  <p class='aide' style='margin:0'>↳ {pourquoi}</p>
                </div>""",
                unsafe_allow_html=True,
            )

    with o4:
        st.markdown("### Obtenir le droit de recontacter")
        st.markdown(
            """<div class='carte carte-accent'>
              <div class='etiquette'>La formule</div>
              <p style='font-size:1.05rem;line-height:1.7'>
              « Écoutez, je ne vais pas vous embêter avec ça ce soir. Mais j'ai une checklist
              d'optimisation que j'envoie aux gens que je rencontre — une page, les points à
              vérifier sur ses propres contrats. Je vous l'envoie ? »
              </p>
              <p class='aide' style='margin:10px 0 0'>
              Tu ne demandes pas un rendez-vous : tu demandes l'autorisation d'envoyer
              quelque chose d'utile. Un « oui » est facile à donner — et il te donne
              coordonnées <strong>et</strong> accord de recontact.
              </p>
            </div>""",
            unsafe_allow_html=True,
        )
        st.markdown(
            """<div class='carte'>
              <div class='etiquette'>Enchaînement immédiat</div>
              <p style='line-height:1.7'>
              « Parfait. Le plus simple : on se connecte sur LinkedIn maintenant, comme ça
              on ne se perd pas. »<br><br>
              <em>Tu sors ton téléphone, tu te connectes devant lui.</em> Le contact est
              acquis sur-le-champ, sans carte de visite qui finira à la poubelle.
              </p>
            </div>""",
            unsafe_allow_html=True,
        )
        st.markdown(
            """<div class='carte'>
              <div class='etiquette'>Dans les 5 minutes qui suivent</div>
              <p class='aide' style='line-height:1.7'>
              Va dans <strong>CRM express</strong> et note-le pendant que c'est frais :
              le sujet évoqué, son niveau d'intérêt, la date de relance. Le lendemain,
              tu auras oublié la moitié — et c'est cette moitié qui fait la différence
              au moment du recontact.
              </p>
            </div>""",
            unsafe_allow_html=True,
        )
        if st.button("➡️ Aller au CRM express", type="primary"):
            st.session_state["page"] = "📇 CRM express"
            st.rerun()


# =============================================================================
# 8. MODULE 4 — CRM MOBILE EXPRESS
# =============================================================================

INTERETS = ["Chaud 🔥", "Tiède 🌤️", "À nourrir ☕"]
CANAUX = ["Téléphone", "LinkedIn", "E-mail"]
SUJETS = [
    "3e pilier / prévoyance", "LAMal / complémentaires", "LPP / 2e pilier",
    "RC professionnelle", "Flotte / véhicules entreprise", "Ménage / RC privée",
    "Perte de gain", "Hypothèque / amortissement", "Autre",
]


def classe_interet(interet: str) -> str:
    if not interet:
        return ""
    if interet.startswith("Chaud"):
        return "puce-chaud"
    if interet.startswith("Tiède"):
        return "puce-tiede"
    return "puce-froid"


def page_crm() -> None:
    st.markdown("## 📇 CRM express")

    onglet_saisie, onglet_suivi = st.tabs(["⚡ Capture rapide", "📊 Suivi & export"])

    with onglet_saisie:
        st.markdown(
            "<p class='aide'>À remplir dans les 5 minutes qui suivent la rencontre. "
            "Seul le nom est obligatoire — le reste peut se compléter plus tard.</p>",
            unsafe_allow_html=True,
        )

        evenements_connus = lire("SELECT nom FROM evenements ORDER BY date_event DESC")["nom"].tolist()

        with st.form("capture", clear_on_submit=True):
            c1, c2 = st.columns(2)
            nom = c1.text_input("Nom *")
            prenom = c2.text_input("Prénom")

            c3, c4 = st.columns(2)
            entreprise = c3.text_input("Entreprise")
            profession = c4.text_input("Profession")

            c5, c6 = st.columns([1, 2])
            canal = c5.selectbox("Canal", CANAUX)
            contact = c6.text_input("Coordonnée", placeholder="079 … / linkedin.com/in/… / @…")

            c7, c8 = st.columns(2)
            evenement = c7.selectbox("Événement d'origine", ["—"] + evenements_connus + ["Autre / hors événement"])
            canton = c8.selectbox("Canton", CANTONS)

            interet = st.radio("Niveau d'intérêt", INTERETS, horizontal=True)
            sujet = st.selectbox("Sujet clé évoqué", SUJETS)

            c9, c10 = st.columns(2)
            action = c9.text_input("Action de suivi", placeholder="Envoyer la checklist d'optimisation")
            relance = c10.date_input("Date de relance", value=date.today() + timedelta(days=3))

            notes = st.text_area("Notes", placeholder="Ce qu'il a dit, ce qui compte pour lui…", height=90)

            if st.form_submit_button("💾 Enregistrer le prospect", type="primary"):
                if not nom.strip():
                    st.error("Le nom est obligatoire.")
                else:
                    executer(
                        """INSERT INTO prospects
                           (cree_le, nom, prenom, entreprise, profession, canal, contact,
                            evenement, interet, sujet, action_suivi, date_relance, canton,
                            statut, notes, source)
                           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                        (datetime.now().isoformat(timespec="seconds"), nom.strip(), prenom.strip(),
                         entreprise.strip(), profession.strip(), canal, contact.strip(),
                         "" if evenement == "—" else evenement, interet, sujet, action.strip(),
                         relance.isoformat(), canton, "Nouveau", notes.strip(), "CRM express"),
                    )
                    st.success(f"{prenom} {nom} enregistré. Relance prévue le {relance.strftime('%d.%m.%Y')}.")

    with onglet_suivi:
        df = lire("SELECT * FROM prospects ORDER BY date_relance ASC, cree_le DESC")

        if df.empty:
            st.info("Aucun prospect capturé pour l'instant.")
            return

        aujourdhui = date.today().isoformat()
        en_retard = df[(df["date_relance"] <= aujourdhui) & (df["statut"] != "Clos")]
        if not en_retard.empty:
            st.warning(f"⏰ {len(en_retard)} relance(s) à faire aujourd'hui ou en retard.")

        c1, c2 = st.columns(2)
        f_interet = c1.multiselect("Intérêt", INTERETS)
        f_statut = c2.multiselect("Statut", ["Nouveau", "Relancé", "RDV fixé", "Client", "Clos"])
        recherche = st.text_input("🔍 Rechercher", placeholder="nom, entreprise, sujet…")

        vue = df.copy()
        if f_interet:
            vue = vue[vue["interet"].isin(f_interet)]
        if f_statut:
            vue = vue[vue["statut"].isin(f_statut)]
        if recherche.strip():
            r = recherche.lower()
            colonnes = ["nom", "prenom", "entreprise", "sujet", "notes", "evenement"]
            masque = vue[colonnes].fillna("").apply(
                lambda ligne: r in " ".join(ligne).lower(), axis=1
            )
            vue = vue[masque]

        st.markdown(f"<p class='aide'>{len(vue)} prospect(s) affiché(s) sur {len(df)}.</p>",
                    unsafe_allow_html=True)

        for _, p in vue.iterrows():
            retard = p["date_relance"] and p["date_relance"] <= aujourdhui and p["statut"] != "Clos"
            st.markdown(
                f"""<div class='carte {"carte-accent" if retard else ""}'>
                  <div style='display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap'>
                    <strong>{p['prenom']} {p['nom']}</strong>
                    <span class='puce {classe_interet(p['interet'])}'>{p['interet']}</span>
                  </div>
                  <p class='aide' style='margin:6px 0 0'>
                    {p['entreprise'] or '—'}{' · ' + p['profession'] if p['profession'] else ''}<br>
                    💬 {p['sujet']} &nbsp;·&nbsp; 📍 {p['canton']}<br>
                    📞 {p['canal']} : {p['contact'] or 'à compléter'}<br>
                    {'🎪 ' + p['evenement'] + '<br>' if p['evenement'] else ''}
                    ➡️ {p['action_suivi'] or 'aucune action définie'}
                    &nbsp;·&nbsp; {'⏰ ' if retard else '🗓️ '}{p['date_relance']}
                  </p>
                  {f"<p class='aide' style='margin:8px 0 0;font-style:italic'>{p['notes']}</p>" if p['notes'] else ''}
                </div>""",
                unsafe_allow_html=True,
            )
            c1, c2, c3 = st.columns(3)
            nouveau_statut = c1.selectbox(
                "Statut", ["Nouveau", "Relancé", "RDV fixé", "Client", "Clos"],
                index=["Nouveau", "Relancé", "RDV fixé", "Client", "Clos"].index(p["statut"])
                if p["statut"] in ["Nouveau", "Relancé", "RDV fixé", "Client", "Clos"] else 0,
                key=f"st_{p['id']}", label_visibility="collapsed",
            )
            if nouveau_statut != p["statut"]:
                executer("UPDATE prospects SET statut = ? WHERE id = ?", (nouveau_statut, int(p["id"])))
                st.rerun()
            if c2.button("📅 +7 jours", key=f"rep_{p['id']}"):
                nouvelle = (date.fromisoformat(p["date_relance"]) + timedelta(days=7)).isoformat() \
                    if p["date_relance"] else (date.today() + timedelta(days=7)).isoformat()
                executer("UPDATE prospects SET date_relance = ? WHERE id = ?", (nouvelle, int(p["id"])))
                st.rerun()
            if c3.button("🗑️", key=f"delp_{p['id']}"):
                executer("DELETE FROM prospects WHERE id = ?", (int(p["id"]),))
                st.rerun()

        st.divider()
        st.download_button(
            "⬇️ Exporter tous les prospects (CSV)",
            df.to_csv(index=False).encode("utf-8-sig"),
            file_name=f"prospects_{date.today().isoformat()}.csv",
            mime="text/csv",
            type="primary",
        )


# =============================================================================
# 9. MODULE 5 — IMPORT & BASE DE CONNAISSANCES
# =============================================================================

COLONNES_CIBLE = ["nom", "prenom", "entreprise", "profession", "contact", "canton", "statut", "sujet"]


INDICES_COLONNES = {
    "nom": ["nom", "name", "lastname", "nom de famille", "famille"],
    "prenom": ["prenom", "firstname", "first name", "first"],
    "entreprise": ["entreprise", "societe", "company", "raison sociale", "employeur"],
    "profession": ["profession", "poste", "fonction", "metier", "titre", "job title"],
    "contact": ["email", "e mail", "mail", "telephone", "tel", "phone", "portable", "contact"],
    "canton": ["canton", "ct", "region", "district"],
    "statut": ["statut", "status", "etat", "etape"],
    "sujet": ["sujet", "besoin", "produit", "objet", "interet"],
}


def normaliser_entete(texte: str) -> str:
    """Minuscules, sans accents ni ponctuation — pour comparer des en-têtes."""
    base = str(texte).lower().strip()
    base = base.replace("é", "e").replace("è", "e").replace("ê", "e").replace("ë", "e")
    base = base.replace("à", "a").replace("â", "a").replace("ô", "o").replace("û", "u")
    base = base.replace("î", "i").replace("ï", "i").replace("ç", "c")
    return "".join(c if c.isalnum() else " " for c in base).strip()


def deviner_colonne(colonnes: list[str], cible: str) -> str:
    """
    Propose la colonne source la plus probable, par score décroissant :
    correspondance exacte > début de mot > simple inclusion.

    Le score évite deux pièges classiques : « Prénom » contient « nom », et
    « Fonction » contient « ct ». Une égalité exacte l'emporte toujours.
    """
    meilleur, score_max = "— ignorer —", 0

    for colonne in colonnes:
        entete = normaliser_entete(colonne)
        for rang, indice in enumerate(INDICES_COLONNES[cible]):
            mot = normaliser_entete(indice)
            if entete == mot:
                score = 100 - rang
            # « Last Name » et « lastname » désignent la même chose
            elif entete.replace(" ", "") == mot.replace(" ", ""):
                score = 90 - rang
            elif entete.startswith(mot) or mot.startswith(entete):
                score = 60 - rang
            elif mot in entete:
                score = 30 - rang
            else:
                continue
            if score > score_max:
                meilleur, score_max = colonne, score

    return meilleur


def lire_tableau(fichier) -> pd.DataFrame | None:
    """
    Lit un CSV ou un Excel. Les exports suisses sortent souvent en latin-1 avec
    des points-virgules : on essaie les combinaisons jusqu'à obtenir un tableau
    à plusieurs colonnes, signe que le séparateur est le bon.
    """
    if not fichier.name.lower().endswith(".csv"):
        try:
            return pd.read_excel(fichier)
        except Exception as erreur:
            st.error(f"Lecture Excel impossible : {erreur}")
            return None

    octets = fichier.getvalue()
    meilleur = None
    for encodage in ("utf-8-sig", "latin-1"):
        for separateur in (";", ",", "\t"):
            try:
                essai = pd.read_csv(io.BytesIO(octets), encoding=encodage, sep=separateur)
            except Exception:
                continue
            if essai.shape[1] > 1:
                return essai
            if meilleur is None:
                meilleur = essai

    if meilleur is None:
        st.error("Fichier CSV illisible : vérifie l'encodage et le séparateur.")
    return meilleur


def page_import() -> None:
    st.markdown("## 📥 Import & base de connaissances")

    onglet_contacts, onglet_docs, onglet_base = st.tabs(
        ["👥 Contacts (CSV/Excel)", "📄 Notes & documents", "🗄️ Gestion de la base"]
    )

    with onglet_contacts:
        fichier = st.file_uploader("Fichier de contacts", type=["csv", "xlsx", "xls"])

        if fichier:
            df_src = lire_tableau(fichier)
            if df_src is None:
                return

            st.success(f"{len(df_src)} ligne(s), {len(df_src.columns)} colonne(s) détectées.")
            st.dataframe(df_src.head(5), use_container_width=True)

            st.markdown("<div class='etiquette'>Correspondance des colonnes</div>",
                        unsafe_allow_html=True)
            st.markdown("<p class='aide'>Pré-remplie automatiquement — corrige si besoin.</p>",
                        unsafe_allow_html=True)

            options = ["— ignorer —"] + list(df_src.columns)
            mapping = {}
            colonnes_ui = st.columns(2)
            for i, cible in enumerate(COLONNES_CIBLE):
                defaut = deviner_colonne(list(df_src.columns), cible)
                mapping[cible] = colonnes_ui[i % 2].selectbox(
                    cible.capitalize(), options,
                    index=options.index(defaut) if defaut in options else 0,
                    key=f"map_{cible}",
                )

            ignorer_doublons = st.checkbox("Ignorer les doublons (même nom + même contact)", value=True)

            if st.button("📤 Importer dans le CRM", type="primary"):
                if mapping["nom"] == "— ignorer —":
                    st.error("La colonne « nom » est indispensable.")
                else:
                    existants = {
                        (str(r["nom"]).lower().strip(), str(r["contact"]).lower().strip())
                        for _, r in lire("SELECT nom, contact FROM prospects").iterrows()
                    }
                    ajoutes = ignores = 0
                    horodatage = datetime.now().isoformat(timespec="seconds")

                    for _, ligne in df_src.iterrows():
                        def valeur(champ: str) -> str:
                            col = mapping[champ]
                            if col == "— ignorer —" or pd.isna(ligne.get(col)):
                                return ""
                            return str(ligne[col]).strip()

                        nom = valeur("nom")
                        if not nom:
                            continue
                        cle = (nom.lower(), valeur("contact").lower())
                        if ignorer_doublons and cle in existants:
                            ignores += 1
                            continue
                        existants.add(cle)

                        canton = valeur("canton")
                        executer(
                            """INSERT INTO prospects
                               (cree_le, nom, prenom, entreprise, profession, canal, contact,
                                evenement, interet, sujet, action_suivi, date_relance, canton,
                                statut, notes, source)
                               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                            (horodatage, nom, valeur("prenom"), valeur("entreprise"),
                             valeur("profession"), "E-mail", valeur("contact"), "",
                             "À nourrir ☕", valeur("sujet") or "Autre", "",
                             (date.today() + timedelta(days=14)).isoformat(),
                             canton if canton in CANTONS else "Toute la Suisse romande",
                             valeur("statut") or "Nouveau", "", f"Import {fichier.name}"),
                        )
                        ajoutes += 1

                    st.success(f"✅ {ajoutes} contact(s) importé(s), {ignores} doublon(s) ignoré(s).")

    with onglet_docs:
        st.markdown(
            "<p class='aide'>Notes de réunion, fiches produits, modèles. Le texte est extrait "
            "et stocké localement pour rester consultable ici.</p>",
            unsafe_allow_html=True,
        )
        docs = st.file_uploader("Documents", type=["pdf", "txt", "md"], accept_multiple_files=True)

        if docs and st.button("📎 Enregistrer les documents", type="primary"):
            for doc in docs:
                octets = doc.getvalue()
                texte = ""
                try:
                    if doc.name.lower().endswith(".pdf"):
                        from pypdf import PdfReader
                        lecteur = PdfReader(io.BytesIO(octets))
                        texte = "\n".join((page.extract_text() or "") for page in lecteur.pages)
                    else:
                        texte = octets.decode("utf-8", errors="replace")
                except Exception as erreur:
                    texte = f"[extraction impossible : {erreur}]"

                executer(
                    "INSERT INTO documents (cree_le, nom_fichier, type, taille, contenu) VALUES (?,?,?,?,?)",
                    (datetime.now().isoformat(timespec="seconds"), doc.name,
                     doc.type or "inconnu", len(octets), texte[:200_000]),
                )
            st.success(f"{len(docs)} document(s) enregistré(s).")
            st.rerun()

        df_docs = lire("SELECT * FROM documents ORDER BY cree_le DESC")
        if df_docs.empty:
            st.info("Aucun document enregistré.")
        else:
            for _, d in df_docs.iterrows():
                with st.expander(f"📄 {d['nom_fichier']} — {round(d['taille'] / 1024)} Ko"):
                    st.text_area("Contenu", d["contenu"][:6000], height=220,
                                 label_visibility="collapsed", key=f"doc_{d['id']}")
                    if st.button("🗑️ Supprimer", key=f"deld_{d['id']}"):
                        executer("DELETE FROM documents WHERE id = ?", (int(d["id"]),))
                        st.rerun()

    with onglet_base:
        prospects = lire("SELECT * FROM prospects")
        evenements = lire("SELECT * FROM evenements")

        c1, c2, c3 = st.columns(3)
        c1.metric("Prospects", len(prospects))
        c2.metric("Événements", len(evenements))
        c3.metric("Documents", len(lire("SELECT id FROM documents")))

        st.markdown("<div class='etiquette'>Sauvegarde</div>", unsafe_allow_html=True)
        sauvegarde = {
            "exporte_le": datetime.now().isoformat(timespec="seconds"),
            "prospects": prospects.to_dict(orient="records"),
            "evenements": evenements.to_dict(orient="records"),
            "activites": lire("SELECT * FROM activites").to_dict(orient="records"),
            "parametres": lire("SELECT * FROM parametres").to_dict(orient="records"),
        }
        c1, c2 = st.columns(2)
        c1.download_button(
            "⬇️ Sauvegarde complète (JSON)",
            json.dumps(sauvegarde, ensure_ascii=False, indent=2).encode("utf-8"),
            file_name=f"assurlead_sauvegarde_{date.today().isoformat()}.json",
            mime="application/json",
        )
        if not prospects.empty:
            c2.download_button(
                "⬇️ Prospects (CSV)",
                prospects.to_csv(index=False).encode("utf-8-sig"),
                file_name=f"prospects_{date.today().isoformat()}.csv",
                mime="text/csv",
            )

        st.markdown("<div class='etiquette'>Nettoyage</div>", unsafe_allow_html=True)
        if st.button("🧹 Supprimer les doublons de prospects"):
            avant = len(prospects)
            executer("""
                DELETE FROM prospects WHERE id NOT IN (
                    SELECT MIN(id) FROM prospects
                    GROUP BY LOWER(TRIM(nom)), LOWER(TRIM(COALESCE(contact, '')))
                )
            """)
            apres = len(lire("SELECT id FROM prospects"))
            st.success(f"{avant - apres} doublon(s) supprimé(s).")

        st.markdown("<div class='etiquette' style='color:#FF6B4A'>Zone sensible</div>",
                    unsafe_allow_html=True)
        confirmation = st.text_input("Tape EFFACER pour réinitialiser toute la base",
                                     placeholder="EFFACER")
        if st.button("⚠️ Réinitialiser la base") :
            if confirmation.strip().upper() == "EFFACER":
                for table in ("prospects", "evenements", "activites", "documents"):
                    executer(f"DELETE FROM {table}")
                st.success("Base réinitialisée.")
                st.rerun()
            else:
                st.error("Confirmation manquante : tape EFFACER.")


# =============================================================================
# 10. MODULE 6 — DASHBOARD & OBJECTIFS
# =============================================================================

def page_dashboard() -> None:
    st.markdown("## 📈 Performance & objectifs")

    debut_mois = date.today().replace(day=1).isoformat()

    prospects = lire("SELECT * FROM prospects")
    activites = lire("SELECT * FROM activites WHERE cree_le >= ?", (debut_mois,))
    events_faits = lire("SELECT * FROM evenements WHERE statut = 'Effectué'")

    objectif = int(parametre("objectif_portefeuille", "600"))
    clients = len(prospects[prospects["statut"] == "Client"]) if not prospects.empty else 0
    base_actuelle = int(parametre("portefeuille_actuel", "0"))
    portefeuille = base_actuelle + clients

    messages_mois = len(activites[activites["type"].isin(["email", "linkedin"])]) if not activites.empty else 0
    prospects_mois = len(prospects[prospects["cree_le"] >= debut_mois]) if not prospects.empty else 0

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Prospects capturés", len(prospects), f"+{prospects_mois} ce mois" if prospects_mois else None)
    c2.metric("Messages ce mois", messages_mois)
    c3.metric("Événements faits", len(events_faits))
    c4.metric("Clients signés", clients)

    st.markdown("<div class='etiquette' style='margin-top:18px'>Cap portefeuille</div>",
                unsafe_allow_html=True)
    progression = min(1.0, portefeuille / objectif) if objectif else 0.0
    st.progress(progression, text=f"{portefeuille} / {objectif} clients — {progression * 100:.1f} %")

    restant = max(0, objectif - portefeuille)
    mois_restants = 12 - date.today().month + 1
    st.markdown(
        f"<p class='aide'>Il reste <strong>{restant}</strong> clients pour atteindre le cap. "
        f"Sur les {mois_restants} mois restants de l'année, cela représente "
        f"<strong>{restant / mois_restants:.1f}</strong> nouveaux clients par mois.</p>",
        unsafe_allow_html=True,
    )

    if not prospects.empty:
        st.divider()
        c1, c2 = st.columns(2)

        with c1:
            st.markdown("<div class='etiquette'>Répartition par intérêt</div>", unsafe_allow_html=True)
            st.bar_chart(prospects["interet"].value_counts(), horizontal=True, color="#00C2A8")

        with c2:
            st.markdown("<div class='etiquette'>Sujets les plus évoqués</div>", unsafe_allow_html=True)
            st.bar_chart(prospects["sujet"].value_counts().head(6), horizontal=True, color="#046B7A")

        source = prospects[prospects["evenement"].astype(str).str.len() > 0]
        if not source.empty:
            st.markdown("<div class='etiquette'>Prospects par événement</div>", unsafe_allow_html=True)
            st.bar_chart(source["evenement"].value_counts().head(8), horizontal=True, color="#00C2A8")

        # Le taux de conversion dit si le problème est le volume ou la qualité de l'approche.
        if len(prospects) >= 5:
            taux = clients / len(prospects) * 100
            st.markdown(
                f"<p class='aide'>Taux de conversion actuel : <strong>{taux:.1f} %</strong> "
                f"({clients} clients sur {len(prospects)} prospects). "
                f"À ce rythme, atteindre le cap demande environ "
                f"<strong>{int(restant / (taux / 100)) if taux > 0 else '—'}</strong> "
                f"nouveaux prospects.</p>",
                unsafe_allow_html=True,
            )

    st.divider()
    st.markdown("<div class='etiquette'>Réglages</div>", unsafe_allow_html=True)
    with st.form("objectifs"):
        c1, c2 = st.columns(2)
        cible = c1.number_input("Objectif de portefeuille", min_value=1, max_value=100_000, value=objectif, step=50)
        actuel = c2.number_input(
            "Clients déjà au portefeuille (hors app)", min_value=0, max_value=100_000,
            value=base_actuelle, step=10,
            help="Ton portefeuille existant, pour que la barre reflète ta situation réelle.",
        )
        if st.form_submit_button("Enregistrer", type="primary"):
            definir_parametre("objectif_portefeuille", cible)
            definir_parametre("portefeuille_actuel", actuel)
            st.success("Objectifs mis à jour.")
            st.rerun()


# =============================================================================
# 11. NAVIGATION
# =============================================================================

PAGES = {
    "📈 Dashboard": page_dashboard,
    "✉️ Approche digitale": page_generateur,
    "📅 Événements": page_evenements,
    "🎯 Playbook terrain": page_playbook,
    "📇 CRM express": page_crm,
    "📥 Import & base": page_import,
}


def main() -> None:
    st.markdown(CSS, unsafe_allow_html=True)
    injecter_pwa()

    if not ecran_login():
        return

    st.markdown(
        "<div style='display:flex;align-items:center;gap:10px;margin-bottom:14px'>"
        "<span style='font-size:1.5rem'>🛡️</span>"
        "<div><div style='font-weight:700;font-size:1.05rem;line-height:1.2'>AssurLead Studio</div>"
        "<div class='aide' style='font-size:0.78rem'>Vaud &amp; Valais</div></div></div>",
        unsafe_allow_html=True,
    )

    if "page" not in st.session_state:
        st.session_state["page"] = "📈 Dashboard"

    choix = st.radio(
        "Navigation", list(PAGES.keys()),
        index=list(PAGES.keys()).index(st.session_state["page"]),
        horizontal=True, label_visibility="collapsed", key="nav",
    )
    st.session_state["page"] = choix
    st.divider()

    PAGES[choix]()

    st.divider()
    c1, c2 = st.columns([3, 1])
    c1.markdown(
        f"<p class='aide' style='font-size:0.78rem'>Données stockées localement dans "
        f"<code>{CHEMIN_DB.name}</code> · {date.today().strftime('%d.%m.%Y')}</p>",
        unsafe_allow_html=True,
    )
    if c2.button("🔒 Verrouiller"):
        st.session_state["authentifie"] = False
        st.rerun()


if __name__ == "__main__":
    main()
