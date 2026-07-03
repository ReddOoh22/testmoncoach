const SESSIONS = [
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
      {
        id: "pompes",
        name: "Pompes",
        media: "assets/pompes.mp4",
        mediaType: "video",
        sets: 3,
        target: "8-12 reps",
        restSeconds: 90,
        instructions: "Corps aligne. Descends de maniere controlee, puis pousse fort sans aller a l'echec."
      },
      {
        id: "rowing-haltere",
        name: "Rowing haltere par bras",
        media: "assets/rowing-haltere.mp4",
        mediaType: "video",
        sets: 3,
        target: "10-12 reps par bras",
        restSeconds: 60,
        instructions: "Dos droit. Tire le coude vers l'arriere sans tourner le buste."
      },
      {
        id: "developpe-epaules",
        name: "Developpe epaules haltere par bras",
        media: "assets/developpe-epaules.mp4",
        mediaType: "video",
        sets: 3,
        target: "8-10 reps par bras",
        restSeconds: 60,
        instructions: "Pousse l'haltere au-dessus de la tete en gardant le buste stable."
      },
      {
        id: "tractions",
        name: "Tractions",
        media: "assets/tractions.png",
        mediaType: "image",
        sets: 4,
        target: "2-4 reps",
        restSeconds: 120,
        instructions: "Tire la poitrine vers la barre. Garde le mouvement propre et controle."
      },
      {
        id: "planche",
        name: "Planche",
        media: "assets/planche.jpg",
        mediaType: "image",
        sets: 3,
        target: "25-40 sec",
        restSeconds: 45,
        instructions: "Corps droit, abdos serres. Evite de creuser le bas du dos."
      },
      {
        id: "dead-bug",
        name: "Dead bug par cote",
        media: "assets/dead-bug.webp",
        mediaType: "image",
        sets: 3,
        target: "8 reps par cote",
        restSeconds: 45,
        instructions: "Bas du dos proche du sol. Bouge lentement bras et jambe opposes."
      }
    ],
    cooldown: [
      "Etirement pectoraux contre un mur : 30 sec par cote",
      "Posture de l'enfant : 45 sec",
      "Respiration lente : 1 min"
    ]
  },
  {
    id: "session-b",
    title: "Seance B",
    subtitle: "Jambes + dos + velo",
    type: "renforcement",
    recommendedDay: "Vendredi",
    plannedDuration: "40-60 min",
    description: "Travail des jambes, du dos, du gainage lateral et velo simple en fin de seance.",
    warmup: [
      "Velo tres facile : 4 min",
      "10 squats lents",
      "10 fentes arriere alternees sans forcer",
      "10 rotations de chevilles par cote",
      "10 inclinaisons du buste",
      "20 sec de gainage"
    ],
    exercises: [
      {
        id: "squats",
        name: "Squats poids du corps",
        media: "assets/squats.webp",
        mediaType: "image",
        sets: 3,
        target: "12-15 reps",
        restSeconds: 60,
        instructions: "Descends en gardant le dos droit. Remonte sans verrouiller brutalement les genoux."
      },
      {
        id: "fentes-arrieres",
        name: "Fentes arriere par jambe",
        media: "assets/fentes-arrieres.png",
        mediaType: "image",
        sets: 3,
        target: "8 reps par jambe",
        restSeconds: 60,
        instructions: "Recule une jambe, descends sans forcer, puis reviens en position debout."
      },
      {
        id: "souleve-terre-roumain",
        name: "Souleve de terre roumain haltere",
        media: "assets/souleve-terre-roumain.png.webp",
        mediaType: "image",
        sets: 3,
        target: "10-12 reps",
        restSeconds: 60,
        instructions: "Pousse les hanches vers l'arriere, garde le dos droit et remonte en controlant."
      },
      {
        id: "rowing-haltere-b",
        name: "Rowing haltere par bras",
        media: "assets/rowing-haltere.mp4",
        mediaType: "video",
        sets: 3,
        target: "10-12 reps par bras",
        restSeconds: 60,
        instructions: "Controle la montee et la descente. Le buste reste stable."
      },
      {
        id: "gainage-lateral",
        name: "Gainage lateral par cote",
        media: "assets/gainage-lateral.jpeg",
        mediaType: "image",
        sets: 2,
        target: "20-30 sec par cote",
        restSeconds: 30,
        instructions: "Bassin aligne. Ne laisse pas les hanches tomber."
      },
      {
        id: "velo-appartement",
        name: "Velo d'appartement",
        media: "assets/velo-appartement.jpg",
        mediaType: "image",
        sets: 1,
        target: "10-20 min facile/modere",
        restSeconds: 0,
        instructions: "Intensite confortable. Tu dois finir en te disant que tu pourrais continuer."
      }
    ],
    cooldown: [
      "Etirement quadriceps : 30 sec par jambe",
      "Etirement mollets : 30 sec par jambe",
      "Etirement fessiers : 30 sec par cote",
      "Respiration lente : 1 min"
    ]
  },
  {
    id: "mini-routine",
    title: "Mini-routine",
    subtitle: "Mobilite + gainage",
    type: "routine",
    recommendedDay: "Lundi",
    plannedDuration: "10-15 min",
    description: "Seance courte pour garder la regularite meme avec peu de temps.",
    warmup: [],
    exercises: [
      {
        id: "mini-squats",
        name: "Squats",
        media: "assets/squats.webp",
        mediaType: "image",
        sets: 3,
        target: "10 reps",
        restSeconds: 45,
        instructions: "Mouvement fluide, sans chercher la performance."
      },
      {
        id: "mini-pompes",
        name: "Pompes",
        media: "assets/pompes.mp4",
        mediaType: "video",
        sets: 3,
        target: "8 reps",
        restSeconds: 45,
        instructions: "Corps aligne. Adapte en inclinant les mains si besoin."
      },
      {
        id: "mini-rowing",
        name: "Rowing haltere par bras",
        media: "assets/rowing-haltere.mp4",
        mediaType: "video",
        sets: 3,
        target: "10 reps par bras",
        restSeconds: 45,
        instructions: "Tire le coude vers l'arriere, dos stable."
      },
      {
        id: "mini-gainage",
        name: "Gainage",
        media: "assets/planche.jpg",
        mediaType: "image",
        sets: 3,
        target: "20-30 sec",
        restSeconds: 45,
        instructions: "Corps droit, abdos serres."
      },
      {
        id: "mini-dead-bug",
        name: "Dead bug par cote",
        media: "assets/dead-bug.webp",
        mediaType: "image",
        sets: 3,
        target: "10 reps par cote",
        restSeconds: 45,
        instructions: "Lentement, sans decoller le bas du dos."
      }
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
      {
        id: "urgence-pompes",
        name: "Pompes",
        media: "assets/pompes.mp4",
        mediaType: "video",
        sets: 2,
        target: "10 reps",
        restSeconds: 30,
        instructions: "Fais propre, meme si tu dois adapter."
      },
      {
        id: "urgence-squats",
        name: "Squats",
        media: "assets/squats.webp",
        mediaType: "image",
        sets: 2,
        target: "15 reps",
        restSeconds: 30,
        instructions: "Mouvement simple et controle."
      },
      {
        id: "urgence-gainage",
        name: "Gainage",
        media: "assets/planche.jpg",
        mediaType: "image",
        sets: 2,
        target: "30 sec",
        restSeconds: 30,
        instructions: "Tiens proprement, sans creuser le dos."
      }
    ],
    cooldown: []
  }
];
