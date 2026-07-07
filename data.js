const DEFAULT_PROGRAM = {
  id: "program-reprise-4-semaines",
  name: "Programme reprise sportive",
  durationWeeks: 4,
  weeklyTarget: 3,
  notes: [
    "Regularite avant performance.",
    "Douleur articulaire nette = arret de l'exercice.",
    "Garde toujours 2 a 3 repetitions en reserve."
  ],
  sessions: [
    {
      id: "session-a",
      title: "Seance A",
      subtitle: "Haut du corps + gainage",
      type: "renforcement",
      recommendedDay: "Mercredi",
      plannedDuration: "35-50 min",
      description: "Travail du haut du corps, du dos, des epaules et du gainage.",
      warmup: [
        "1 min marche active ou velo tranquille",
        "10 cercles d'epaules avant + 10 arriere",
        "10 rotations de bassin",
        "10 squats lents au poids du corps",
        "10 pompes inclinees",
        "20 sec de gainage leger"
      ],
      exercises: [
        { id: "pompes", name: "Pompes", media: "assets/pompes.mp4", mediaType: "video", sets: 3, target: "8-12 reps", restSeconds: 90, category: "haut", equipment: ["poids-corps"], instructions: "Corps aligne. Descends controle, puis pousse sans aller a l'echec." },
        { id: "rowing-haltere", name: "Rowing haltere par bras", media: "assets/rowing-haltere.mp4", mediaType: "video", sets: 3, target: "10-12 reps par bras", restSeconds: 60, category: "dos", equipment: ["haltere"], instructions: "Dos droit. Tire le coude vers l'arriere sans tourner le buste." },
        { id: "developpe-epaules", name: "Developpe epaules haltere", media: "assets/developpe-epaules.mp4", mediaType: "video", sets: 3, target: "8-10 reps par bras", restSeconds: 60, category: "epaules", equipment: ["haltere"], instructions: "Pousse l'haltere au-dessus de la tete en gardant le buste stable." },
        { id: "tractions", name: "Tractions", media: "assets/tractions.png", mediaType: "image", sets: 4, target: "2-4 reps", restSeconds: 120, category: "dos", equipment: ["barre"], instructions: "Tire la poitrine vers la barre. Mouvement propre et controle." },
        { id: "planche", name: "Planche", media: "assets/planche.jpg", mediaType: "image", sets: 3, target: "25-40 sec", restSeconds: 45, category: "gainage", equipment: ["tapis"], instructions: "Corps droit, abdos serres, bas du dos neutre." },
        { id: "dead-bug", name: "Dead bug", media: "assets/dead-bug.webp", mediaType: "image", sets: 3, target: "8 reps par cote", restSeconds: 45, category: "gainage", equipment: ["tapis"], instructions: "Bas du dos proche du sol. Bouge lentement bras et jambe opposes." }
      ],
      cooldown: ["Etirement pectoraux : 30 sec par cote", "Posture de l'enfant : 45 sec", "Respiration lente : 1 min"]
    },
    {
      id: "session-b",
      title: "Seance B",
      subtitle: "Jambes + dos + velo",
      type: "renforcement",
      recommendedDay: "Vendredi",
      plannedDuration: "40-60 min",
      description: "Travail jambes, dos, gainage lateral et velo simple en fin de seance.",
      warmup: ["Velo tres facile : 4 min", "10 squats lents", "10 fentes arriere alternees", "10 rotations de chevilles par cote", "10 inclinaisons du buste", "20 sec de gainage"],
      exercises: [
        { id: "squats", name: "Squats poids du corps", media: "assets/squats.webp", mediaType: "image", sets: 3, target: "12-15 reps", restSeconds: 60, category: "jambes", equipment: ["poids-corps"], instructions: "Descends en gardant le dos droit. Remonte sans verrouiller brutalement les genoux." },
        { id: "fentes-arrieres", name: "Fentes arriere", media: "assets/fentes-arrieres.png", mediaType: "image", sets: 3, target: "8 reps par jambe", restSeconds: 60, category: "jambes", equipment: ["poids-corps"], instructions: "Recule une jambe, descends sans forcer, puis reviens debout." },
        { id: "souleve-terre-roumain", name: "Souleve de terre roumain", media: "assets/souleve-terre-roumain.png.webp", mediaType: "image", sets: 3, target: "10-12 reps", restSeconds: 60, category: "jambes", equipment: ["haltere"], instructions: "Hanches vers l'arriere, dos droit, remontee controlee." },
        { id: "rowing-haltere-b", name: "Rowing haltere par bras", media: "assets/rowing-haltere.mp4", mediaType: "video", sets: 3, target: "10-12 reps par bras", restSeconds: 60, category: "dos", equipment: ["haltere"], instructions: "Controle la montee et la descente. Buste stable." },
        { id: "gainage-lateral", name: "Gainage lateral", media: "assets/gainage-lateral.jpeg", mediaType: "image", sets: 2, target: "20-30 sec par cote", restSeconds: 30, category: "gainage", equipment: ["tapis"], instructions: "Bassin aligne. Ne laisse pas les hanches tomber." },
        { id: "velo-appartement", name: "Velo d'appartement", media: "assets/velo-appartement.jpg", mediaType: "image", sets: 1, target: "10-20 min facile", restSeconds: 0, category: "cardio", equipment: ["velo"], instructions: "Intensite confortable. Tu dois pouvoir continuer." }
      ],
      cooldown: ["Etirement quadriceps : 30 sec par jambe", "Etirement mollets : 30 sec par jambe", "Etirement fessiers : 30 sec par cote", "Respiration lente : 1 min"]
    },
    {
      id: "mini-routine",
      title: "Mini-routine",
      subtitle: "Mobilite + gainage",
      type: "routine",
      recommendedDay: "Lundi",
      plannedDuration: "10-15 min",
      description: "Seance courte pour garder la regularite avec peu de temps.",
      warmup: [],
      exercises: [
        { id: "mini-squats", name: "Squats", media: "assets/squats.webp", mediaType: "image", sets: 3, target: "10 reps", restSeconds: 45, category: "jambes", equipment: ["poids-corps"], instructions: "Mouvement fluide, sans chercher la performance." },
        { id: "mini-pompes", name: "Pompes", media: "assets/pompes.mp4", mediaType: "video", sets: 3, target: "8 reps", restSeconds: 45, category: "haut", equipment: ["poids-corps"], instructions: "Corps aligne. Adapte en inclinant les mains si besoin." },
        { id: "mini-rowing", name: "Rowing haltere", media: "assets/rowing-haltere.mp4", mediaType: "video", sets: 3, target: "10 reps par bras", restSeconds: 45, category: "dos", equipment: ["haltere"], instructions: "Tire le coude vers l'arriere, dos stable." },
        { id: "mini-gainage", name: "Gainage", media: "assets/planche.jpg", mediaType: "image", sets: 3, target: "20-30 sec", restSeconds: 45, category: "gainage", equipment: ["tapis"], instructions: "Corps droit, abdos serres." },
        { id: "mini-dead-bug", name: "Dead bug", media: "assets/dead-bug.webp", mediaType: "image", sets: 3, target: "10 reps par cote", restSeconds: 45, category: "gainage", equipment: ["tapis"], instructions: "Lentement, sans decoller le bas du dos." }
      ],
      cooldown: []
    },
    {
      id: "urgence",
      title: "Version urgence",
      subtitle: "10 minutes",
      type: "court",
      recommendedDay: "Jour charge",
      plannedDuration: "10 min",
      description: "Version minimale pour ne pas casser la routine.",
      warmup: [],
      exercises: [
        { id: "urgence-pompes", name: "Pompes", media: "assets/pompes.mp4", mediaType: "video", sets: 2, target: "10 reps", restSeconds: 30, category: "haut", equipment: ["poids-corps"], instructions: "Fais propre, meme si tu dois adapter." },
        { id: "urgence-squats", name: "Squats", media: "assets/squats.webp", mediaType: "image", sets: 2, target: "15 reps", restSeconds: 30, category: "jambes", equipment: ["poids-corps"], instructions: "Mouvement simple et controle." },
        { id: "urgence-gainage", name: "Gainage", media: "assets/planche.jpg", mediaType: "image", sets: 2, target: "30 sec", restSeconds: 30, category: "gainage", equipment: ["tapis"], instructions: "Tiens proprement, sans creuser le dos." }
      ],
      cooldown: []
    }
  ]
};

