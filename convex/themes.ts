export interface ThemeRoleConfig {
  id: string; // e.g. "merlin", "percival", "servant", "assassin", "morgana", "mordred", "oberon", "minion"
  name: string;
  team: "good" | "evil";
  desc: string;
  knowledgeLabel: string;
  abilities: Array<{
    type: "reveal" | "assassinate";
    target?: {
      team?: "good" | "evil";
      roles?: string[];
      excludeRoles?: string[];
    };
    targetRole?: string;
  }>;
}

export interface ThemeConfig {
  id: string;
  name: string;
  tagline: string;
  devanagariLabel?: string; // Sub-title line for flavor (e.g. Devanagari script for India/Maratha)
  crestIcon: "chakra" | "shield" | "ankh" | "lightning" | "fort";
  goodTeamName: string;
  evilTeamName: string;
  colors: {
    ink: string;
    ink2: string;
    panel: string;
    panel2: string;
    line: string;
    gold: string;
    goldDim: string;
    parch: string;
    parchDim: string;
    good: string;
    goodDk: string;
    evil: string;
    evilDk: string;
  };
  roles: ThemeRoleConfig[];
  winReasons: {
    fiveRejections: string;
    threeFails: string;
    assassinHit: string;
    assassinMiss: string;
  };
}

export const THEMES: Record<string, ThemeConfig> = {
  india: {
    id: "india",
    name: "Indian Mythology",
    tagline:
      "Dharma vs Adharma. Every world has heroes. Every kingdom has traitors.",
    devanagariLabel: "धर्मसंस्थापनार्थाय सम्भवामि युगे युगे",
    crestIcon: "chakra",
    goodTeamName: "Pandavas",
    evilTeamName: "Kauravas",
    colors: {
      ink: "#160b22",
      ink2: "#1f1430",
      panel: "#251732",
      panel2: "#2f1d40",
      line: "#43305a",
      gold: "#e3a93c",
      goldDim: "#a9802c",
      parch: "#f2e7d0",
      parchDim: "#bcae93",
      good: "#3f9f8e",
      goodDk: "#1d4a43",
      evil: "#c14a3f",
      evilDk: "#5e201b",
    },
    roles: [
      {
        id: "merlin",
        name: "Krishna",
        team: "good",
        desc: "The divine charioteer. You perceive the Kauravas — but Duryodhana is veiled from your sight. Guide the Pandavas subtly: should Ashwatthama name you at the end, dharma falls.",
        knowledgeLabel:
          "The Kauravas you perceive (Duryodhana is veiled from you):",
        abilities: [
          {
            type: "reveal",
            target: { team: "evil", excludeRoles: ["mordred"] },
          },
        ],
      },
      {
        id: "percival",
        name: "Arjuna",
        team: "good",
        desc: "Greatest of archers. You behold two figures — Krishna and the deceiver Shakuni — yet cannot tell which is divine. Find and shield the true guide.",
        knowledgeLabel:
          "One of these is Krishna, one is Shakuni — you cannot tell which:",
        abilities: [
          {
            type: "reveal",
            target: { roles: ["merlin", "morgana"] },
          },
        ],
      },
      {
        id: "servant",
        name: "Pandava Warrior",
        team: "good",
        desc: "A loyal soldier of dharma. You hold no divine sight — read the field, weigh each word, and fight true.",
        knowledgeLabel: "You hold no divine sight. Trust your dharma.",
        abilities: [],
      },
      {
        id: "assassin",
        name: "Ashwatthama",
        team: "evil",
        desc: "Wrathful son of Drona. Should the Pandavas win three battles, you may strike in the night — name Krishna to seize victory for adharma.",
        knowledgeLabel: "Your fellow Kauravas (Jayadratha stays hidden):",
        abilities: [
          {
            type: "reveal",
            target: { team: "evil", excludeRoles: ["oberon"] },
          },
          {
            type: "assassinate",
            targetRole: "merlin",
          },
        ],
      },
      {
        id: "morgana",
        name: "Shakuni",
        team: "evil",
        desc: "Master of dice and deceit. To Arjuna you appear as Krishna himself, clouding the search for the true guide.",
        knowledgeLabel: "Your fellow Kauravas (Jayadratha stays hidden):",
        abilities: [
          {
            type: "reveal",
            target: { team: "evil", excludeRoles: ["oberon"] },
          },
        ],
      },
      {
        id: "mordred",
        name: "Duryodhana",
        team: "evil",
        desc: "Lord of the Kauravas. Even Krishna's sight cannot pierce your veil. Command from the shadows.",
        knowledgeLabel: "Your fellow Kauravas (Jayadratha stays hidden):",
        abilities: [
          {
            type: "reveal",
            target: { team: "evil", excludeRoles: ["oberon"] },
          },
        ],
      },
      {
        id: "oberon",
        name: "Jayadratha",
        team: "evil",
        desc: "A lone agent of adharma. You know not your fellow Kauravas, nor they you — yet Krishna sees you plainly.",
        knowledgeLabel: "You fight alone — you know no other Kauravas.",
        abilities: [],
      },
      {
        id: "minion",
        name: "Kaurava Warrior",
        team: "evil",
        desc: "A soldier of adharma. You know your fellow Kauravas. Sabotage the battles without being unmasked.",
        knowledgeLabel: "Your fellow Kauravas (Jayadratha stays hidden):",
        abilities: [
          {
            type: "reveal",
            target: { team: "evil", excludeRoles: ["oberon"] },
          },
        ],
      },
    ],
    winReasons: {
      fiveRejections:
        "Five war parties rejected in a row — the council collapses into chaos. Adharma triumphs.",
      threeFails:
        "Three battles lost — the Kauravas overrun Kurukshetra. Adharma triumphs.",
      assassinHit:
        "Ashwatthama's strike finds Krishna! Against all dharma, adharma seizes victory.",
      assassinMiss:
        "Ashwatthama strikes the wrong warrior — Krishna lives. Dharma prevails upon Kurukshetra!",
    },
  },
  medieval: {
    id: "medieval",
    name: "Medieval Kingdom",
    tagline: "Every world has heroes. Every kingdom has traitors.",
    crestIcon: "shield",
    goodTeamName: "Knights of Arthur",
    evilTeamName: "Minions of Mordred",
    colors: {
      ink: "#0a1128",
      ink2: "#121e40",
      panel: "#1c2d5a",
      panel2: "#253c73",
      line: "#3d5a80",
      gold: "#e2b13c",
      goldDim: "#a8832c",
      parch: "#e0f1f7",
      parchDim: "#98c1d9",
      good: "#3f9f8e",
      goodDk: "#1d4a43",
      evil: "#c14a3f",
      evilDk: "#5e201b",
    },
    roles: [
      {
        id: "merlin",
        name: "Merlin",
        team: "good",
        desc: "The wise wizard. You perceive the minions of Mordred, but Mordred himself is veiled from your sight. Guide the knights of Arthur subtly: if the Assassin names you at the end, Arthur's cause falls.",
        knowledgeLabel: "The minions of evil you perceive (Mordred is veiled):",
        abilities: [
          {
            type: "reveal",
            target: { team: "evil", excludeRoles: ["mordred"] },
          },
        ],
      },
      {
        id: "percival",
        name: "Percival",
        team: "good",
        desc: "The noble protector. You behold two figures — Merlin and the deceiver Morgana — yet cannot tell which is the true wizard. Find and shield the true guide.",
        knowledgeLabel:
          "One of these is Merlin, one is Morgana — you cannot tell which:",
        abilities: [
          {
            type: "reveal",
            target: { roles: ["merlin", "morgana"] },
          },
        ],
      },
      {
        id: "servant",
        name: "Loyal Knight",
        team: "good",
        desc: "A loyal servant of Arthur. You hold no magical sight — read the field, weigh each word, and vote true to complete the quests.",
        knowledgeLabel: "You hold no magical sight. Trust your companions.",
        abilities: [],
      },
      {
        id: "assassin",
        name: "Assassin",
        team: "evil",
        desc: "Wrathful agent of Mordred. Should Arthur's knights complete three quests, you may strike in the night — name Merlin to seize victory for evil.",
        knowledgeLabel: "Your fellow minions of evil (Oberon stays hidden):",
        abilities: [
          {
            type: "reveal",
            target: { team: "evil", excludeRoles: ["oberon"] },
          },
          {
            type: "assassinate",
            targetRole: "merlin",
          },
        ],
      },
      {
        id: "morgana",
        name: "Morgana",
        team: "evil",
        desc: "Mistress of illusions. To Percival you appear as Merlin himself, clouding the search for the true wizard.",
        knowledgeLabel: "Your fellow minions of evil (Oberon stays hidden):",
        abilities: [
          {
            type: "reveal",
            target: { team: "evil", excludeRoles: ["oberon"] },
          },
        ],
      },
      {
        id: "mordred",
        name: "Mordred",
        team: "evil",
        desc: "The dark lord of rebellion. Even Merlin's sight cannot pierce your veil. Command from the shadows.",
        knowledgeLabel: "Your fellow minions of evil (Oberon stays hidden):",
        abilities: [
          {
            type: "reveal",
            target: { team: "evil", excludeRoles: ["oberon"] },
          },
        ],
      },
      {
        id: "oberon",
        name: "Oberon",
        team: "evil",
        desc: "A lone agent of chaos. You know not your fellow minions, nor they you — yet Merlin sees you plainly.",
        knowledgeLabel: "You fight alone — you know no other evil minions.",
        abilities: [],
      },
      {
        id: "minion",
        name: "Minion of Mordred",
        team: "evil",
        desc: "A loyal soldier of evil. You know your fellow minions. Sabotage the quests without being unmasked.",
        knowledgeLabel: "Your fellow minions of evil (Oberon stays hidden):",
        abilities: [
          {
            type: "reveal",
            target: { team: "evil", excludeRoles: ["oberon"] },
          },
        ],
      },
    ],
    winReasons: {
      fiveRejections:
        "Five quest parties rejected in a row — the round table collapses into chaos. Evil triumphs.",
      threeFails:
        "Three quests failed — the minions of Mordred overrun Camelot. Evil triumphs.",
      assassinHit:
        "The Assassin's strike finds Merlin! Against all odds, Mordred seizes victory.",
      assassinMiss:
        "The Assassin strikes the wrong knight — Merlin lives. Arthur's kingdom prevails!",
    },
  },
  egyptian: {
    id: "egyptian",
    name: "Egyptian Gods",
    tagline: "Every world has heroes. Every kingdom has traitors.",
    crestIcon: "ankh",
    goodTeamName: "Followers of Ma'at",
    evilTeamName: "Agents of Chaos",
    colors: {
      ink: "#120d07",
      ink2: "#1d150b",
      panel: "#2c2010",
      panel2: "#3c2c16",
      line: "#5c4527",
      gold: "#f0b83f",
      goldDim: "#b88a2a",
      parch: "#f7eccd",
      parchDim: "#c4b48d",
      good: "#00a896",
      goodDk: "#028090",
      evil: "#d62246",
      evilDk: "#8b1028",
    },
    roles: [
      {
        id: "merlin",
        name: "Ra",
        team: "good",
        desc: "The Sun God. You perceive the agents of Chaos — but Sobek is veiled from your sight. Guide the followers of Ma'at: if Set names you at the end, Chaos rules.",
        knowledgeLabel: "The agents of Chaos you perceive (Sobek is veiled):",
        abilities: [
          {
            type: "reveal",
            target: { team: "evil", excludeRoles: ["mordred"] },
          },
        ],
      },
      {
        id: "percival",
        name: "Horus",
        team: "good",
        desc: "The Sky Avenger. You behold two figures — Ra and the deceiver Anubis — yet cannot tell which is the true Sun. Shield the true guide.",
        knowledgeLabel:
          "One of these is Ra, one is Anubis — you cannot tell which:",
        abilities: [
          {
            type: "reveal",
            target: { roles: ["merlin", "morgana"] },
          },
        ],
      },
      {
        id: "servant",
        name: "Guardian of Ma'at",
        team: "good",
        desc: "A loyal keeper of divine order. You hold no mystical sight — watch closely, weigh every action, and preserve harmony.",
        knowledgeLabel: "You hold no divine sight. Maintain Ma'at.",
        abilities: [],
      },
      {
        id: "assassin",
        name: "Set",
        team: "evil",
        desc: "God of storms and sand. Should the Guardians complete three tasks, you may strike in the night — name Ra to plunge Egypt into eternal Chaos.",
        knowledgeLabel: "Your fellow agents of Chaos (Apep stays hidden):",
        abilities: [
          {
            type: "reveal",
            target: { team: "evil", excludeRoles: ["oberon"] },
          },
          {
            type: "assassinate",
            targetRole: "merlin",
          },
        ],
      },
      {
        id: "morgana",
        name: "Anubis",
        team: "evil",
        desc: "Guide of the Dead. To Horus you appear as Ra himself, clouding the sky with illusions.",
        knowledgeLabel: "Your fellow agents of Chaos (Apep stays hidden):",
        abilities: [
          {
            type: "reveal",
            target: { team: "evil", excludeRoles: ["oberon"] },
          },
        ],
      },
      {
        id: "mordred",
        name: "Sobek",
        team: "evil",
        desc: "The crocodile god. You hide in the deep mud; even Ra's light cannot pierce your cover. Guide Chaos from the shadows.",
        knowledgeLabel: "Your fellow agents of Chaos (Apep stays hidden):",
        abilities: [
          {
            type: "reveal",
            target: { team: "evil", excludeRoles: ["oberon"] },
          },
        ],
      },
      {
        id: "oberon",
        name: "Apep",
        team: "evil",
        desc: "The serpent of eclipse. You know no other agent of Chaos, nor they you — but Ra sees your dark coils clearly.",
        knowledgeLabel: "You strike alone — you know no other agents of Chaos.",
        abilities: [],
      },
      {
        id: "minion",
        name: "Agent of Chaos",
        team: "evil",
        desc: "A follower of darkness. You know your fellow agents. Sabotage the temple tasks without being unmasked.",
        knowledgeLabel: "Your fellow agents of Chaos (Apep stays hidden):",
        abilities: [
          {
            type: "reveal",
            target: { team: "evil", excludeRoles: ["oberon"] },
          },
        ],
      },
    ],
    winReasons: {
      fiveRejections:
        "Five delegations rejected — the Pharaoh's court collapses. Chaos triumphs.",
      threeFails:
        "Three temple tasks sabotaged — Chaos consumes the Nile. Chaos triumphs.",
      assassinHit:
        "Set's storm strikes down Ra! Egypt is plunged into eternal darkness.",
      assassinMiss:
        "Set strikes the wrong god — Ra rises anew. Ma'at reigns forever!",
    },
  },
  greek: {
    id: "greek",
    name: "Greek Mythology",
    tagline: "Olympus vs Underworld. Choose your gods wisely.",
    crestIcon: "lightning",
    goodTeamName: "Olympians",
    evilTeamName: "Agents of Tartarus",
    colors: {
      ink: "#0b0f19",
      ink2: "#161d2d",
      panel: "#222b3d",
      panel2: "#2e3b52",
      line: "#485973",
      gold: "#d4af37",
      goldDim: "#9c7c23",
      parch: "#f0f3f6",
      parchDim: "#a3b1c6",
      good: "#0077b6",
      goodDk: "#03045e",
      evil: "#b7094c",
      evilDk: "#7209b7",
    },
    roles: [
      {
        id: "merlin",
        name: "Zeus",
        team: "good",
        desc: "King of Olympus. You perceive the agents of Tartarus — but Ares is veiled from your sight. Guide the Olympians subtly: if Hades strikes you down at the end, Olympus falls.",
        knowledgeLabel: "The agents of Tartarus you perceive (Ares is veiled):",
        abilities: [
          {
            type: "reveal",
            target: { team: "evil", excludeRoles: ["mordred"] },
          },
        ],
      },
      {
        id: "percival",
        name: "Athena",
        team: "good",
        desc: "Goddess of wisdom. You behold two figures — Zeus and the deceiver Hecate — yet cannot tell which is the true King. Find and shield the true guide.",
        knowledgeLabel:
          "One of these is Zeus, one is Hecate — you cannot tell which:",
        abilities: [
          {
            type: "reveal",
            target: { roles: ["merlin", "morgana"] },
          },
        ],
      },
      {
        id: "servant",
        name: "Hero of Olympus",
        team: "good",
        desc: "A noble hero. You hold no divine foresight — watch the portents, read the gods, and fight true.",
        knowledgeLabel:
          "You hold no divine foresight. Trust your fellow heroes.",
        abilities: [],
      },
      {
        id: "assassin",
        name: "Hades",
        team: "evil",
        desc: "Lord of the Underworld. Should the Heroes complete three quests, you may strike in the night — name Zeus to seize victory for Tartarus.",
        knowledgeLabel: "Your fellow agents of Tartarus (Typhon stays hidden):",
        abilities: [
          {
            type: "reveal",
            target: { team: "evil", excludeRoles: ["oberon"] },
          },
          {
            type: "assassinate",
            targetRole: "merlin",
          },
        ],
      },
      {
        id: "morgana",
        name: "Hecate",
        team: "evil",
        desc: "Goddess of magic. To Athena you appear as Zeus himself, clouding her wisdom with illusions.",
        knowledgeLabel: "Your fellow agents of Tartarus (Typhon stays hidden):",
        abilities: [
          {
            type: "reveal",
            target: { team: "evil", excludeRoles: ["oberon"] },
          },
        ],
      },
      {
        id: "mordred",
        name: "Ares",
        team: "evil",
        desc: "God of War. You hide in the chaos of battle; even Zeus's sight cannot pierce your shield. Lead Tartarus from the shadows.",
        knowledgeLabel: "Your fellow agents of Tartarus (Typhon stays hidden):",
        abilities: [
          {
            type: "reveal",
            target: { team: "evil", excludeRoles: ["oberon"] },
          },
        ],
      },
      {
        id: "oberon",
        name: "Typhon",
        team: "evil",
        desc: "The father of monsters. You know no other agent of Tartarus, nor they you — but Zeus sees your monstrous form clearly.",
        knowledgeLabel:
          "You fight alone — you know no other agents of Tartarus.",
        abilities: [],
      },
      {
        id: "minion",
        name: "Shade of Tartarus",
        team: "evil",
        desc: "A creature of the abyss. You know your fellow agents. Sabotage the Olympian quests without being unmasked.",
        knowledgeLabel: "Your fellow agents of Tartarus (Typhon stays hidden):",
        abilities: [
          {
            type: "reveal",
            target: { team: "evil", excludeRoles: ["oberon"] },
          },
        ],
      },
    ],
    winReasons: {
      fiveRejections:
        "Five councils rejected in a row — the gods scatter in discord. Tartarus triumphs.",
      threeFails:
        "Three quests sabotaged — the Titans break free and overrun Olympus. Tartarus triumphs.",
      assassinHit:
        "Hades strikes down Zeus with a helm of darkness! Olympus falls to the Underworld.",
      assassinMiss:
        "Hades strikes the wrong god — Zeus's thunderbolt prevails! Olympus is saved.",
    },
  },
  maratha: {
    id: "maratha",
    name: "Maratha Empire",
    tagline: "Swarajya vs Empire. Stand firm on the ramparts.",
    devanagariLabel: "प्रतिपच्चन्द्रलेखेव वर्धिष्णुर्विश्ववन्दिता",
    crestIcon: "fort",
    goodTeamName: "Mavalas",
    evilTeamName: "Imperial Forces",
    colors: {
      ink: "#190e05",
      ink2: "#24160c",
      panel: "#331e0f",
      panel2: "#422814",
      line: "#663d1f",
      gold: "#ff7e1a",
      goldDim: "#cc5b0d",
      parch: "#fff2e6",
      parchDim: "#e6b89c",
      good: "#2e7d32",
      goodDk: "#1b5e20",
      evil: "#c62828",
      evilDk: "#8e0000",
    },
    roles: [
      {
        id: "merlin",
        name: "Shivaji Maharaj",
        team: "good",
        desc: "The visionary King. You perceive the Adilshahi spies — but Aurangzeb is veiled from your sight. Guide the Mavala warriors subtly: if Siddi Johar names you at the end, Swarajya is lost.",
        knowledgeLabel: "The enemy spies you perceive (Aurangzeb is veiled):",
        abilities: [
          {
            type: "reveal",
            target: { team: "evil", excludeRoles: ["mordred"] },
          },
        ],
      },
      {
        id: "percival",
        name: "Baji Prabhu",
        team: "good",
        desc: "The legendary commander. You behold two figures — Maharaj and the deceiver Shaista Khan — yet cannot tell which is the true King. Shield the true guide.",
        knowledgeLabel:
          "One of these is Shivaji Maharaj, one is Shaista Khan — you cannot tell which:",
        abilities: [
          {
            type: "reveal",
            target: { roles: ["merlin", "morgana"] },
          },
        ],
      },
      {
        id: "servant",
        name: "Mavala Warrior",
        team: "good",
        desc: "A loyal soldier of Swarajya. You hold no secret info — watch the gates, weigh each voice, and stand firm for the King.",
        knowledgeLabel: "You hold no secret information. Fight for Swarajya.",
        abilities: [],
      },
      {
        id: "assassin",
        name: "Siddi Johar",
        team: "evil",
        desc: "The relentless besieger. Should the Mavalas complete three missions, you may strike in the night — name Shivaji Maharaj to end Swarajya.",
        knowledgeLabel:
          "Your fellow empire loyalists (Ganoji Shirke stays hidden):",
        abilities: [
          {
            type: "reveal",
            target: { team: "evil", excludeRoles: ["oberon"] },
          },
          {
            type: "assassinate",
            targetRole: "merlin",
          },
        ],
      },
      {
        id: "morgana",
        name: "Shaista Khan",
        team: "evil",
        desc: "The imperial general. To Baji Prabhu you appear as Shivaji Maharaj himself, casting doubt in the ranks.",
        knowledgeLabel:
          "Your fellow empire loyalists (Ganoji Shirke stays hidden):",
        abilities: [
          {
            type: "reveal",
            target: { team: "evil", excludeRoles: ["oberon"] },
          },
        ],
      },
      {
        id: "mordred",
        name: "Aurangzeb",
        team: "evil",
        desc: "The Mughal Emperor. You rule from deep within the imperial court; even Shivaji Maharaj cannot pierce your veil. Direct operations from the shadows.",
        knowledgeLabel:
          "Your fellow empire loyalists (Ganoji Shirke stays hidden):",
        abilities: [
          {
            type: "reveal",
            target: { team: "evil", excludeRoles: ["oberon"] },
          },
        ],
      },
      {
        id: "oberon",
        name: "Ganoji Shirke",
        team: "evil",
        desc: "The insider traitor. You know no other empire loyalist, nor they you — but Shivaji Maharaj sees your treachery clearly.",
        knowledgeLabel:
          "You betray alone — you know no other empire loyalists.",
        abilities: [],
      },
      {
        id: "minion",
        name: "Adilshahi Spy",
        team: "evil",
        desc: "A spy of the Sultan. You know your fellow agents. Sabotage the fort defenses without being unmasked.",
        knowledgeLabel:
          "Your fellow empire loyalists (Ganoji Shirke stays hidden):",
        abilities: [
          {
            type: "reveal",
            target: { team: "evil", excludeRoles: ["oberon"] },
          },
        ],
      },
    ],
    winReasons: {
      fiveRejections:
        "Five war councils rejected in a row — the commanders fall into infighting. Swarajya fails.",
      threeFails:
        "Three fort defenses failed — the Imperial forces overrun the Deccan. Swarajya fails.",
      assassinHit:
        "Siddi Johar's siege captures Shivaji Maharaj! Swarajya is crushed.",
      assassinMiss:
        "Siddi Johar strikes the wrong commander — Maharaj escapes. Swarajya reigns supreme!",
    },
  },
};

export const THEME_LIST = Object.values(THEMES).map((t) => ({
  id: t.id,
  name: t.name,
  tagline: t.tagline,
  crestIcon: t.crestIcon,
}));
