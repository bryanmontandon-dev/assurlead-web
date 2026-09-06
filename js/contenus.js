/** Contenus métier : templates de messages, playbook terrain, repères réseau. */

export const CANTONS = ['Vaud', 'Valais', 'Toute la Suisse romande'];

export const PROFILS = {
  'Indépendants / PME': {
    contexte: "la couverture d'un indépendant se construit pièce par pièce, souvent dans l'urgence du lancement",
    douleur: 'perte de gain, LPP facultative et RC professionnelle sont rarement revues après la création',
  },
  'Jeunes actifs / Premier emploi': {
    contexte: 'le passage du statut d’étudiant au premier salaire change toute la donne assurance',
    douleur: "on garde souvent la police héritée des parents, sans savoir ce qu'elle couvre vraiment",
  },
  Familles: {
    contexte: 'une famille cumule vite six ou sept contrats souscrits à des moments différents',
    douleur: 'les doublons s’installent sans qu’on les voie, et les franchises ne suivent plus la réalité du foyer',
  },
  'Nouveaux résidents en Suisse': {
    contexte: 'l’arrivée en Suisse impose une affiliation LAMal dans un délai court, souvent décidée à la hâte',
    douleur: 'le premier choix est fait sans comparaison, et rarement réexaminé ensuite',
  },
  Frontaliers: {
    contexte: 'le droit d’option entre LAMal et CMU se joue une fois, et engage durablement',
    douleur: 'beaucoup découvrent après coup les conséquences du choix initial sur la famille et la retraite',
  },
};

export const ANGLES = {
  'Audit & Optimisation des primes': {
    objets: [
      'Vos primes {annee} : ce qui peut encore bouger',
      '10 minutes pour vérifier vos primes',
      "Doublons d'assurance : le point rapide",
    ],
    promesse: "identifier les doublons et les couvertures devenues inutiles, puis chiffrer précisément ce que ça représente sur l'année",
    preuve: "Dans la plupart des dossiers que je reprends, une part du budget assurance paie deux fois la même chose sans que personne ne l'ait remarqué.",
    astuce: 'Un réflexe simple : reprenez vos polices et cherchez la protection juridique. Elle est très souvent incluse dans le ménage ET souscrite à part.',
    action: 'un audit express de 10 minutes, en visio ou autour d’un café',
    duree: '10 minutes',
  },
  'Check-up Prévoyance / 3ème Pilier': {
    objets: [
      '3e pilier : optimiser avant la clôture fiscale',
      'Votre 3a travaille-t-il vraiment pour vous ?',
      'Prévoyance : le point qu’on repousse toujours',
    ],
    promesse: 'faire le point sur votre 3e pilier : ce qu’il vous rapporte réellement, ce qu’il vous fait économiser d’impôt, et s’il est encore adapté à votre situation',
    preuve: 'Beaucoup de 3e piliers signés il y a quelques années ne correspondent plus du tout à la situation de leur titulaire — ni en montant, ni en structure.',
    astuce: 'Un 3a bancaire et un 3a d’assurance ne jouent pas le même rôle : le premier est souple, le second couvre le risque. Le bon choix dépend surtout de votre horizon.',
    action: 'un point de 20 minutes sur votre prévoyance, sans engagement',
    duree: '20 minutes',
  },
  'Deuxième avis indépendant': {
    objets: [
      'Un deuxième regard sur vos contrats',
      'Votre couverture, vue par un courtier indépendant',
      'Deuxième avis : vos garanties tiennent-elles la route ?',
    ],
    promesse: 'poser un deuxième regard, neutre, sur ce que vous avez déjà — sans rien remplacer si tout est cohérent',
    preuve: "Mon rôle n'est pas de vous vendre un contrat de plus. Sur une bonne partie des dossiers que j'examine, je confirme que ce qui est en place tient la route, et je le dis.",
    astuce: 'La vraie question à poser à son assureur : « qu’est-ce qui n’est PAS couvert dans ce contrat ? » La réponse est souvent plus instructive que la brochure.',
    action: 'un échange de 15 minutes pour regarder vos contrats ensemble',
    duree: '15 minutes',
  },
  'Transition professionnelle / LPP': {
    objets: [
      'Changement de poste : et votre LPP ?',
      'Votre 2e pilier pendant la transition',
      'Nouveau job : les 3 points assurance à régler',
    ],
    promesse: 'sécuriser la transition : avoir libre passage, couverture perte de gain et prévoyance qui ne laissent pas de trou entre deux employeurs',
    preuve: 'Le changement d’employeur est le moment où les trous de couverture apparaissent — et on ne s’en aperçoit qu’au moment où on en a besoin.',
    astuce: 'Entre deux emplois, la couverture accident de l’ancien employeur ne dure qu’un temps limité. C’est le point que presque personne ne vérifie.',
    action: 'un point rapide de 15 minutes sur votre transition',
    duree: '15 minutes',
  },
};

