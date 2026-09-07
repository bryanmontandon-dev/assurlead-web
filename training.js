/**
 * Module Training — les branches d'assurance suisses.
 *
 * Chaque fiche donne : à quoi ça sert, ce qu'il faut retenir, les questions à
 * poser en RDV, et le piège le plus fréquent. Volontairement sans chiffres
 * (franchises, plafonds, seuils) : ils changent chaque année et une donnée
 * périmée en rendez-vous coûte plus cher qu'une donnée absente.
 */

export const BRANCHES = {
  'Personnes & santé': [
    {
      nom: 'LAMal — assurance de base',
      role: 'Obligatoire pour toute personne domiciliée en Suisse. Couvre les soins de base, identiques par la loi quelle que soit la caisse.',
      retenir: 'Les prestations sont les MÊMES partout. Seuls le prix, le service et les modèles changent. Un nouvel arrivant doit s’affilier dans un délai légal court après son arrivée.',
      questions: [
        'Quelle franchise avez-vous choisie, et pourquoi celle-là ?',
        'Combien de fois êtes-vous allé chez le médecin l’an dernier ?',
        'Êtes-vous en modèle libre, médecin de famille, HMO ou télémédecine ?',
      ],
      piege: 'Beaucoup gardent une franchise basse « au cas où » alors qu’ils ne consultent jamais. C’est le premier levier d’économie, et il est immédiat.',
    },
    {
      nom: 'LCA — complémentaires santé',
      role: 'Facultatif : hospitalisation (mi-privé, privé), dentaire, médecines alternatives, lunettes, check-ups.',
      retenir: 'Soumis à un questionnaire de santé. L’assureur peut refuser ou exclure. Contrairement à la LAMal, ce n’est jamais acquis d’avance.',
      questions: [
        'Si vous deviez être hospitalisé demain, savez-vous dans quelle division vous seriez ?',
        'Avez-vous des soins dentaires prévus ?',
        'Vos complémentaires datent de quand ?',
      ],
      piege: 'Résilier une complémentaire pour économiser, puis vouloir y revenir des années plus tard — l’état de santé a changé, et la porte peut être fermée. À expliquer AVANT toute résiliation.',
    },
    {
      nom: 'Accidents — LAA et couverture privée',
      role: 'Le salarié est couvert par son employeur pour les accidents professionnels, et aussi non professionnels au-delà d’un certain temps de travail hebdomadaire.',
      retenir: 'L’indépendant, lui, n’a PAS de LAA obligatoire : il doit inclure le risque accident dans sa LAMal ou souscrire une couverture séparée.',
      questions: [
        'Vous êtes salarié, indépendant, ou les deux ?',
        'Combien d’heures par semaine travaillez-vous chez cet employeur ?',
        'Que se passe-t-il pour vous en cas d’arrêt long après un accident ?',
      ],
      piege: 'Le salarié à temps très partiel qui croit être couvert pour ses accidents de loisirs alors qu’il ne l’est pas. À vérifier systématiquement.',
    },
    {
      nom: 'Perte de gain maladie',
      role: 'Remplace le revenu en cas d’incapacité de travail pour maladie — ce que la LAMal ne fait pas.',
      retenir: 'Facultatif pour l’employeur dans la plupart des cas, et souvent absent chez l’indépendant. C’est le trou de couverture le plus fréquent et le plus grave.',
      questions: [
        'Si vous ne pouviez plus travailler pendant six mois pour raison de santé, que se passerait-il financièrement ?',
        'Votre employeur a-t-il une assurance perte de gain collective ?',
        'Combien de temps votre épargne tiendrait-elle ?',
      ],
      piege: 'L’indépendant qui pense que l’AI prendra le relais. Les délais d’attente de l’AI se comptent en mois, parfois davantage.',
    },
  ],

  'Prévoyance & assurance vie': [
    {
      nom: '1er pilier — AVS / AI',
      role: 'Prévoyance étatique. Couvre le minimum vital à la retraite, en cas d’invalidité ou de décès.',
      retenir: 'Ne suffit jamais seul à maintenir le niveau de vie. Les années de cotisation manquantes réduisent la rente — un sujet clé pour ceux arrivés en Suisse en cours de carrière.',
      questions: [
        'Avez-vous toujours cotisé en Suisse, ou y a-t-il eu des années à l’étranger ?',
        'Avez-vous déjà demandé votre extrait de compte AVS ?',
      ],
      piege: 'Les lacunes de cotisation, invisibles jusqu’au calcul de la rente. L’extrait AVS est gratuit et se demande en ligne — un excellent prétexte de recontact.',
    },
    {
      nom: '2e pilier — LPP',
      role: 'Prévoyance professionnelle obligatoire au-delà d’un seuil de salaire annuel. Couvre d’abord les risques décès et invalidité, puis l’épargne vieillesse quelques années plus tard.',
      retenir: 'L’indépendant n’y est pas soumis. Le temps partiel et les employeurs multiples créent des lacunes, car la déduction de coordination s’applique à chaque rapport de travail.',
      questions: [
        'Avez-vous plusieurs employeurs ou un temps partiel ?',
        'Que deviennent vos avoirs entre deux emplois ?',
        'Avez-vous déjà envisagé un rachat, et connaissez-vous son effet fiscal ?',
      ],
      piege: 'Les avoirs de libre passage oubliés après un changement d’emploi. Beaucoup de gens ont de l’argent dormant sans le savoir.',
    },
    {
      nom: '3e pilier A — prévoyance liée',
      role: 'Épargne volontaire déductible du revenu imposable, dans la limite d’un plafond annuel.',
      retenir: 'Le plafond diffère selon qu’on est affilié à une caisse de pension ou non — l’indépendant sans LPP a droit à bien plus. Capital bloqué jusqu’à quelques années de la retraite, sauf cas de sortie prévus par la loi.',
      questions: [
        'Versez-vous déjà dans un 3a, et à quelle hauteur ?',
        'Votre 3a est-il bancaire ou en assurance ?',
        'Un projet d’achat immobilier à moyen terme ?',
      ],
      piege: 'Confondre 3a bancaire et 3a d’assurance. Le premier est souple mais ne couvre aucun risque ; le second protège la famille mais engage sur la durée. Le mauvais choix se paie des années plus tard.',
    },
    {
      nom: '3e pilier B — prévoyance libre',
      role: 'Épargne libre, sans blocage, sans plafond. Traitement fiscal différent du 3a et variable selon le canton.',
      retenir: 'Utile quand le plafond du 3a est atteint, ou pour un objectif à horizon libre. Souvent le bon outil pour un besoin de flexibilité.',
      questions: [
        'Avez-vous déjà atteint votre plafond 3a cette année ?',
        'Quel horizon pour cet argent : 5 ans, 15 ans, la retraite ?',
      ],
      piege: 'Le vendre comme un 3a en oubliant que l’avantage fiscal n’est pas le même. Le client s’en rend compte à sa déclaration d’impôts, et la confiance tombe.',
    },
    {
      nom: 'Assurance vie — risque pur',
      role: 'Verse un capital en cas de décès ou d’invalidité. Pas d’épargne : uniquement de la protection.',
      retenir: 'C’est le produit le moins cher pour protéger une famille ou un crédit hypothécaire. Le montant se calcule sur les besoins réels des survivants, pas au doigt mouillé.',
      questions: [
        'Si vous disparaissiez demain, votre famille pourrait-elle garder le logement ?',
        'Combien de temps vos proches tiendraient-ils sans votre revenu ?',
        'Avez-vous un crédit hypothécaire en cours ?',
      ],
      piege: 'Vendre un capital rond « parce que ça fait bien » au lieu de le calculer sur la dette et les charges effectives. Le client sur-paie, ou pire, se croit couvert alors qu’il ne l’est pas assez.',
    },
    {
      nom: 'Assurance vie mixte — épargne et risque',
      role: 'Combine constitution d’un capital et couverture décès dans un seul contrat.',
      retenir: 'Engagement de longue durée. La résiliation anticipée est presque toujours défavorable au client — à dire clairement AVANT la signature.',
      questions: [
        'Sur quelle durée êtes-vous prêt à vous engager sans y toucher ?',
        'Votre situation professionnelle est-elle stable pour les dix prochaines années ?',
      ],
      piege: 'Le produit qui a fait la mauvaise réputation de la branche. Ne le proposer que si la durée est réellement tenable — sinon on fabrique un client mécontent.',
    },
  ],

  'Choses & patrimoine (non-vie)': [
    {
      nom: 'RC privée',
      role: 'Couvre les dommages causés involontairement à autrui. Non obligatoire, mais exigée par la quasi-totalité des bailleurs.',
      retenir: 'Coût dérisoire au regard des sommes en jeu. Un dégât des eaux chez le voisin dépasse vite plusieurs dizaines de milliers de francs.',
      questions: [
        'Vous êtes locataire ou propriétaire ?',
        'Des enfants, des animaux à la maison ?',
        'Faites-vous du sport ou du vélo régulièrement ?',
      ],
      piege: 'La couverture des dommages au logement loué, souvent sous-dimensionnée par rapport à ce que le bail exige réellement.',
    },
    {
      nom: 'Ménage — inventaire',
      role: 'Couvre le mobilier et les effets personnels contre incendie, dégâts d’eau, vol.',
      retenir: 'La somme d’assurance doit correspondre à la valeur à neuf de TOUT ce que contient le logement. Elle est presque toujours sous-évaluée.',
      questions: [
        'Si tout brûlait demain, combien coûterait le remplacement à neuf ?',
        'Avez-vous déménagé ou fait des achats importants depuis la souscription ?',
        'Le vol à l’extérieur est-il inclus ?',
      ],
      piege: 'La sous-assurance : en cas de sinistre, l’indemnité est réduite proportionnellement. Le client découvre le mécanisme au pire moment.',
    },
    {
      nom: 'Véhicules — RC, casco partielle et complète',
      role: 'La RC véhicule est obligatoire. La casco est facultative : partielle (vol, grêle, bris de glace, animaux) ou complète (y compris ses propres dégâts).',
      retenir: 'La casco complète perd son intérêt à mesure que le véhicule vieillit. Le bon moment pour la ramener en partielle est une vraie économie à proposer.',
      questions: [
        'Quel âge a le véhicule, et quelle est sa valeur aujourd’hui ?',
        'Kilométrage annuel ?',
        'Qui d’autre conduit ce véhicule ?',
      ],
      piege: 'Garder une casco complète sur un véhicule amorti. C’est l’économie la plus facile à démontrer, chiffres à l’appui.',
    },
    {
      nom: 'Protection juridique',
      role: 'Prend en charge les frais d’avocat et de procédure : circulation, travail, bail, consommation.',
      retenir: 'Souvent souscrite EN DOUBLE — une fois incluse dans le ménage, une fois séparément. C’est le doublon numéro un en Suisse.',
      questions: [
        'Avez-vous une protection juridique ? Circulation, privée, ou les deux ?',
        'Est-elle incluse quelque part sans que vous le sachiez ?',
      ],
      piege: 'Le doublon. Vérifie-le systématiquement : c’est une économie immédiate qui crédibilise tout le reste de ton audit.',
    },
    {
      nom: 'Bâtiment — le cas romand',
      role: 'Assure la structure du bâtiment contre l’incendie et les éléments naturels.',
      retenir: 'Le régime diffère selon le canton. Vaud relève d’un établissement cantonal (ECA) auquel les propriétaires sont soumis. Genève et le Valais fonctionnent en marché privé : le propriétaire choisit son assureur.',
      questions: [
        'Vous êtes propriétaire dans quel canton ?',
        'Qui assure le bâtiment aujourd’hui, et depuis quand ?',
      ],
      piege: 'Appliquer le réflexe vaudois à un client genevois ou valaisan. Sur ces cantons, il y a un vrai marché — donc une vraie valeur ajoutée de courtier.',
    },
  ],

  'Méthodes de vente': [
    {
      nom: 'Start with Why — le cercle d’or',
      role: 'Structure l’ordre de la conversation : Pourquoi, puis Comment, puis Quoi. Le produit arrive en dernier.',
      retenir: 'Une prime n’est « chère » que si elle ne pèse contre rien. Quand le POURQUOI est formulé PAR LE CLIENT, la prime se compare à ce qu’il protège. Sinon elle se compare à zéro.',
      questions: [
        'S’il y a une chose que vous tenez à protéger avant tout, ce serait quoi ?',
        'Qu’est-ce qui vous ferait dire, dans deux ans, que vous avez bien fait ?',
        'Qu’est-ce qui compte le plus pour vous là-dedans ?',
      ],
      piege: 'Affirmer le pourquoi à sa place : « vous voulez protéger votre famille, n’est-ce pas ? » Il acquiesce sans y croire, et ça ne pèsera rien face au prix. Fais-le dire.',
    },
    {
      nom: 'Ligne droite — les trois certitudes',
      role: 'Toute objection signale qu’une des trois certitudes manque : la solution, toi, ta méthode.',
      retenir: 'On ne combat pas une objection, on remonte la certitude qui manque, puis on redemande l’engagement. Pour un courtier, la troisième certitude porte sur ton indépendance, pas sur une compagnie.',
      questions: [
        'Si je résume ce que vous m’avez dit, ce qui vous préoccupe c’est [X] — c’est bien ça ?',
        'Je compare le marché sur vos critères : ça vous convient comme façon de faire ?',
        'Ça a du sens pour vous, dit comme ça ?',
      ],
      piege: 'Répondre à l’objection prix par le prix. C’est le seul terrain où le client gagne toujours. Remonte d’abord la certitude, reparle du montant ensuite.',
    },
    {
      nom: 'Ligne droite — qualification et bouclage',
      role: 'Faire chiffrer le risque par le client, puis boucler sans jamais le contredire.',
      retenir: 'Un montant que le client a posé lui-même ne se discute plus. Un montant que tu annonces se conteste immédiatement.',
      questions: [
        'À votre avis, si ça arrivait demain, ça représenterait combien ?',
        'Combien de temps tiendriez-vous sans ce revenu ?',
        'Je comprends tout à fait… (remonter la certitude) … ça vous parle ?',
      ],
      piege: 'Annoncer toi-même le montant du risque. Il le contestera, ou il ne le retiendra pas — dans les deux cas c’est perdu.',
    },
    {
      nom: 'Ce qu’il faut écarter de la Ligne droite',
      role: 'La méthode a été conçue pour vendre vite, par quelqu’un condamné pour fraude. La structure est excellente, les leviers de pression ne le sont pas.',
      retenir: 'Rareté fabriquée, amplification artificielle de la peur, insistance après un non : incompatibles avec un devoir de conseil. Un client sous pression signe une fois, résilie l’année suivante et ne recommande personne.',
      questions: [
        'Est-ce que cette urgence est réelle, ou est-ce que je la fabrique ?',
        'Est-ce que je serais à l’aise si le client entendait l’enregistrement de ce RDV ?',
      ],
      piege: 'Inventer une urgence alors que le marché suisse en fournit de vraies : clôture fiscale du 3a, délai de résiliation LAMal. Tu n’as aucun besoin d’en créer.',
    },
  ],

  'Entreprises & PME': [
    {
      nom: 'RC entreprise et professionnelle',
      role: 'Couvre les dommages causés aux tiers dans le cadre de l’activité, et les erreurs professionnelles pour les métiers du conseil.',
      retenir: 'Certaines professions réglementées ne peuvent tout simplement pas exercer sans. La distinction RC exploitation / RC professionnelle est mal comprise par la plupart des dirigeants.',
      questions: [
        'Que se passe-t-il si un client vous reproche une erreur ?',
        'Recevez-vous des clients dans vos locaux ?',
        'Livrez-vous ou installez-vous chez le client ?',
      ],
      piege: 'Couverture calquée sur la création de l’entreprise alors que l’activité a changé. À revoir dès qu’un nouveau service apparaît.',
    },
    {
      nom: 'LAA et complémentaire accident',
      role: 'Obligatoire dès le premier salarié. La complémentaire améliore les prestations au-delà du plafond légal.',
      retenir: 'Les salaires supérieurs au plafond LAA sont mal couverts sans complémentaire — c’est souvent le cas du dirigeant lui-même.',
      questions: [
        'Combien de salariés, et quelle masse salariale ?',
        'Des salaires au-dessus du plafond LAA ?',
        'Le dirigeant est-il salarié de sa propre structure ?',
      ],
      piege: 'Le patron qui assure bien ses équipes et oublie sa propre couverture.',
    },
    {
      nom: 'LPP entreprise',
      role: 'Prévoyance professionnelle des salariés. L’employeur choisit la caisse et le plan.',
      retenir: 'Le plan peut aller au-delà du minimum légal : c’est un vrai argument de rétention des talents, et un levier fiscal pour le dirigeant.',
      questions: [
        'Quelle est votre caisse actuelle, et depuis quand ?',
        'Avez-vous déjà comparé les frais et le taux de conversion ?',
        'Des difficultés à recruter ou à garder vos gens ?',
      ],
      piege: 'Une caisse jamais remise en question depuis la création. Les écarts de frais entre institutions sont considérables sur la durée.',
    },
    {
      nom: 'Perte de gain collective',
      role: 'Maintient le salaire des employés en cas de maladie longue, et soulage la trésorerie de l’entreprise.',
      retenir: 'Souvent imposée par la convention collective. Sans elle, l’obligation de payer le salaire repose entièrement sur l’employeur.',
      questions: [
        'Que se passe-t-il si un collaborateur clé est absent trois mois ?',
        'Êtes-vous soumis à une CCT ?',
      ],
      piege: 'La PME qui découvre son obligation de maintien du salaire au moment du premier arrêt long.',
    },
    {
      nom: 'Choses, inventaire et interruption d’exploitation',
      role: 'Couvre les locaux, le matériel, les stocks — et la perte de revenu pendant l’arrêt de l’activité.',
      retenir: 'L’interruption d’exploitation est presque toujours oubliée. C’est pourtant elle qui décide si l’entreprise survit à un sinistre.',
      questions: [
        'Si vos locaux étaient inutilisables trois mois, que deviendrait le chiffre d’affaires ?',
        'Quelle est la valeur de votre matériel et de vos stocks ?',
      ],
      piege: 'Assurer les murs et le matériel en oubliant les charges fixes qui continuent de courir pendant l’arrêt.',
    },
    {
      nom: 'Flotte de véhicules',
      role: 'Regroupe les véhicules de l’entreprise dans un contrat unique.',
      retenir: 'À partir de quelques véhicules, le regroupement fait baisser le coût et simplifie radicalement la gestion administrative.',
      questions: [
        'Combien de véhicules, et de quel type ?',
        'Sont-ils sur des contrats séparés aujourd’hui ?',
        'Qui les conduit, et y a-t-il eu des sinistres ?',
      ],
      piege: 'Le patron qui ignore combien de contrats distincts il paie. Faire l’inventaire devant lui est souvent un choc utile.',
    },
    {
      nom: 'Cyber et homme clé',
      role: 'Cyber : rançongiciel, fuite de données, interruption informatique. Homme clé : capital si une personne indispensable disparaît.',
      retenir: 'Deux branches encore peu vendues en PME romande, donc deux angles de différenciation face aux généralistes.',
      questions: [
        'Que se passerait-il si vous perdiez l’accès à vos données demain matin ?',
        'Y a-t-il une personne sans qui l’entreprise s’arrêterait ?',
      ],
      piege: 'Vendre du cyber sans parler des sauvegardes. Le client attend un conseil global, pas juste une police de plus.',
    },
  ],
};