const EXERCISE_LIBRARY = [
  { id: "pompes", name: "Pompes", category: "haut", equipment: ["poids-corps"], media: "assets/pompes.mp4", mediaType: "video", defaultTarget: "8-12 reps", defaultRest: 90, instructions: "Corps aligne, descente controlee." },
  { id: "pompes-inclinees", name: "Pompes inclinees", category: "haut", equipment: ["poids-corps"], media: "assets/pompes.mp4", mediaType: "video", defaultTarget: "8-12 reps", defaultRest: 60, instructions: "Mains sur table ou mur pour reduire la difficulte." },
  { id: "rowing-haltere", name: "Rowing haltere", category: "dos", equipment: ["haltere"], media: "assets/rowing-haltere.mp4", mediaType: "video", defaultTarget: "10-12 reps par bras", defaultRest: 60, instructions: "Dos droit, coude vers l'arriere." },
  { id: "developpe-epaules", name: "Developpe epaules", category: "epaules", equipment: ["haltere"], media: "assets/developpe-epaules.mp4", mediaType: "video", defaultTarget: "8-10 reps par bras", defaultRest: 60, instructions: "Buste stable, poussee verticale." },
  { id: "tractions", name: "Tractions", category: "dos", equipment: ["barre"], media: "assets/tractions.png", mediaType: "image", defaultTarget: "2-4 reps", defaultRest: 120, instructions: "Mouvement propre, sans balancer." },
  { id: "squats", name: "Squats", category: "jambes", equipment: ["poids-corps"], media: "assets/squats.webp", mediaType: "image", defaultTarget: "12-15 reps", defaultRest: 60, instructions: "Dos droit, descente controlee." },
  { id: "goblet-squat", name: "Goblet squat", category: "jambes", equipment: ["haltere"], media: "assets/squats.webp", mediaType: "image", defaultTarget: "10-12 reps", defaultRest: 60, instructions: "Halteres contre la poitrine, mouvement controle." },
  { id: "fentes-arrieres", name: "Fentes arriere", category: "jambes", equipment: ["poids-corps"], media: "assets/fentes-arrieres.png", mediaType: "image", defaultTarget: "8 reps par jambe", defaultRest: 60, instructions: "Recule sans forcer, genou stable." },
  { id: "souleve-terre-roumain", name: "Souleve de terre roumain", category: "jambes", equipment: ["haltere"], media: "assets/souleve-terre-roumain.png.webp", mediaType: "image", defaultTarget: "10-12 reps", defaultRest: 60, instructions: "Hanches en arriere, dos droit." },
  { id: "planche", name: "Planche", category: "gainage", equipment: ["tapis"], media: "assets/planche.jpg", mediaType: "image", defaultTarget: "25-40 sec", defaultRest: 45, instructions: "Corps droit, abdos serres." },
  { id: "gainage-lateral", name: "Gainage lateral", category: "gainage", equipment: ["tapis"], media: "assets/gainage-lateral.jpeg", mediaType: "image", defaultTarget: "20-30 sec par cote", defaultRest: 30, instructions: "Bassin aligne." },
  { id: "dead-bug", name: "Dead bug", category: "gainage", equipment: ["tapis"], media: "assets/dead-bug.webp", mediaType: "image", defaultTarget: "8-10 reps par cote", defaultRest: 45, instructions: "Lent, bas du dos proche du sol." },
  { id: "bird-dog", name: "Bird dog", category: "gainage", equipment: ["tapis"], media: null, mediaType: "none", defaultTarget: "8 reps par cote", defaultRest: 30, instructions: "A quatre pattes, bras et jambe opposes." },
  { id: "glute-bridge", name: "Pont fessier", category: "jambes", equipment: ["tapis"], media: null, mediaType: "none", defaultTarget: "12-15 reps", defaultRest: 45, instructions: "Monte le bassin, serre les fessiers." },
  { id: "superman", name: "Superman", category: "dos", equipment: ["tapis"], media: null, mediaType: "none", defaultTarget: "10-12 reps", defaultRest: 45, instructions: "Allonge au sol, leve bras et jambes legerement." },
  { id: "mollets", name: "Releves de mollets", category: "jambes", equipment: ["poids-corps"], media: null, mediaType: "none", defaultTarget: "15-20 reps", defaultRest: 45, instructions: "Monte sur la pointe des pieds, redescends controle." },
  { id: "mountain-climber", name: "Mountain climber lent", category: "cardio", equipment: ["poids-corps"], media: null, mediaType: "none", defaultTarget: "20-30 sec", defaultRest: 45, instructions: "Version lente, bassin stable." },
  { id: "velo-appartement", name: "Velo d'appartement", category: "cardio", equipment: ["velo"], media: "assets/velo-appartement.jpg", mediaType: "image", defaultTarget: "10-20 min facile", defaultRest: 0, instructions: "Intensite confortable." }
];