export const TONS = {
  'Professionnel & Chaleureux': { ouverture: 'J’espère que vous allez bien.', liaison: 'Si le sujet vous parle,', cloture: 'Au plaisir d’échanger,' },
  'Direct & Synthétique': { ouverture: '', liaison: 'Si ça vous intéresse,', cloture: 'Bien à vous,' },
  'Conseil & Pédagogique': { ouverture: 'Je me permets de vous écrire pour une raison précise.', liaison: 'Si vous voulez y voir plus clair,', cloture: 'Bien cordialement,' },
};

export const zone = (canton) =>
  canton === 'Toute la Suisse romande' ? 'en Suisse romande' : `dans le canton de ${canton}`;

/* --- Génération --------------------------------------------------------------- */

export function genererEmail({ profil, canton, angle, ton, prenom, signature }) {
  const p = PROFILS[profil], a = ANGLES[angle], t = TONS[ton];
  const appel = prenom?.trim() ? `Bonjour ${prenom.trim()},` : 'Bonjour,';
  let corps;

  if (ton === 'Direct & Synthétique') {
    corps = `${appel}

Je suis courtier en assurance indépendant, actif ${zone(canton)}.

Je propose ${a.promesse}.

Concrètement : ${a.action}. Pas de présentation produit, pas de suite si ça ne vous apporte rien.

${t.liaison} dites-moi simplement quel jour vous arrange.

${t.cloture}
${signature}`;
  } else if (ton === 'Conseil & Pédagogique') {
    corps = `${appel}

${t.ouverture} Je suis courtier en assurance indépendant ${zone(canton)}, et je constate régulièrement la même chose : ${p.contexte}.

${a.preuve}

Ce que je vous propose n'est pas une offre : c'est ${a.promesse}. Vous repartez avec une vision claire de votre situation, que nous travaillions ensemble ensuite ou non.

Un point utile en attendant, que vous pouvez vérifier vous-même :
${a.astuce}

${t.liaison} je vous propose ${a.action}. Vous me dites ce qui vous arrange.

${t.cloture}
${signature}`;
  } else {
    corps = `${appel}

${t.ouverture} Je suis courtier en assurance indépendant, basé ${zone(canton)}.

Je m'adresse à vous parce que ${p.contexte} — et que, dans ces situations, ${p.douleur}.

Mon travail consiste à ${a.promesse}. ${a.preuve}

${t.liaison} je vous propose ${a.action}. Si tout est déjà en ordre, je vous le dirai simplement, et vous aurez au moins la confirmation que votre couverture tient.

${t.cloture}
${signature}`;
  }

  return { objets: a.objets.map((o) => o.replace('{annee}', new Date().getFullYear())), corps };
}

export function genererLinkedin({ profil, canton, angle, prenom, signature }) {
  const a = ANGLES[angle];
  const appel = prenom?.trim() || 'Bonjour';
  const court = (signature || 'Bryan').split('\n')[0].trim();

  return [
    {
      titre: 'Message 1 — Demande de connexion (jour J)',
      quand: 'À l’envoi de l’invitation. Aucun pitch : on ouvre une porte, on ne vend rien.',
      limite: 300,
      texte: `Bonjour ${appel}, je développe mon réseau professionnel ${zone(canton)} et votre parcours a retenu mon attention. Je suis courtier en assurance indépendant — je serais ravi de suivre votre actualité. Bonne journée !`,
    },
    {
      titre: 'Message 2 — Apport de valeur (J+3)',
      quand: 'Après l’acceptation. On donne quelque chose d’utile, sans rien demander.',
      texte: `Merci pour la connexion, ${appel} !\n\nComme je partage régulièrement des repères concrets sur les assurances en Suisse, en voici un qui revient souvent :\n\n${a.astuce}\n\nRien à vendre derrière — si ça peut vous éviter de payer pour rien, c'est déjà utile. Bonne fin de semaine !`,
    },
    {
      titre: 'Message 3 — Invitation naturelle (J+7)',
      quand: 'On propose, on n’insiste pas. Sans réponse, on laisse vivre et on recontacte dans six mois.',
      texte: `Bonjour ${appel}, j'espère que la semaine se passe bien.\n\nJe me disais qu'un point rapide sur vos garanties pourrait vous intéresser : ${a.promesse}.\n\nÇa prend ${a.duree} et ça n'engage à rien — si votre couverture est déjà cohérente, je vous le dis et on en reste là.\n\nDites-moi simplement si le sujet vous parle. Belle journée,\n${court}`,
    },
  ];
}

/* --- Playbook terrain ---------------------------------------------------------- */

export const ICEBREAKERS = [
  ['Au buffet / bar', '« Vous avez testé quoi ? Je suis devant ça depuis deux minutes sans me décider. »',
   'Universel, léger, et ça oblige l’autre à répondre autre chose que oui ou non.'],
  ['À une table debout', '« Je peux me poser ici ? Je ne connais presque personne ce soir, autant assumer. »',
   'L’aveu de ne connaître personne désarme complètement. Presque tout le monde est dans le même cas.'],
  ['Sur l’organisateur', '« C’est votre première fois avec [organisateur] ? J’essaie de me faire une idée avant de m’engager sur l’année. »',
   'On se place en pair qui évalue, pas en vendeur qui prospecte.'],
  ['Sur l’orateur', '« Ce qu’il a dit sur [sujet], vous le vivez comme ça dans votre secteur ? »',
   'Fait parler l’autre de son métier sans jamais lui avoir demandé ce qu’il fait.'],
  ['En fin de soirée', '« Je m’en vais, mais je n’ai pas voulu partir sans venir vous saluer. »',
   'Peu de monde ose. C’est mémorable, et ça ouvre naturellement sur l’échange de coordonnées.'],
];

