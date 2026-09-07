/**
 * Les deux méthodes de référence, adaptées au conseil en assurance suisse.
 *
 * 1. START WITH WHY (Simon Sinek) — l'ordre : Pourquoi → Comment → Quoi.
 * 2. LA LIGNE DROITE (Jordan Belfort) — structure d'entretien et bouclage.
 *
 * Sur la Ligne Droite, deux adaptations assumées :
 *   - la rareté fabriquée est remplacée par les échéances RÉELLES du marché
 *     suisse (clôture fiscale du 3a, délai de résiliation LAMal) : inutile
 *     d'inventer une urgence quand il en existe de vraies ;
 *   - « amplifier la douleur » devient « faire quantifier le risque par le
 *     client lui-même » — même effet, mais c'est lui qui pose le chiffre,
 *     ce qui tient devant un devoir de conseil.
 */

export const LIGNE_DROITE = {
  principe: {
    titre: 'Le principe',
    texte: `Un entretien va d'un point A (l'ouverture) à un point B (la décision) en ligne droite.
      Le client, lui, cherche constamment à en sortir : digressions, questions annexes, objections.
      Ton travail n'est pas de l'empêcher de dévier — c'est de le ramener sur la ligne, à chaque fois,
      sans jamais le brusquer.`,
    cle: 'Tout ce qui ne rapproche pas du point B éloigne du point B.',
  },

  certitudes: [
    {
      nom: 'Certitude 1 — la solution',
      question: 'Est-il convaincu que CE type de couverture répond à SON problème ?',
      commentFaire: `Ne présente jamais un produit avant d'avoir entendu le problème de sa bouche.
        La certitude ne se construit pas en expliquant mieux, mais en reliant ce que tu proposes
        à ce qu'il vient de te dire.`,
      phrase: 'Si je résume ce que vous venez de me dire : ce qui vous préoccupe, c’est [X]. C’est bien ça ?',
    },
    {
      nom: 'Certitude 2 — toi',
      question: 'Te fait-il confiance, à toi personnellement ?',
      commentFaire: `Elle se joue dans les premières secondes, et elle se prouve en disant une fois
        quelque chose qui ne t'arrange pas. Un courtier qui reconnaît qu'un contrat existant est bon
        gagne plus de crédit que dix arguments.`,
      phrase: 'Franchement, sur ce contrat-là, vous êtes bien couvert. Je ne vais pas vous vendre autre chose pour le plaisir.',
    },
    {
      nom: 'Certitude 3 — le processus',
      question: 'Croit-il à ta méthode de comparaison, plus qu’à une compagnie ?',
      commentFaire: `C'est ici que le courtier diffère du modèle original : tu ne vends pas la
        certitude d'une compagnie, mais celle de ton indépendance. Explique COMMENT tu compares,
        pas seulement avec qui.`,
      phrase: 'Je compare les offres du marché sur vos critères à vous, et je vous montre le tableau complet — y compris ce que je ne recommande pas.',
    },
  ],

  etapes: [
    {
      nom: '1. Les premières secondes',
      objectif: 'Être perçu comme vif, enthousiaste et compétent — avant même le contenu.',
      detail: `Belfort résume à trois impressions à donner immédiatement : tu es vif d'esprit,
        tu es enthousiaste, tu es une autorité dans ton domaine. Rien de tout cela ne passe par
        les mots : c'est le rythme, l'énergie, la posture.`,
      aFaire: 'Rythme net, sourire audible, aucune hésitation sur qui tu es et ce que tu fais.',
      aEviter: 'Le ton d’excuse : « je ne vais pas vous déranger longtemps », « je me permets de… ».',
    },
    {
      nom: '2. La qualification',
      objectif: 'Comprendre la situation, et faire chiffrer le risque par le client.',
      detail: `L'étape la plus négligée. On y découvre la situation, mais surtout ce qui se passerait
        si rien ne changeait. La règle : c'est LUI qui pose le chiffre, jamais toi. Un risque qu'il
        a quantifié lui-même ne se discute plus.`,
      aFaire: 'Questions ouvertes, puis : « à votre avis, ça représenterait combien, concrètement ? »',
      aEviter: 'Annoncer toi-même le montant du risque. Il le contestera, ou il ne le retiendra pas.',
    },
    {
      nom: '3. La présentation sur la ligne',
      objectif: 'Relier chaque élément de la solution à ce qu’il a dit en qualification.',
      detail: `Chaque garantie présentée doit renvoyer à une phrase qu'il a prononcée. Si tu ne peux
        pas faire ce lien, c'est que la garantie ne sert pas son besoin — enlève-la de la présentation.`,
      aFaire: 'Vous m’avez dit [sa phrase] — c’est exactement ce que couvre ce point.',
      aEviter: 'Le catalogue de garanties. Chaque élément non relié fait sortir de la ligne.',
    },
    {
      nom: '4. Le bouclage (looping)',
      objectif: 'Traiter l’objection sans jamais la contredire.',
      detail: `Une objection est rarement un refus : c'est un niveau de certitude insuffisant sur
        l'un des trois axes. On ne la combat pas — on remonte la certitude qui manque, puis on
        redemande l'engagement. On peut boucler plusieurs fois, tant que le ton reste calme.`,
      aFaire: 'Je comprends tout à fait… (puis on remonte la certitude qui manque) … ça a du sens pour vous ?',
      aEviter: 'Défendre le prix frontalement. C’est le terrain où le client gagne toujours.',
    },
    {
      nom: '5. La demande d’engagement',
      objectif: 'Demander clairement, une fois, sans meubler le silence.',
      detail: `La demande doit être explicite et suivie d'un silence. Le silence appartient au client :
        celui qui le comble en premier a perdu la main.`,
      aFaire: 'Sur cette base, est-ce qu’on avance ? — puis tu te tais.',
      aEviter: 'Enchaîner un argument de plus par malaise. C’est le réflexe qui tue le plus de closings.',
    },
  ],

  tonalites: [
    ['Certitude absolue', 'Sur ce que tu affirmes vraiment. Voix stable, phrase courte, pas de « je pense que ».'],
    ['Question déguisée en affirmation', 'Monter légèrement en fin de phrase transforme une info en vérification implicite : « vous êtes bien locataire ? »'],
    ['Sincérité', 'Ralentir et baisser le volume quand tu dis quelque chose d’important. Le contraste fait le poids.'],
    ['Curiosité réelle', 'Sur les questions de découverte. S’il sent une question de formulaire, il répond par un formulaire.'],
    ['Échéance réelle', 'Jamais de rareté inventée. La clôture fiscale du 3a et le délai de résiliation LAMal existent : ils suffisent.'],
  ],

  ethique: `La Ligne Droite a été conçue pour vendre vite, par quelqu'un qui a été condamné pour
    fraude. Les outils de structure sont excellents et parfaitement légitimes : trois certitudes,
    bouclage, tonalité, demande explicite. Les leviers de pression — rareté fabriquée, amplification
    artificielle de la peur, insistance après un non — ne le sont pas dans un métier réglementé.
    Un client sous pression signe une fois, résilie l'année suivante et ne recommande personne.
    Garde la structure, laisse la pression.`,
};