/** Auto-évaluation : on s'entraîne sur ce qui se joue vraiment en rendez-vous. */
export const QUIZ = [
  {
    question: 'Le client trouve la prime trop chère. Selon la Ligne droite, que signale cette objection ?',
    reponses: [
      'Qu’il n’a pas les moyens',
      'Qu’une des trois certitudes est insuffisante',
      'Qu’il faut proposer moins cher',
    ],
    bonne: 1,
    explication: 'Une objection prix est presque toujours un déficit de certitude — sur la solution, sur toi, ou sur ta méthode. Baisser le prix ne comble aucun des trois.',
  },
  {
    question: 'Tu veux que le risque pèse dans la tête du client. Que fais-tu ?',
    reponses: [
      'Je lui annonce le montant que ça coûterait',
      'Je lui demande à son avis combien ça représenterait',
      'Je lui montre une statistique nationale',
    ],
    bonne: 1,
    explication: 'Un chiffre posé par le client ne se discute plus. Un chiffre que tu annonces se conteste immédiatement. C’est la règle de la qualification en ligne droite.',
  },
  {
    question: 'Tu ouvres un RDV 3e pilier. Par quoi commences-tu, selon Start with Why ?',
    reponses: [
      'Par les avantages fiscaux du 3a',
      'Par ce qu’il tient à protéger, avec ses mots à lui',
      'Par la comparaison des rendements',
    ],
    bonne: 1,
    explication: 'Dès que le premier mot est « troisième pilier », le cadre est posé sur le QUOI et tout devient négociation. Le POURQUOI d’abord — et formulé par lui.',
  },
  {
    question: 'Un client veut résilier sa complémentaire hospitalisation pour économiser. Que fais-tu ?',
    reponses: [
      'Je résilie : c’est sa demande et il faut la respecter.',
      'Je l’avertis qu’un retour dépendra de son état de santé, puis il décide.',
      'Je refuse et je lui explique qu’il a tort.',
    ],
    bonne: 1,
    explication: 'La LCA est soumise au questionnaire de santé : sortir est facile, revenir ne l’est pas. Ton rôle est de rendre le choix éclairé, pas de le faire à sa place.',
  },
  {
    question: 'Où se cache le doublon d’assurance le plus fréquent en Suisse ?',
    reponses: ['La RC privée', 'La protection juridique', 'L’assurance voyage'],
    bonne: 1,
    explication: 'Très souvent incluse dans le contrat ménage ET souscrite séparément. C’est la première chose à vérifier dans un audit : gain immédiat et démonstration de ta valeur.',
  },
  {
    question: 'Un indépendant est en arrêt maladie depuis deux mois. Qu’est-ce qui le protège ?',
    reponses: [
      'La LAMal, qui verse des indemnités journalières',
      'La LAA, obligatoire pour tous',
      'Rien, sauf s’il a souscrit une perte de gain',
    ],
    bonne: 2,
    explication: 'La LAMal paie les soins, pas le revenu. La LAA ne s’applique pas à l’indépendant. Sans perte de gain, il n’a aucun revenu de remplacement — c’est LE trou de couverture à traquer.',
  },
  {
    question: 'Client propriétaire à Genève. Qui assure le bâtiment ?',
    reponses: [
      'L’établissement cantonal, comme dans le canton de Vaud',
      'Un assureur privé, au choix du propriétaire',
      'C’est inclus dans la RC privée',
    ],
    bonne: 1,
    explication: 'Genève et le Valais fonctionnent en marché privé, contrairement au canton de Vaud et son ECA. Donc un vrai marché à comparer — ton terrain de courtier.',
  },
  {
    question: 'Quel est le meilleur moment pour réduire une casco complète en casco partielle ?',
    reponses: [
      'Jamais, la complète est toujours préférable',
      'Quand la valeur résiduelle du véhicule ne justifie plus la prime',
      'Dès la deuxième année, systématiquement',
    ],
    bonne: 1,
    explication: 'Cela dépend de la valeur du véhicule et de la prime, pas d’une règle d’âge fixe. Chiffres à l’appui, c’est une des économies les plus faciles à démontrer.',
  },
  {
    question: 'Un salarié à temps très partiel te dit être couvert pour ses accidents de ski.',
    reponses: [
      'C’est exact, la LAA couvre tous les accidents',
      'À vérifier : sous un certain temps de travail hebdomadaire, les accidents non professionnels ne sont pas couverts',
      'Seule la LAMal couvre les loisirs',
    ],
    bonne: 1,
    explication: 'La couverture des accidents non professionnels dépend du temps de travail hebdomadaire. En dessous du seuil, il faut inclure le risque accident dans la LAMal. À vérifier systématiquement chez les temps partiels.',
  },
  {
    question: 'Une PME te dit avoir « tout ce qu’il faut » côté assurances choses.',
    reponses: [
      'Je la crois et je passe à autre chose',
      'Je demande ce qui se passerait si les locaux étaient inutilisables trois mois',
      'Je propose directement une offre moins chère',
    ],
    bonne: 1,
    explication: 'L’interruption d’exploitation est presque toujours l’oubliée. La question fait apparaître le trou sans contredire le dirigeant — il le découvre lui-même.',
  },
  {
    question: 'Client hésitant entre 3a bancaire et 3a d’assurance. Sur quoi se décide le choix ?',
    reponses: [
      'Le rendement affiché',
      'L’horizon de placement et le besoin de couvrir un risque',
      'Le montant du plafond fiscal',
    ],
    bonne: 1,
    explication: 'Le bancaire est souple, l’assurance protège la famille mais engage sur la durée. Le plafond fiscal est identique. Poser la question de l’horizon avant de proposer quoi que ce soit.',
  },
];