export const OBJECTIONS = [
  ['« J’ai déjà mon courtier / mon assurance »',
   '« Tant mieux, franchement — c’est déjà mieux que la majorité des gens. Je ne cherche pas à remplacer qui que ce soit. La seule chose que je dis, c’est qu’un deuxième regard ne coûte rien : si tout est cohérent, je vous le confirme et vous êtes tranquille. Et si je vois quelque chose, vous en parlez à votre courtier actuel. »',
   'Tu valides son choix au lieu de le contredire, et tu te positionnes en avis complémentaire, pas en concurrent.'],
  ['« L’assurance, ça ne m’intéresse pas »',
   '« Je comprends, personne ne se lève le matin en pensant à ses assurances. Moi non plus d’ailleurs, en dehors du boulot. La seule raison pour laquelle les gens finissent par s’y intéresser, c’est le budget : c’est souvent l’un des plus gros postes fixes après le loyer, et c’est un des rares qu’on peut encore faire baisser sans rien perdre. »',
   'Tu ne défends pas le sujet, tu le déplaces sur son budget — le seul angle qui intéresse quelqu’un qui vient de te dire que ça ne l’intéresse pas.'],
  ['« Envoyez-moi une doc, je regarderai »',
   '« Je peux, mais honnêtement une doc générique ne vous apprendra rien sur votre situation. Je vous propose autre chose : donnez-moi deux minutes maintenant pour comprendre où vous en êtes, et je vous envoie quelque chose qui vous concerne vraiment. »',
   'La demande de doc est un refus poli. Tu l’acceptes sans insister, mais tu proposes plus utile — et tu obtiens souvent les deux minutes.'],
];

/* --- Repères réseau romands ----------------------------------------------------- */

export const TYPES_EVENT = ['Réseau d’affaires', 'Afterwork ouvert', 'Salon pro', 'Sportif / associatif'];
export const STATUTS_EVENT = ['À venir', 'Inscrit', 'Effectué'];

/** Organisateurs réellement actifs. Les dates changent : à compléter depuis leur site. */
export const EVENEMENTS_AMORCE = [
  ['Événement CVCI (à dater)', 'CVCI — Chambre vaudoise du commerce et de l’industrie', 'Lausanne', 'Vaud', 'Réseau d’affaires', 'Dirigeants, PME vaudoises', 'Payant', 'https://www.cvci.ch/agenda'],
  ['Rendez-vous FER Vaud (à dater)', 'FER Vaud — Fédération des entreprises romandes', 'Lausanne', 'Vaud', 'Réseau d’affaires', 'Indépendants, patrons de PME', 'Payant', 'https://www.fervaud.ch'],
  ['Réunion hebdomadaire BNI (à dater)', 'BNI Suisse romande', 'Lausanne / Sion', 'Toute la Suisse romande', 'Réseau d’affaires', 'Indépendants, artisans, professions libérales', 'Payant', 'https://bnisuisse.ch'],
  ['Événement CCIV (à dater)', 'Chambre valaisanne de commerce et d’industrie', 'Sion', 'Valais', 'Réseau d’affaires', 'Entreprises valaisannes', 'Payant', 'https://www.cci-valais.ch'],
  ['Afterwork JCI (à dater)', 'Jeune Chambre Internationale', 'Lausanne / Sion', 'Toute la Suisse romande', 'Afterwork ouvert', 'Jeunes actifs, entrepreneurs 18-40', 'Gratuit', 'https://www.jci.ch'],
  ['Salon des métiers et de la formation', 'Beaulieu', 'Lausanne', 'Vaud', 'Salon pro', 'Jeunes en formation, premiers emplois', 'Gratuit', 'https://www.metiersformation.ch'],
  ['Foire du Valais', 'Foire du Valais', 'Martigny', 'Valais', 'Salon pro', 'Grand public, PME régionales', 'Payant', 'https://www.foireduvalais.ch'],
];

export const INTERETS = ['Chaud 🔥', 'Tiède 🌤️', 'À nourrir ☕'];
export const CANAUX = ['Téléphone', 'LinkedIn', 'E-mail'];
export const STATUTS_PROSPECT = ['Nouveau', 'Relancé', 'RDV fixé', 'Client', 'Clos'];
export const SUJETS = [
  '3e pilier / prévoyance', 'LAMal / complémentaires', 'LPP / 2e pilier',
  'RC professionnelle', 'Flotte / véhicules entreprise', 'Ménage / RC privée',
  'Perte de gain', 'Hypothèque / amortissement', 'Autre',
];