export const START_WITH_WHY = {
  principe: {
    titre: 'Le cercle d’or',
    texte: `Les gens n'achètent pas ce que tu fais, mais pourquoi tu le fais. L'ordre de la
      conversation compte plus que son contenu : Pourquoi, puis Comment, puis Quoi.`,
    cle: 'Une prime n’est « chère » que si elle ne pèse contre rien.',
  },

  cercle: [
    {
      niveau: 'POURQUOI',
      cote_client: 'Ce qu’il protège vraiment : ses enfants, l’entreprise qu’il a bâtie, sa liberté de choisir plus tard, sa peur d’être un poids.',
      cote_toi: 'Pourquoi tu fais ce métier. Si tu ne sais pas le dire en une phrase, personne ne le devinera.',
      phrase: 'S’il y a une chose que vous tenez à protéger avant tout — pour vous ou pour vos proches — ce serait quoi ?',
    },
    {
      niveau: 'COMMENT',
      cote_client: 'Ce à quoi il tient dans la manière : être écouté, comprendre, ne pas être pressé.',
      cote_toi: 'Ton approche : bilan structuré, comparaison indépendante, un conseil qui reste valable même sans signature.',
      phrase: 'Ma façon de travailler : je compare le marché sur vos critères, et je vous dis aussi ce qu’il ne faut PAS changer.',
    },
    {
      niveau: 'QUOI',
      cote_client: 'Le produit, la prime, les garanties. Ce dont tout le monde parle en premier.',
      cote_toi: 'Ce que tu proposes concrètement — et qui n’a de sens qu’après les deux étages du dessus.',
      phrase: 'Concrètement, ça se traduit par [produit], à [montant] par mois.',
    },
  ],

  pourquoiCaMarche: `Ton point faible connu est l'objection prix sur les gros tickets. Or un prix
    ne se juge jamais dans l'absolu : il se compare à ce qu'il protège. Quand le POURQUOI est
    établi ET formulé par le client, la prime se compare à ses enfants ou à son entreprise. Quand
    il ne l'est pas, elle se compare à zéro — et l'objection devient imparable.`,

  erreurs: [
    ['Affirmer le pourquoi à sa place', 'Vous voulez protéger votre famille, n’est-ce pas ? → il acquiesce sans y croire. Fais-le dire.'],
    ['Ouvrir sur le produit', 'Dès que le premier mot est « troisième pilier », le cadre est posé sur le QUOI. Tout le reste devient de la négociation.'],
    ['Confondre pourquoi et besoin', 'Le besoin est « une couverture décès ». Le pourquoi est « que ma femme garde la maison ». Le second se retient.'],
  ],
};

/** Les deux méthodes fonctionnent ensemble : Why donne le CAP, Ligne Droite donne le CHEMIN. */
export const COMBINAISON = {
  titre: 'Comment les deux s’articulent',
  texte: `Start with Why fixe le point B : ce que le client protège, énoncé par lui.
    La Ligne Droite fournit le chemin pour y aller sans s'égarer. Concrètement :`,
  etapes: [
    ['Ouverture', 'Ligne Droite : vif, enthousiaste, compétent en quatre secondes.'],
    ['Qualification', 'Why : faire dire le POURQUOI. Ligne Droite : lui faire chiffrer le risque.'],
    ['Présentation', 'Why : relier chaque garantie à son pourquoi. Ligne Droite : rester sur la ligne.'],
    ['Objection', 'Ligne Droite : boucler sans contredire. Why : ramener au pourquoi avant de reparler du prix.'],
    ['Closing', 'Ligne Droite : demander clairement, puis se taire.'],
  ],
};
