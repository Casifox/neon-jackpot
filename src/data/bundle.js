/* Généré automatiquement par tools/build-data.js — ne pas éditer à la main.
   Modifiez les fichiers /src/data/*.json puis relancez : npm run build:data */
window.GAME_DATA = {
  "achievements": {
    "playThresholds": [
      10,
      100,
      1000,
      10000
    ],
    "winThresholds": [
      1,
      10,
      100,
      1000
    ],
    "winAmountThresholds": [
      1000,
      100000,
      10000000,
      1000000000
    ],
    "earnThresholds": [
      1000,
      10000,
      100000,
      1000000,
      100000000,
      10000000000,
      1000000000000,
      1000000000000000
    ],
    "betThresholds": [
      10,
      100,
      1000,
      10000,
      100000
    ],
    "multThresholds": [
      2,
      5,
      10,
      25,
      100,
      1000,
      10000
    ],
    "levelThresholds": [
      10,
      25,
      50,
      100,
      200,
      500,
      750,
      1000
    ],
    "timeThresholdsHours": [
      1,
      5,
      20,
      50,
      100
    ],
    "prestigeCounts": [
      1,
      3,
      10,
      25
    ],
    "questCounts": [
      10,
      50,
      200
    ],
    "synergyCounts": [
      1,
      4,
      8,
      12
    ],
    "streakThresholds": [
      3,
      5,
      10,
      20
    ],
    "rewards": {
      "bronze": {
        "gems": 2,
        "bonus": 0.005
      },
      "silver": {
        "gems": 5,
        "bonus": 0.01
      },
      "gold": {
        "gems": 12,
        "bonus": 0.02
      },
      "mythic": {
        "gems": 30,
        "bonus": 0.04
      }
    }
  },
  "balance": {
    "meta": {
      "saveVersion": 1,
      "startingTokens": 250,
      "startingGems": 0,
      "startingGoldBalls": 0,
      "xp": {
        "base": 50,
        "growth": 1.18,
        "softCapLevel": 40,
        "growthAfterCap": 1.06,
        "perBet": 1,
        "multiplierBonusFactor": 2
      },
      "offline": {
        "efficiency": 0.1,
        "baseCapHours": 2,
        "maxCapHours": 24,
        "minSeconds": 60
      },
      "bailout": {
        "amount": 150,
        "threshold": 5,
        "cooldownSeconds": 300
      },
      "rebirth": {
        "levels": [
          40,
          150,
          500,
          1000
        ],
        "divisor": 1000000,
        "names": [
          "Étoiles",
          "Couronnes",
          "Diamants",
          "Reliques"
        ],
        "keys": [
          "stars",
          "crowns",
          "diamonds",
          "relics"
        ],
        "icons": [
          "⭐",
          "👑",
          "💠",
          "🔮"
        ],
        "levelBonus": 0.25
      },
      "buffs": {
        "maxActive": 6,
        "goldenHourEveryMs": [
          240000,
          480000
        ],
        "goldenHourDurationMs": 120000
      },
      "pauseReminderMs": 7200000
    },
    "plinko": {
      "minBet": 1,
      "betSteps": [
        1,
        2,
        5,
        10,
        25,
        50,
        100,
        250,
        500,
        1000,
        2500,
        5000,
        10000,
        25000,
        50000,
        100000,
        250000,
        500000,
        1000000
      ],
      "baseRows": 6,
      "maxRows": 16,
      "baseBalls": 1,
      "maxBalls": 50,
      "tierEdges": [
        1.2,
        2,
        3,
        5,
        10,
        25,
        100,
        500,
        1000,
        10000
      ],
      "tierEV": [
        1.03,
        1.05,
        1.08,
        1.11,
        1.15,
        1.2,
        1.25,
        1.3,
        1.35,
        1.4
      ],
      "luckPerLevel": 0.5,
      "luckCap": 40,
      "upgrades": {
        "balls": {
          "name": "Billes simultanées",
          "icon": "🔵",
          "base": 25,
          "growth": 1.55,
          "max": 49,
          "desc": "+1 bille maximum en même temps"
        },
        "rows": {
          "name": "Rangées de picots",
          "icon": "📐",
          "base": 150,
          "growth": 2.6,
          "max": 10,
          "desc": "+1 rangée : plus de cases, plus de variance"
        },
        "mult": {
          "name": "Multiplicateurs",
          "icon": "✨",
          "costs": [
            400,
            2500,
            15000,
            100000,
            800000,
            6000000,
            50000000,
            400000000,
            3000000000
          ],
          "desc": "Débloque une nouvelle zone sur les bords"
        },
        "bet": {
          "name": "Mise maximale",
          "icon": "🎫",
          "base": 100,
          "growth": 2.2,
          "max": 14,
          "desc": "Débloque une mise plus élevée"
        },
        "luck": {
          "name": "Chance",
          "icon": "🍀",
          "base": 500,
          "growth": 1.4,
          "max": 80,
          "desc": "+0,5 % de chance d'attirer la bille vers les bords"
        },
        "speed": {
          "name": "Vitesse",
          "icon": "⚡",
          "base": 300,
          "growth": 1.9,
          "max": 8,
          "desc": "Chute des billes plus rapide"
        },
        "auto": {
          "name": "Auto-drop",
          "icon": "🤖",
          "costs": [
            2000,
            12000,
            70000,
            400000
          ],
          "desc": "Lâche des billes automatiquement, de plus en plus vite"
        }
      },
      "autoIntervalsMs": [
        5000,
        2000,
        1000,
        700
      ],
      "specials": {
        "golden": {
          "name": "Bille dorée",
          "icon": "🟡",
          "desc": "Gains ×2 sur cette bille.",
          "cost": 3,
          "maxLevel": 5,
          "chance": 0.04,
          "chancePerLevel": 0.02,
          "color": "#ffd166"
        },
        "explosive": {
          "name": "Bille explosive",
          "icon": "💥",
          "desc": "Détruit des picots et ouvre une trajectoire directe.",
          "cost": 5,
          "maxLevel": 5,
          "chance": 0.03,
          "chancePerLevel": 0.015,
          "color": "#fb7185"
        },
        "magnet": {
          "name": "Bille aimantée",
          "icon": "🧲",
          "desc": "Attirée vers le multiplicateur le plus élevé.",
          "cost": 8,
          "maxLevel": 5,
          "chance": 0.03,
          "chancePerLevel": 0.015,
          "color": "#60a5fa"
        },
        "ghost": {
          "name": "Bille fantôme",
          "icon": "👻",
          "desc": "Traverse les picots et tombe plus vite.",
          "cost": 12,
          "maxLevel": 5,
          "chance": 0.025,
          "chancePerLevel": 0.012,
          "color": "#c4b5fd"
        },
        "rainbow": {
          "name": "Bille arc-en-ciel",
          "icon": "🌈",
          "desc": "Copie le meilleur multiplicateur de la session.",
          "cost": 18,
          "maxLevel": 5,
          "chance": 0.015,
          "chancePerLevel": 0.01,
          "color": "#f472b6"
        },
        "mother": {
          "name": "Bille mère",
          "icon": "🔮",
          "desc": "Se divise en 3 à mi-parcours : triple paiement.",
          "cost": 25,
          "maxLevel": 5,
          "chance": 0.02,
          "chancePerLevel": 0.008,
          "color": "#34d399"
        }
      },
      "powers": {
        "rain": {
          "name": "Pluie de billes",
          "icon": "🌧️",
          "desc": "Lâche 10 billes gratuites instantanément.",
          "cost": 5,
          "cooldownMs": 90000
        },
        "luck": {
          "name": "Tempête de chance",
          "icon": "🌪️",
          "desc": "+25 % de chance de bords pendant 20 s.",
          "cost": 8,
          "cooldownMs": 120000,
          "durationMs": 20000,
          "bonus": 25
        },
        "jackpot": {
          "name": "Jackpot forcé",
          "icon": "🎯",
          "desc": "La prochaine bille vise le multiplicateur maximal.",
          "cost": 12,
          "cooldownMs": 180000
        }
      },
      "tables": [
        {
          "id": "classic",
          "name": "Table classique",
          "icon": "🔮",
          "cost": 0,
          "currency": "tokens",
          "desc": "La table originale, équilibrée et lumineuse.",
          "mods": {}
        },
        {
          "id": "neon",
          "name": "Table néon",
          "icon": "🟣",
          "cost": 5000,
          "currency": "tokens",
          "desc": "+5 % de gains sur toutes les billes.",
          "mods": {
            "payout": 0.05
          }
        },
        {
          "id": "pyramid",
          "name": "Pyramide",
          "icon": "🔺",
          "cost": 50000,
          "currency": "tokens",
          "desc": "+15 % de chance de toucher les bords, mais centre moins généreux.",
          "mods": {
            "luck": 15,
            "payout": -0.05
          }
        },
        {
          "id": "double",
          "name": "Double plateau",
          "icon": "♾️",
          "cost": 250,
          "currency": "gems",
          "desc": "8 % de chance de doubler le paiement d'une bille.",
          "mods": {
            "doubleChance": 0.08
          }
        }
      ]
    },
    "blackjack": {
      "minBet": 10,
      "betSteps": [
        10,
        25,
        50,
        100,
        250,
        500,
        1000,
        2500,
        5000,
        10000,
        25000,
        50000,
        100000,
        250000,
        500000
      ],
      "decks": 6,
      "payouts": {
        "win": 1,
        "blackjack": 1.5,
        "insurance": 2
      },
      "bossEvery": 25,
      "streakBonusPerWin": 0.05,
      "streakCap": 10,
      "specialChances": {
        "joker": 0.03,
        "golden": 0.025,
        "fire": 0.02
      },
      "upgrades": {
        "maxBet": {
          "name": "Mise maximale",
          "icon": "💵",
          "base": 200,
          "growth": 2.1,
          "max": 12,
          "desc": "Débloque une mise plus élevée"
        },
        "bjBonus": {
          "name": "Bonus blackjack",
          "icon": "🂡",
          "costs": [
            5000,
            50000
          ],
          "desc": "Blackjack payé 2:1, puis 3:1"
        },
        "insurance": {
          "name": "Assurance gratuite",
          "icon": "🛡️",
          "cost": 3000,
          "desc": "Une assurance offerte quand le croupier montre un As"
        },
        "peek": {
          "name": "Revoir une carte",
          "icon": "👁️",
          "cost": 2500,
          "desc": "Le croupier vérifie son blackjack avant votre tour"
        },
        "counter": {
          "name": "Compteur de cartes",
          "icon": "🧮",
          "cost": 8000,
          "desc": "Affiche la probabilité de busting du croupier"
        },
        "split": {
          "name": "Split",
          "icon": "✂️",
          "cost": 10000,
          "desc": "Séparez une paire en deux mains"
        },
        "multiHand": {
          "name": "Mains multiples",
          "icon": "🙌",
          "costs": [
            50000,
            200000
          ],
          "desc": "Jouez 3 puis 5 mains en parallèle"
        },
        "auto": {
          "name": "Auto-jeu",
          "icon": "🤖",
          "cost": 25000,
          "desc": "Stratégie de base automatique, réglable"
        },
        "specials": {
          "name": "Cartes spéciales",
          "icon": "🃏",
          "cost": 15000,
          "desc": "Joker, carte dorée et carte de feu"
        },
        "vip": {
          "name": "Tables VIP",
          "icon": "🥂",
          "cost": 100000,
          "desc": "+10 % de gains, mises premium"
        },
        "streak": {
          "name": "Séries",
          "icon": "🔥",
          "cost": 30000,
          "desc": "+5 % de gain par victoire consécutive"
        }
      }
    },
    "roulette": {
      "minBet": 1,
      "betSteps": [
        1,
        5,
        25,
        100,
        500,
        1000,
        5000,
        10000,
        25000,
        100000
      ],
      "payouts": {
        "straight": 35,
        "red": 1,
        "black": 1,
        "even": 1,
        "odd": 1,
        "low": 1,
        "high": 1,
        "dozen": 2,
        "column": 2
      },
      "upgrades": {
        "maxBet": {
          "name": "Mise maximale",
          "icon": "💵",
          "base": 500,
          "growth": 2.2,
          "max": 8,
          "desc": "Autorise des jetons plus gros"
        },
        "outside": {
          "name": "Mises extérieures",
          "icon": "🔴",
          "cost": 1000,
          "desc": "Débloque pair/impair, douzaines et colonnes"
        },
        "straight": {
          "name": "Numéros pleins",
          "icon": "🎯",
          "cost": 2500,
          "desc": "Misez sur un numéro précis (35:1)"
        },
        "neighbors": {
          "name": "Voisins du zéro",
          "icon": "🧿",
          "cost": 8000,
          "desc": "Mise groupée autour du zéro"
        },
        "goldenWheel": {
          "name": "Roue dorée",
          "icon": "🌟",
          "cost": 15000,
          "desc": "+10 % sur tous les gains et effets dorés"
        },
        "multiBall": {
          "name": "Secondes billes",
          "icon": "⚪",
          "cost": 50000,
          "desc": "Deux billes tournent à chaque lancer"
        },
        "auto": {
          "name": "Auto-roulette",
          "icon": "🤖",
          "cost": 30000,
          "desc": "Répète votre schéma de mise préféré"
        },
        "fetish": {
          "name": "Mise fétiche",
          "icon": "🍀",
          "cost": 8000,
          "desc": "Vos mises gagnantes accumulent un bonus permanent"
        }
      },
      "goldenBonus": 0.1
    },
    "slots": {
      "minBet": 1,
      "betSteps": [
        1,
        2,
        5,
        10,
        25,
        50,
        100,
        250,
        500,
        1000,
        2500,
        5000
      ],
      "paytable": {
        "seven": {
          "name": "Sept",
          "pay": {
            "3": 60,
            "4": 300,
            "5": 1500
          }
        },
        "diamond": {
          "name": "Diamant",
          "pay": {
            "3": 30,
            "4": 150,
            "5": 750
          }
        },
        "bell": {
          "name": "Cloche",
          "pay": {
            "3": 18,
            "4": 80,
            "5": 300
          }
        },
        "star": {
          "name": "Étoile",
          "pay": {
            "3": 12,
            "4": 50,
            "5": 200
          }
        },
        "lemon": {
          "name": "Citron",
          "pay": {
            "3": 8,
            "4": 30,
            "5": 100
          }
        },
        "cherry": {
          "name": "Cerise",
          "pay": {
            "3": 5,
            "4": 18,
            "5": 60
          }
        },
        "wild": {
          "name": "Joker",
          "pay": {
            "3": 100,
            "4": 500,
            "5": 2500
          }
        }
      },
      "symbols": [
        "cherry",
        "lemon",
        "bell",
        "star",
        "seven",
        "diamond",
        "wild"
      ],
      "scatterChance": 0.045,
      "scatterPays": {
        "3": 2,
        "4": 4,
        "5": 8
      },
      "lineRTP": {
        "3": 0.92,
        "5": 0.82
      },
      "freeSpins": {
        "trigger": 3,
        "count": 5,
        "multiplier": 1.5
      },
      "jackpotContribution": 0.015,
      "jackpotBase": 5000,
      "machines": [
        {
          "id": "fruits",
          "name": "Fruits Paradise",
          "icon": "🍒",
          "unlock": 30,
          "accent": "#fb7185",
          "icons": {
            "cherry": "🍒",
            "lemon": "🍋",
            "bell": "🔔",
            "star": "⭐",
            "seven": "7️⃣",
            "diamond": "💎",
            "wild": "🃏",
            "scatter": "🎁"
          }
        },
        {
          "id": "space",
          "name": "Galaxy Spin",
          "icon": "🚀",
          "unlock": 45,
          "accent": "#818cf8",
          "icons": {
            "cherry": "🪐",
            "lemon": "☄️",
            "bell": "🛸",
            "star": "⭐",
            "seven": "👾",
            "diamond": "💎",
            "wild": "🌌",
            "scatter": "🎁"
          }
        },
        {
          "id": "pharaoh",
          "name": "Pharaoh's Gold",
          "icon": "🏺",
          "unlock": 70,
          "accent": "#fbbf24",
          "icons": {
            "cherry": "🪲",
            "lemon": "🏺",
            "bell": "🔱",
            "star": "🌟",
            "seven": "👁️",
            "diamond": "💎",
            "wild": "🐈",
            "scatter": "🎁"
          }
        },
        {
          "id": "pirates",
          "name": "Pirate Bay",
          "icon": "🏴‍☠️",
          "unlock": 110,
          "accent": "#34d399",
          "icons": {
            "cherry": "🍺",
            "lemon": "🦜",
            "bell": "🔔",
            "star": "⚓",
            "seven": "☠️",
            "diamond": "💎",
            "wild": "🏴‍☠️",
            "scatter": "🎁"
          }
        }
      ],
      "upgrades": {
        "maxBet": {
          "name": "Mise maximale",
          "icon": "💵",
          "base": 300,
          "growth": 2.1,
          "max": 10,
          "desc": "Débloque une mise plus élevée"
        },
        "wild": {
          "name": "Wilds",
          "icon": "🃏",
          "cost": 5000,
          "desc": "Ajoute le symbole Joker qui remplace tout"
        },
        "freeSpins": {
          "name": "Tours gratuits",
          "icon": "🌀",
          "cost": 8000,
          "desc": "3 scatters déclenchent 5 tours gratuits ×1,5"
        },
        "bonus": {
          "name": "Mini-jeu bonus",
          "icon": "🎁",
          "cost": 20000,
          "desc": "Choisissez un coffre après une grosse ligne"
        },
        "jackpot": {
          "name": "Jackpot progressif",
          "icon": "💰",
          "cost": 50000,
          "desc": "Un jackpot partagé grossit à chaque tour"
        },
        "autospin": {
          "name": "Auto-spin",
          "icon": "🤖",
          "cost": 3000,
          "desc": "Débloque les séquences 25 et 50 tours (10 inclus)"
        },
        "lock": {
          "name": "Verrouillage",
          "icon": "🔒",
          "cost": 15000,
          "desc": "Verrouillez un rouleau gagnant au tour suivant"
        },
        "reels": {
          "name": "5 rouleaux",
          "icon": "🎰",
          "cost": 25000,
          "desc": "Passe à 5 rouleaux et 5 lignes de base"
        },
        "lines": {
          "name": "Lignes supplémentaires",
          "icon": "📏",
          "costs": [
            10000,
            50000,
            200000,
            1000000
          ],
          "desc": "Jusqu'à 25 lignes de paiement"
        }
      }
    },
    "mines": {
      "minBet": 10,
      "betSteps": [
        10,
        25,
        50,
        100,
        250,
        500,
        1000,
        2500,
        5000,
        10000,
        25000,
        50000
      ],
      "gridSizes": [
        5,
        6,
        7
      ],
      "defaultMines": 3,
      "houseEdge": 0.97,
      "upgrades": {
        "maxBet": {
          "name": "Mise maximale",
          "icon": "💵",
          "base": 300,
          "growth": 2.1,
          "max": 9,
          "desc": "Débloque une mise plus élevée"
        },
        "minesChoice": {
          "name": "Choix des mines",
          "icon": "💣",
          "cost": 1000,
          "desc": "Choisissez entre 1 et 24 mines"
        },
        "size": {
          "name": "Grande grille",
          "icon": "🔲",
          "costs": [
            5000,
            50000
          ],
          "desc": "Débloque les grilles 6×6 et 7×7"
        },
        "autoCashout": {
          "name": "Encaissement auto",
          "icon": "🎯",
          "cost": 4000,
          "desc": "Encaisse automatiquement à un multiplicateur choisi"
        },
        "radar": {
          "name": "Radar",
          "icon": "📡",
          "cost": 8000,
          "desc": "Révèle une case sûre (1 charge, rechargée après un cashout)"
        },
        "shield": {
          "name": "Bouclier",
          "icon": "🛡️",
          "cost": 15000,
          "desc": "Survit à une mine par partie"
        },
        "golden": {
          "name": "Mine d'or",
          "icon": "🪙",
          "cost": 50000,
          "desc": "Les cases sûres peuvent contenir des gemmes"
        },
        "auto": {
          "name": "Assistant de visée",
          "icon": "🎯",
          "cost": 30000,
          "desc": "Une révélation de case sûre par manche, puis l'auto continue au hasard"
        }
      }
    },
    "crash": {
      "minBet": 10,
      "betSteps": [
        10,
        25,
        50,
        100,
        250,
        500,
        1000,
        2500,
        5000,
        10000,
        25000,
        50000
      ],
      "houseEdge": 0.97,
      "growthRate": 0.16,
      "maxMultiplier": 10000,
      "upgrades": {
        "maxBet": {
          "name": "Mise maximale",
          "icon": "💵",
          "base": 300,
          "growth": 2.1,
          "max": 9,
          "desc": "Débloque une mise plus élevée"
        },
        "autoCashout": {
          "name": "Encaissement auto",
          "icon": "🎯",
          "cost": 3000,
          "desc": "Définissez un objectif d'encaissement automatique"
        },
        "double": {
          "name": "Double mise",
          "icon": "✖️",
          "cost": 5000,
          "desc": "Doublez votre mise d'un clic"
        },
        "safety": {
          "name": "Filet de sécurité",
          "icon": "🪂",
          "cost": 12000,
          "desc": "Récupérez 20 % de votre mise en cas de crash"
        },
        "prediction": {
          "name": "Prévision",
          "icon": "🔮",
          "cost": 8000,
          "desc": "Affiche la probabilité d'atteindre votre seuil"
        },
        "curves": {
          "name": "Courbes spéciales",
          "icon": "🌈",
          "cost": 20000,
          "desc": "Débloque des thèmes de courbe et +5 % de gains"
        },
        "autobet": {
          "name": "Auto-mise",
          "icon": "🤖",
          "cost": 25000,
          "desc": "Relance automatiquement après chaque crash"
        }
      }
    },
    "dice": {
      "minBet": 10,
      "betSteps": [
        10,
        25,
        50,
        100,
        250,
        500,
        1000,
        2500,
        5000,
        10000
      ],
      "houseEdge": 0.97,
      "maxDice": 5,
      "upgrades": {
        "maxBet": {
          "name": "Mise maximale",
          "icon": "💵",
          "base": 300,
          "growth": 2.1,
          "max": 8,
          "desc": "Débloque une mise plus élevée"
        },
        "multiDice": {
          "name": "Dés supplémentaires",
          "icon": "🎲",
          "costs": [
            4000,
            15000,
            50000
          ],
          "desc": "Jusqu'à 5 dés : le total change tout"
        },
        "lucky": {
          "name": "Dés pipés",
          "icon": "🍀",
          "cost": 12000,
          "desc": "Force un résultat favorable (cooldown 90 s)"
        },
        "auto": {
          "name": "Auto-lancer",
          "icon": "🤖",
          "cost": 25000,
          "desc": "Relance automatiquement avec le même réglage"
        },
        "insight": {
          "name": "Lecture des dés",
          "icon": "🧠",
          "cost": 8000,
          "desc": "Affiche les probabilités exactes de chaque total"
        }
      }
    },
    "keno": {
      "minBet": 10,
      "betSteps": [
        10,
        25,
        50,
        100,
        250,
        500,
        1000,
        2500,
        5000
      ],
      "maxPicks": 10,
      "drawCount": 20,
      "houseEdge": 0.94,
      "payoutShapes": {
        "1": [
          0,
          3.5
        ],
        "2": [
          0,
          0,
          14
        ],
        "3": [
          0,
          0,
          2,
          40
        ],
        "4": [
          0,
          0,
          1,
          5,
          100
        ],
        "5": [
          0,
          0,
          0,
          2,
          20,
          400
        ],
        "6": [
          0,
          0,
          0,
          1,
          6,
          60,
          1200
        ],
        "7": [
          0,
          0,
          0,
          0,
          3,
          20,
          200,
          2500
        ],
        "8": [
          0,
          0,
          0,
          0,
          2,
          10,
          80,
          600,
          5000
        ],
        "9": [
          0,
          0,
          0,
          0,
          1,
          5,
          30,
          200,
          2000,
          10000
        ],
        "10": [
          0,
          0,
          0,
          0,
          1,
          4,
          20,
          100,
          1000,
          10000,
          50000
        ]
      },
      "upgrades": {
        "maxBet": {
          "name": "Mise maximale",
          "icon": "💵",
          "base": 300,
          "growth": 2.1,
          "max": 8,
          "desc": "Débloque une mise plus élevée"
        },
        "fastDraw": {
          "name": "Tirage rapide",
          "icon": "⚡",
          "cost": 3000,
          "desc": "Les 20 boules tombent deux fois plus vite"
        },
        "luckyNumbers": {
          "name": "Numéros chanceux",
          "icon": "🍀",
          "cost": 8000,
          "desc": "Mémorise vos numéros et les reprend automatiquement"
        },
        "auto": {
          "name": "Auto-keno",
          "icon": "🤖",
          "cost": 15000,
          "desc": "Relance automatiquement après un tirage"
        },
        "multiCard": {
          "name": "Multi-cartes",
          "icon": "🗂️",
          "cost": 40000,
          "desc": "Jouez jusqu'à 3 grilles en même temps"
        }
      }
    },
    "poker": {
      "minBet": 10,
      "betSteps": [
        10,
        25,
        50,
        100,
        250,
        500,
        1000,
        2500,
        5000,
        10000
      ],
      "upgrades": {
        "maxBet": {
          "name": "Mise maximale",
          "icon": "💵",
          "base": 300,
          "growth": 2.1,
          "max": 8,
          "desc": "Débloque une mise plus élevée"
        },
        "deuces": {
          "name": "Deuces Wild",
          "icon": "🂢",
          "cost": 20000,
          "desc": "Les 2 deviennent jokers. Table de gains alternative"
        },
        "jokers": {
          "name": "Jokers",
          "icon": "🃏",
          "cost": 50000,
          "desc": "Un joker collectionnable peut apparaître dans votre main"
        },
        "auto": {
          "name": "Auto-hold",
          "icon": "🤖",
          "cost": 30000,
          "desc": "Sélectionne automatiquement les cartes à garder"
        },
        "royal": {
          "name": "Mains royales",
          "icon": "👑",
          "cost": 80000,
          "desc": "+20 % sur les quintes flush royales et les carrés"
        }
      },
      "paytable": {
        "royalFlush": {
          "name": "Quinte flush royale",
          "mult": 250
        },
        "straightFlush": {
          "name": "Quinte flush",
          "mult": 50
        },
        "fourOfAKind": {
          "name": "Carré",
          "mult": 25
        },
        "fullHouse": {
          "name": "Full",
          "mult": 9
        },
        "flush": {
          "name": "Couleur",
          "mult": 6
        },
        "straight": {
          "name": "Quinte",
          "mult": 4
        },
        "threeOfAKind": {
          "name": "Brelan",
          "mult": 3
        },
        "twoPair": {
          "name": "Deux paires",
          "mult": 2
        },
        "jacksOrBetter": {
          "name": "Paire de Valets ou mieux",
          "mult": 1
        }
      },
      "deucesPaytable": {
        "naturalRoyal": {
          "name": "Quinte flush royale naturelle",
          "mult": 250
        },
        "fourDeuces": {
          "name": "Carré de 2",
          "mult": 50
        },
        "wildRoyal": {
          "name": "Quinte flush royale joker",
          "mult": 25
        },
        "fiveOfAKind": {
          "name": "Cinq cartes identiques",
          "mult": 15
        },
        "straightFlush": {
          "name": "Quinte flush",
          "mult": 9
        },
        "fourOfAKind": {
          "name": "Carré",
          "mult": 5
        },
        "fullHouse": {
          "name": "Full",
          "mult": 3
        },
        "flush": {
          "name": "Couleur",
          "mult": 2
        },
        "straight": {
          "name": "Quinte",
          "mult": 2
        },
        "threeOfAKind": {
          "name": "Brelan",
          "mult": 1
        }
      }
    },
    "horses": {
      "minBet": 25,
      "betSteps": [
        25,
        50,
        100,
        250,
        500,
        1000,
        2500,
        5000,
        10000,
        25000
      ],
      "raceDurationMs": 11000,
      "houseEdge": 0.94,
      "trainBase": 120,
      "trainGrowth": 1.45,
      "horses": [
        {
          "id": "eclair",
          "name": "Éclair",
          "color": "#ff4fd8",
          "emoji": "🐎",
          "speed": 7,
          "stamina": 6,
          "luck": 4
        },
        {
          "id": "tonnerre",
          "name": "Tonnerre",
          "color": "#60a5fa",
          "emoji": "🐎",
          "speed": 6,
          "stamina": 8,
          "luck": 4
        },
        {
          "id": "comete",
          "name": "Comète",
          "color": "#fbbf24",
          "emoji": "🐎",
          "speed": 8,
          "stamina": 5,
          "luck": 3
        },
        {
          "id": "ombre",
          "name": "Ombre",
          "color": "#a78bfa",
          "emoji": "🐎",
          "speed": 5,
          "stamina": 7,
          "luck": 7
        },
        {
          "id": "orage",
          "name": "Orage",
          "color": "#34d399",
          "emoji": "🐎",
          "speed": 6,
          "stamina": 6,
          "luck": 6
        },
        {
          "id": "tempete",
          "name": "Tempête",
          "color": "#fb7185",
          "emoji": "🐎",
          "speed": 7,
          "stamina": 4,
          "luck": 7
        }
      ],
      "upgrades": {
        "maxBet": {
          "name": "Mise maximale",
          "icon": "💵",
          "base": 350,
          "growth": 2.1,
          "max": 8,
          "desc": "Débloque une mise plus élevée"
        },
        "training": {
          "name": "Entraînement",
          "icon": "🏋️",
          "base": 200,
          "growth": 1.6,
          "max": 30,
          "desc": "Améliore toutes les stats de l'écurie"
        },
        "tournament": {
          "name": "Tournois",
          "icon": "🏆",
          "cost": 30000,
          "desc": "Débloque les tournois à 3 courses"
        },
        "auto": {
          "name": "Auto-course",
          "icon": "🤖",
          "cost": 25000,
          "desc": "Acc�l�re l'encha�nement automatique des courses"
        },
        "odds": {
          "name": "Œil du pronostiqueur",
          "icon": "👁️",
          "cost": 10000,
          "desc": "Affiche les chances exactes de chaque cheval"
        }
      }
    },
    "vault": {
      "unlockWins": 1000,
      "unlockGames": 5,
      "cooldownHours": 20,
      "rewards": {
        "tokens": {
          "min": 5000,
          "max": 25000,
          "weight": 50
        },
        "gems": {
          "min": 10,
          "max": 45,
          "weight": 25
        },
        "goldBalls": {
          "min": 2,
          "max": 6,
          "weight": 15
        },
        "collection": {
          "weight": 10
        }
      }
    },
    "gemShop": {
      "goldBalls": {
        "name": "Billes d'or",
        "icon": "🟡",
        "desc": "5 billes d'or pour débloquer et améliorer les billes spéciales du Plinko.",
        "cost": 30,
        "amount": 5
      },
      "tokenChest": {
        "name": "Coffre de jetons",
        "icon": "🪙",
        "desc": "Des jetons proportionnels à votre niveau actuel.",
        "cost": 20,
        "base": 1000,
        "growth": 1.32
      },
      "plinkoLuck": {
        "name": "Bénédiction du Plinko",
        "icon": "🍀",
        "desc": "+5 % de chance de bords au Plinko, permanent.",
        "cost": 80,
        "max": 10,
        "perLevel": 0.05
      },
      "xpBoost": {
        "name": "Savoir accéléré",
        "icon": "📚",
        "desc": "+10 % d'XP, permanent.",
        "cost": 120,
        "max": 5,
        "perLevel": 0.1
      },
      "globalBoost": {
        "name": "Aura du casino",
        "icon": "✨",
        "desc": "+5 % de gains globaux, permanent.",
        "cost": 150,
        "max": 10,
        "perLevel": 0.05
      }
    }
  },
  "collections": {
    "packCost": 25,
    "packCost10": 200,
    "rarityWeights": {
      "common": 58,
      "rare": 27,
      "epic": 10,
      "legendary": 4.5,
      "mythic": 0.5
    },
    "duplicateGems": {
      "common": 2,
      "rare": 5,
      "epic": 12,
      "legendary": 30,
      "mythic": 80
    },
    "itemBonus": 0.0025,
    "sets": [
      {
        "id": "balls",
        "name": "Billes",
        "icon": "🔮",
        "bonus": {
          "label": "+5 % de chance au Plinko",
          "plinkoLuck": 0.05
        },
        "items": [
          {
            "id": "ball_neon",
            "name": "Néon",
            "rarity": "common",
            "color": "#ff4fd8"
          },
          {
            "id": "ball_ocean",
            "name": "Océan",
            "rarity": "common",
            "color": "#22d3ee"
          },
          {
            "id": "ball_sunset",
            "name": "Coucher de soleil",
            "rarity": "common",
            "color": "#fb923c"
          },
          {
            "id": "ball_emerald",
            "name": "Émeraude",
            "rarity": "rare",
            "color": "#34d399"
          },
          {
            "id": "ball_amethyst",
            "name": "Améthyste",
            "rarity": "rare",
            "color": "#a78bfa"
          },
          {
            "id": "ball_rose",
            "name": "Rose gold",
            "rarity": "rare",
            "color": "#fda4af"
          },
          {
            "id": "ball_galaxy",
            "name": "Galaxie",
            "rarity": "epic",
            "color": "#818cf8"
          },
          {
            "id": "ball_toxic",
            "name": "Toxique",
            "rarity": "epic",
            "color": "#a3e635"
          },
          {
            "id": "ball_lava",
            "name": "Lave",
            "rarity": "epic",
            "color": "#f97316"
          },
          {
            "id": "ball_aurora",
            "name": "Aurore",
            "rarity": "legendary",
            "color": "#2dd4bf"
          },
          {
            "id": "ball_void",
            "name": "Vide",
            "rarity": "legendary",
            "color": "#7c3aed"
          },
          {
            "id": "ball_crown",
            "name": "Couronne",
            "rarity": "mythic",
            "color": "#ffd166"
          }
        ]
      },
      {
        "id": "cards",
        "name": "Cartes",
        "icon": "🃏",
        "bonus": {
          "label": "+5 % de gains au Blackjack",
          "blackjackWin": 0.05
        },
        "items": [
          {
            "id": "card_royal",
            "name": "Royal",
            "rarity": "common",
            "color": "#60a5fa"
          },
          {
            "id": "card_crimson",
            "name": "Cramoisi",
            "rarity": "common",
            "color": "#f43f5e"
          },
          {
            "id": "card_jade",
            "name": "Jade",
            "rarity": "common",
            "color": "#34d399"
          },
          {
            "id": "card_gold",
            "name": "Or",
            "rarity": "rare",
            "color": "#fbbf24"
          },
          {
            "id": "card_midnight",
            "name": "Minuit",
            "rarity": "rare",
            "color": "#6366f1"
          },
          {
            "id": "card_sakura",
            "name": "Sakura",
            "rarity": "rare",
            "color": "#f9a8d4"
          },
          {
            "id": "card_cyber",
            "name": "Cyber",
            "rarity": "epic",
            "color": "#22d3ee"
          },
          {
            "id": "card_pharaoh",
            "name": "Pharaon",
            "rarity": "epic",
            "color": "#eab308"
          },
          {
            "id": "card_skull",
            "name": "Crâne",
            "rarity": "epic",
            "color": "#e2e8f0"
          },
          {
            "id": "card_rainbow",
            "name": "Arc-en-ciel",
            "rarity": "legendary",
            "color": "#f472b6"
          },
          {
            "id": "card_obsidian",
            "name": "Obsidienne",
            "rarity": "legendary",
            "color": "#64748b"
          },
          {
            "id": "card_infinity",
            "name": "Infini",
            "rarity": "mythic",
            "color": "#c084fc"
          }
        ]
      },
      {
        "id": "tokens",
        "name": "Jetons",
        "icon": "🪙",
        "bonus": {
          "label": "+4 % de gains globaux",
          "global": 0.04
        },
        "items": [
          {
            "id": "token_bronze",
            "name": "Bronze",
            "rarity": "common",
            "color": "#d97706"
          },
          {
            "id": "token_silver",
            "name": "Argent",
            "rarity": "common",
            "color": "#cbd5e1"
          },
          {
            "id": "token_gold",
            "name": "Or",
            "rarity": "common",
            "color": "#fbbf24"
          },
          {
            "id": "token_neon",
            "name": "Néon",
            "rarity": "rare",
            "color": "#ff4fd8"
          },
          {
            "id": "token_ocean",
            "name": "Océan",
            "rarity": "rare",
            "color": "#22d3ee"
          },
          {
            "id": "token_blood",
            "name": "Sang",
            "rarity": "rare",
            "color": "#ef4444"
          },
          {
            "id": "token_cyber",
            "name": "Cyber",
            "rarity": "epic",
            "color": "#a3e635"
          },
          {
            "id": "token_cosmos",
            "name": "Cosmos",
            "rarity": "epic",
            "color": "#8b5cf6"
          },
          {
            "id": "token_royal",
            "name": "Royal",
            "rarity": "legendary",
            "color": "#f59e0b"
          },
          {
            "id": "token_eternal",
            "name": "Éternel",
            "rarity": "mythic",
            "color": "#f0abfc"
          }
        ]
      },
      {
        "id": "tables",
        "name": "Tables",
        "icon": "🎴",
        "bonus": {
          "label": "+4 % de gains globaux",
          "global": 0.04
        },
        "items": [
          {
            "id": "table_velvet",
            "name": "Velours",
            "rarity": "common",
            "color": "#be123c"
          },
          {
            "id": "table_emerald",
            "name": "Émeraude",
            "rarity": "common",
            "color": "#047857"
          },
          {
            "id": "table_midnight",
            "name": "Minuit",
            "rarity": "common",
            "color": "#1e1b4b"
          },
          {
            "id": "table_neon",
            "name": "Néon",
            "rarity": "rare",
            "color": "#db2777"
          },
          {
            "id": "table_ice",
            "name": "Glace",
            "rarity": "rare",
            "color": "#0ea5e9"
          },
          {
            "id": "table_pharaoh",
            "name": "Pharaon",
            "rarity": "epic",
            "color": "#b45309"
          },
          {
            "id": "table_galaxy",
            "name": "Galaxie",
            "rarity": "legendary",
            "color": "#7c3aed"
          },
          {
            "id": "table_void",
            "name": "Vide",
            "rarity": "mythic",
            "color": "#0f172a"
          }
        ]
      },
      {
        "id": "avatars",
        "name": "Avatars",
        "icon": "🧑‍🚀",
        "bonus": {
          "label": "+10 % d'XP gagnée",
          "xp": 0.1
        },
        "items": [
          {
            "id": "avatar_rookie",
            "name": "Rookie",
            "rarity": "common",
            "emoji": "🙂"
          },
          {
            "id": "avatar_shark",
            "name": "Requin",
            "rarity": "common",
            "emoji": "🦈"
          },
          {
            "id": "avatar_fox",
            "name": "Renard",
            "rarity": "common",
            "emoji": "🦊"
          },
          {
            "id": "avatar_panda",
            "name": "Panda",
            "rarity": "rare",
            "emoji": "🐼"
          },
          {
            "id": "avatar_robot",
            "name": "Robot",
            "rarity": "rare",
            "emoji": "🤖"
          },
          {
            "id": "avatar_wizard",
            "name": "Sorcier",
            "rarity": "rare",
            "emoji": "🧙"
          },
          {
            "id": "avatar_alien",
            "name": "Alien",
            "rarity": "epic",
            "emoji": "👽"
          },
          {
            "id": "avatar_pharaoh",
            "name": "Pharaon",
            "rarity": "epic",
            "emoji": "🧿"
          },
          {
            "id": "avatar_dragon",
            "name": "Dragon",
            "rarity": "legendary",
            "emoji": "🐉"
          },
          {
            "id": "avatar_king",
            "name": "Roi",
            "rarity": "mythic",
            "emoji": "👑"
          }
        ]
      },
      {
        "id": "horses",
        "name": "Écurie",
        "icon": "🐎",
        "bonus": {
          "label": "+8 % de vitesse en course",
          "horseSpeed": 0.08
        },
        "items": [
          {
            "id": "horse_roan",
            "name": "Rouan",
            "rarity": "common",
            "color": "#b45309"
          },
          {
            "id": "horse_paint",
            "name": "Pie",
            "rarity": "common",
            "color": "#f9a8d4"
          },
          {
            "id": "horse_black",
            "name": "Noir",
            "rarity": "common",
            "color": "#334155"
          },
          {
            "id": "horse_white",
            "name": "Blanc",
            "rarity": "rare",
            "color": "#f8fafc"
          },
          {
            "id": "horse_golden",
            "name": "Doré",
            "rarity": "rare",
            "color": "#fbbf24"
          },
          {
            "id": "horse_shadow",
            "name": "Ombre",
            "rarity": "epic",
            "color": "#6d28d9"
          },
          {
            "id": "horse_storm",
            "name": "Orage",
            "rarity": "legendary",
            "color": "#22d3ee"
          },
          {
            "id": "horse_celestial",
            "name": "Céleste",
            "rarity": "mythic",
            "color": "#f0abfc"
          }
        ]
      }
    ]
  },
  "croupier": {
    "cooldownHours": 20,
    "intro": "La porte est entrouverte. Derrière le rideau de velours, le Croupier mélange un jeu qui ne devrait pas exister. Il vous regarde, sourit, et pose trois objets sur le tapis.",
    "options": [
      {
        "id": "red_door",
        "label": "La porte rouge",
        "icon": "🚪",
        "desc": "Une porte de velours qui sent la poudre et l'encens. Derrière : une bourse de jetons.",
        "effect": "tokens",
        "min": 4000,
        "max": 12000
      },
      {
        "id": "green_glass",
        "label": "Le verre vert",
        "icon": "🥃",
        "desc": "Un verre qui n'a jamais été rempli. Le Croupier y dépose deux dés et une promesse.",
        "effect": "gems",
        "min": 8,
        "max": 22
      },
      {
        "id": "golden_key",
        "label": "La clé d'or",
        "icon": "🗝️",
        "desc": "Une clé trop lourde pour être vraie. Elle ouvre les portes qui n'ont pas encore été dessinées.",
        "effect": "goldBalls",
        "min": 1,
        "max": 3
      }
    ],
    "outcomes": {
      "red_door": "Le Croupier pousse la porte du bout du doigt. Une pluie de jetons traverse le rideau. « Revenez quand vous aurez appris à perdre. »",
      "green_glass": "Le verre se remplit de lumière. Deux gemmes roulent sur le tapis, puis trois, puis dix. « La maison paie toujours ses dettes… à sa façon. »",
      "golden_key": "La clé tourne dans le vide. Quelque part, une serrure s'ouvre. Le Croupier hoche la tête. « Vous commencez à comprendre. »"
    }
  },
  "events": {
    "checkEveryMs": [
      180000,
      360000
    ],
    "events": [
      {
        "id": "golden_hour",
        "name": "Heure dorée",
        "icon": "🌟",
        "desc": "Tous les gains sont doublés pendant 2 minutes.",
        "weight": 30,
        "duration": 120000,
        "global": 100
      },
      {
        "id": "casino_party",
        "name": "Casino en fête",
        "icon": "🎉",
        "desc": "+50 % de gains sur tous les jeux pendant 3 minutes.",
        "weight": 25,
        "duration": 180000,
        "global": 50
      },
      {
        "id": "ball_rain",
        "name": "Pluie de billes",
        "icon": "🌧️",
        "desc": "10 billes gratuites au Plinko, immédiatement.",
        "weight": 20,
        "freePlinko": 10
      },
      {
        "id": "gem_shower",
        "name": "Pluie de gemmes",
        "icon": "💎",
        "desc": "Quelques gemmes tombent du plafond.",
        "weight": 12,
        "gems": 8
      },
      {
        "id": "mystery_visitor",
        "name": "Visiteur mystérieux",
        "icon": "🕵️",
        "desc": "Un inconnu vous propose trois bénédictions. Choisissez bien.",
        "weight": 13,
        "choice": true
      }
    ],
    "mysteryChoices": [
      {
        "id": "tokens",
        "label": "Une bourse de jetons",
        "icon": "🪙",
        "tokens": 25000
      },
      {
        "id": "gems",
        "label": "Un écrin de gemmes",
        "icon": "💎",
        "gems": 15
      },
      {
        "id": "luck",
        "label": "Un trèfle à quatre feuilles",
        "icon": "🍀",
        "buff": {
          "buff": "plinkoLuck",
          "value": 20,
          "duration": 600000,
          "label": "Trèfle du visiteur"
        }
      }
    ]
  },
  "prestige": {
    "layers": [
      {
        "key": "stars",
        "currency": "stars",
        "name": "Étoiles",
        "icon": "⭐",
        "level": 40,
        "grant": 0.05,
        "tagline": "La première boucle. Chaque étoile rend le casino plus généreux.",
        "shop": [
          {
            "id": "global",
            "name": "Multiplicateur stellaire",
            "icon": "🌌",
            "desc": "+10 % de gains globaux par niveau.",
            "base": 2,
            "growth": 2,
            "max": 25
          },
          {
            "id": "plinkoLuck",
            "name": "Chance stellaire",
            "icon": "🍀",
            "desc": "+2 % de chance de bords au Plinko.",
            "base": 1,
            "growth": 1,
            "max": 20
          },
          {
            "id": "startTokens",
            "name": "Caisse de départ",
            "icon": "🎒",
            "desc": "+10 000 jetons au début de chaque run.",
            "base": 2,
            "growth": 2,
            "max": 20
          },
          {
            "id": "offline",
            "name": "Veille prolongée",
            "icon": "🌙",
            "desc": "+2 h de gains hors-ligne.",
            "base": 2,
            "growth": 2,
            "max": 11
          },
          {
            "id": "autoBuy",
            "name": "Auto-achat global",
            "icon": "🤖",
            "desc": "Achète automatiquement l'amélioration la moins chère de tous les jeux débloqués.",
            "base": 5,
            "growth": 0,
            "max": 1
          },
          {
            "id": "gemBonus",
            "name": "Chercheur de gemmes",
            "icon": "💎",
            "desc": "+10 % de gemmes gagnées.",
            "base": 3,
            "growth": 2,
            "max": 10
          }
        ]
      },
      {
        "key": "crowns",
        "currency": "crowns",
        "name": "Couronnes",
        "icon": "👑",
        "level": 150,
        "grant": 0.15,
        "tagline": "La deuxième boucle. Le casino courbe l'échine.",
        "shop": [
          {
            "id": "global",
            "name": "Édit royal",
            "icon": "🏰",
            "desc": "+25 % de gains globaux par niveau.",
            "base": 1,
            "growth": 1,
            "max": 20
          },
          {
            "id": "allLuck",
            "name": "Faveur royale",
            "icon": "🍀",
            "desc": "+5 % de chance dans tous les jeux.",
            "base": 1,
            "growth": 2,
            "max": 10
          },
          {
            "id": "xpBoost",
            "name": "Éducation princière",
            "icon": "📚",
            "desc": "+25 % d'XP par niveau.",
            "base": 1,
            "growth": 2,
            "max": 10
          },
          {
            "id": "manager",
            "name": "Gérant virtuel",
            "icon": "🕴️",
            "desc": "Auto-joue et auto-mise dans les jeux compatibles.",
            "base": 8,
            "growth": 0,
            "max": 1
          },
          {
            "id": "startLevel",
            "name": "Avance royale",
            "icon": "🚀",
            "desc": "Commence chaque run 5 niveaux plus haut.",
            "base": 2,
            "growth": 2,
            "max": 10
          }
        ]
      },
      {
        "key": "diamonds",
        "currency": "diamonds",
        "name": "Diamants",
        "icon": "💠",
        "level": 500,
        "grant": 0.35,
        "tagline": "La troisième boucle. La lumière devient une matière.",
        "shop": [
          {
            "id": "global",
            "name": "Réfraction totale",
            "icon": "🌈",
            "desc": "+50 % de gains globaux par niveau.",
            "base": 1,
            "growth": 1,
            "max": 20
          },
          {
            "id": "startLevel",
            "name": "Saut de diamant",
            "icon": "⏫",
            "desc": "Commence chaque run 10 niveaux plus haut.",
            "base": 2,
            "growth": 2,
            "max": 15
          },
          {
            "id": "automation",
            "name": "Automatisation totale",
            "icon": "⚙️",
            "desc": "Débloque l'automatisation avancée de tous les jeux.",
            "base": 5,
            "growth": 0,
            "max": 1
          }
        ]
      },
      {
        "key": "relics",
        "currency": "relics",
        "name": "Reliques",
        "icon": "🔮",
        "level": 1000,
        "grant": 0.75,
        "tagline": "La boucle infinie. Il n'y a plus de plafond.",
        "shop": [
          {
            "id": "global",
            "name": "Écho infini",
            "icon": "♾️",
            "desc": "+100 % de gains globaux par niveau.",
            "base": 1,
            "growth": 2,
            "max": 50
          },
          {
            "id": "xpBoost",
            "name": "Savoir infini",
            "icon": "🧠",
            "desc": "+100 % d'XP par niveau.",
            "base": 2,
            "growth": 2,
            "max": 25
          }
        ]
      }
    ],
    "challenges": [
      {
        "id": "ch_plinko_100",
        "name": "Le mur des multiplicateurs",
        "icon": "🔻",
        "desc": "Toucher un ×100 au Plinko et survivre au vertige.",
        "stat": "games.plinko.stats.bestMult",
        "target": 100,
        "bonus": 2,
        "gems": 10
      },
      {
        "id": "ch_mines_10",
        "name": "Sang-froid absolu",
        "icon": "💣",
        "desc": "Encaisser à ×10 ou plus aux Mines.",
        "stat": "games.mines.stats.bestMult",
        "target": 10,
        "bonus": 2,
        "gems": 10
      },
      {
        "id": "ch_slots_jackpot",
        "name": "Le jackpot de l'infini",
        "icon": "🎰",
        "desc": "Décrocher le jackpot progressif d'une machine à sous.",
        "stat": "games.slots.stats.jackpots",
        "target": 1,
        "bonus": 3,
        "gems": 15
      },
      {
        "id": "ch_horses_25",
        "name": "L'écurie légendaire",
        "icon": "🐎",
        "desc": "Gagner 25 courses de chevaux.",
        "stat": "games.horses.stats.wins",
        "target": 25,
        "bonus": 2,
        "gems": 10
      }
    ]
  },
  "quests": {
    "dailyCount": 3,
    "weeklyCount": 1,
    "templates": [
      {
        "id": "plays",
        "label": "Jouer {n} parties",
        "stat": "totalBets",
        "base": 15,
        "perLevel": 4,
        "rewardGems": 1,
        "rewardMult": 1.2,
        "icon": "🎮"
      },
      {
        "id": "wins",
        "label": "Gagner {n} parties",
        "stat": "totalWins",
        "base": 8,
        "perLevel": 2,
        "rewardGems": 1,
        "rewardMult": 1.4,
        "icon": "🏆"
      },
      {
        "id": "earn",
        "label": "Gagner {n} jetons",
        "stat": "totalEarned",
        "base": 300,
        "growth": 1.28,
        "rewardGems": 2,
        "rewardMult": 0.55,
        "icon": "🪙"
      },
      {
        "id": "mult",
        "label": "Toucher un ×{n}",
        "stat": "biggestMult",
        "base": 4,
        "perLevel": 0.35,
        "absolute": true,
        "rewardGems": 2,
        "rewardMult": 30,
        "icon": "✨"
      },
      {
        "id": "plinko",
        "label": "Lâcher {n} billes au Plinko",
        "stat": "games.plinko.plays",
        "base": 12,
        "perLevel": 3,
        "rewardGems": 1,
        "rewardMult": 1.1,
        "icon": "🔻"
      },
      {
        "id": "blackjack",
        "label": "Gagner {n} mains au Blackjack",
        "stat": "games.blackjack.wins",
        "base": 5,
        "perLevel": 1.5,
        "rewardGems": 2,
        "rewardMult": 1.5,
        "icon": "🃏"
      },
      {
        "id": "roulette",
        "label": "Faire {n} lancers à la Roulette",
        "stat": "games.roulette.plays",
        "base": 8,
        "perLevel": 2,
        "rewardGems": 1,
        "rewardMult": 1.2,
        "icon": "🎡"
      },
      {
        "id": "slots",
        "label": "Lancer {n} tours de machine à sous",
        "stat": "games.slots.plays",
        "base": 10,
        "perLevel": 3,
        "rewardGems": 1,
        "rewardMult": 1.1,
        "icon": "🎰"
      },
      {
        "id": "mines",
        "label": "Encaisser {n} fois aux Mines",
        "stat": "games.mines.cashouts",
        "base": 4,
        "perLevel": 1,
        "rewardGems": 2,
        "rewardMult": 1.6,
        "icon": "💣"
      },
      {
        "id": "crash",
        "label": "Jouer {n} manches de Crash",
        "stat": "games.crash.plays",
        "base": 6,
        "perLevel": 1.5,
        "rewardGems": 1,
        "rewardMult": 1.4,
        "icon": "🚀"
      },
      {
        "id": "dice",
        "label": "Gagner {n} lancers aux Dés",
        "stat": "games.dice.wins",
        "base": 5,
        "perLevel": 1.5,
        "rewardGems": 1,
        "rewardMult": 1.3,
        "icon": "🎲"
      },
      {
        "id": "keno",
        "label": "Réussir {n} tirages au Keno",
        "stat": "games.keno.wins",
        "base": 4,
        "perLevel": 1,
        "rewardGems": 2,
        "rewardMult": 1.5,
        "icon": "🔢"
      },
      {
        "id": "poker",
        "label": "Gagner {n} mains de Poker vidéo",
        "stat": "games.poker.wins",
        "base": 4,
        "perLevel": 1,
        "rewardGems": 2,
        "rewardMult": 1.5,
        "icon": "♠️"
      },
      {
        "id": "horses",
        "label": "Gagner {n} courses",
        "stat": "games.horses.wins",
        "base": 3,
        "perLevel": 0.8,
        "rewardGems": 2,
        "rewardMult": 1.6,
        "icon": "🐎"
      }
    ]
  },
  "synergies": {
    "synergies": [
      {
        "id": "bj_to_plinko",
        "name": "Veine partagée",
        "icon": "🃏",
        "event": "bj_streak_5",
        "condition": "5 victoires consécutives au Blackjack",
        "desc": "+10 % de chance de bords au Plinko pendant 5 minutes.",
        "effect": {
          "type": "buff",
          "buff": "plinkoLuck",
          "value": 10,
          "duration": 300000,
          "label": "Veine partagée"
        }
      },
      {
        "id": "slots_to_plinko",
        "name": "Bille offerte",
        "icon": "🎰",
        "event": "slots_jackpot",
        "condition": "Décrocher le jackpot progressif",
        "desc": "Offre une bille arc-en-ciel garantie et 2 billes d'or.",
        "effect": {
          "type": "rainbow",
          "amount": 1,
          "goldBalls": 2,
          "label": "Jackpot partagé"
        }
      },
      {
        "id": "roulette_to_mines",
        "name": "Le radar s'allume",
        "icon": "🎡",
        "event": "roulette_win_35",
        "condition": "Gagner une mise sur un numéro plein",
        "desc": "Recharge le radar des Mines et donne 1 gemme.",
        "effect": {
          "type": "radar",
          "amount": 1,
          "gems": 1,
          "label": "Bon présage"
        }
      },
      {
        "id": "mines_to_crash",
        "name": "Sang-froid",
        "icon": "💣",
        "event": "mines_cashout_10x",
        "condition": "Encaisser à ×10 ou plus aux Mines",
        "desc": "Accorde un filet de sécurité gratuit pour la prochaine manche de Crash.",
        "effect": {
          "type": "crashSafety",
          "amount": 1,
          "label": "Sang-froid"
        }
      },
      {
        "id": "keno_to_gems",
        "name": "Tirage précieux",
        "icon": "🔢",
        "event": "keno_7_hits",
        "condition": "Trouver 7 numéros ou plus au Keno",
        "desc": "Offre 5 gemmes et +10 % de gains globaux pendant 3 minutes.",
        "effect": {
          "type": "buff",
          "buff": "global",
          "value": 10,
          "duration": 180000,
          "gems": 5,
          "label": "Tirage précieux"
        }
      },
      {
        "id": "poker_royal",
        "name": "Main de roi",
        "icon": "♠️",
        "event": "poker_royal",
        "condition": "Réaliser une quinte flush royale au Poker vidéo",
        "desc": "+50 % de gains globaux pendant 10 minutes.",
        "effect": {
          "type": "buff",
          "buff": "global",
          "value": 50,
          "duration": 600000,
          "label": "Main de roi"
        }
      },
      {
        "id": "horses_streak",
        "name": "Écurie en feu",
        "icon": "🐎",
        "event": "horses_3_streak",
        "condition": "3 courses gagnées d'affilée",
        "desc": "Offre des jetons et une chance de bille dorée au Plinko.",
        "effect": {
          "type": "buff",
          "buff": "plinkoLuck",
          "value": 15,
          "duration": 240000,
          "tokens": 5000,
          "label": "Écurie en feu"
        }
      },
      {
        "id": "plinko_to_blackjack",
        "name": "Carte en or",
        "icon": "✨",
        "event": "plinko_100x",
        "condition": "Toucher un ×100 ou plus au Plinko",
        "desc": "Votre prochaine main de Blackjack contient une carte dorée.",
        "effect": {
          "type": "goldenCard",
          "amount": 1,
          "gems": 2,
          "label": "Carte en or"
        }
      },
      {
        "id": "dice_streak",
        "name": "Les dés sont chauds",
        "icon": "🎲",
        "event": "dice_5_streak",
        "condition": "5 lancers gagnants d'affilée aux Dés",
        "desc": "+15 % aux Dés et +10 % de chance au Plinko pendant 5 minutes.",
        "effect": {
          "type": "buff",
          "buff": "diceWin",
          "value": 15,
          "duration": 300000,
          "label": "Dés chauds"
        }
      },
      {
        "id": "crash_to_global",
        "name": "Atterrissage parfait",
        "icon": "🚀",
        "event": "crash_cashout_20x",
        "condition": "Encaisser à ×20 ou plus au Crash",
        "desc": "+30 % de gains globaux pendant 5 minutes.",
        "effect": {
          "type": "buff",
          "buff": "global",
          "value": 30,
          "duration": 300000,
          "label": "Atterrissage parfait"
        }
      },
      {
        "id": "all_games",
        "name": "Le grand chelem",
        "icon": "🌐",
        "event": "all_games_unlocked",
        "condition": "Débloquer les 10 jeux du casino",
        "desc": "+5 % de gains permanents. Le casino vous appartient.",
        "effect": {
          "type": "permanent",
          "value": 5,
          "gems": 25,
          "label": "Grand chelem"
        }
      },
      {
        "id": "first_rebirth",
        "name": "Nouvelle lune",
        "icon": "🌙",
        "event": "rebirth_1",
        "condition": "Effectuer un premier Rebirth",
        "desc": "Offre 10 gemmes et 2 billes d'or.",
        "effect": {
          "type": "reward",
          "gems": 10,
          "goldBalls": 2,
          "label": "Nouvelle lune"
        }
      }
    ]
  },
  "unlocks": {
    "games": {
      "plinko": 1,
      "blackjack": 10,
      "roulette": 20,
      "slots": 30,
      "mines": 60,
      "crash": 75,
      "dice": 90,
      "keno": 100,
      "poker": 200,
      "horses": 300
    },
    "features": {
      "plinkoShop": 3,
      "autoDrop": 5,
      "quests": 8,
      "blackjack": 10,
      "achievements": 12,
      "stats": 15,
      "roulette": 20,
      "gems": 25,
      "slots": 30,
      "rebirth1": 40,
      "collections": 50,
      "mines": 60,
      "crash": 75,
      "dice": 90,
      "keno": 100,
      "rebirth2": 150,
      "poker": 200,
      "horses": 300,
      "synergies": 400,
      "rebirth3": 500,
      "secret": 750,
      "layer4": 1000,
      "automation3": 250,
      "automation4": 400,
      "manager": 500
    },
    "gameMeta": [
      {
        "id": "plinko",
        "name": "Plinko",
        "icon": "🔻",
        "tagline": "Faites tomber. Encaissez. Recommencez.",
        "description": "La porte d'entrée du casino. Lâchez des billes, touchez les bords et débloquez des multiplicateurs toujours plus fous.",
        "color": "#ff4fd8",
        "color2": "#7c3aed",
        "category": "phare"
      },
      {
        "id": "blackjack",
        "name": "Blackjack",
        "icon": "🃏",
        "tagline": "21, sans dépasser.",
        "description": "Affrontez le croupier, enchaînez les blackjacks et faites tomber des croupiers légendaires.",
        "color": "#22d3ee",
        "color2": "#2563eb",
        "category": "table"
      },
      {
        "id": "roulette",
        "name": "Roulette",
        "icon": "🎡",
        "tagline": "La bille décide. Vous misez.",
        "description": "Rouge, noir, douzaines, numéros pleins. Faites tourner la roue dorée et savourez le suspense.",
        "color": "#f43f5e",
        "color2": "#f59e0b",
        "category": "table"
      },
      {
        "id": "slots",
        "name": "Machines à sous",
        "icon": "🎰",
        "tagline": "Trois rouleaux. Mille frissons.",
        "description": "Wilds, scatters, tours gratuits et jackpot progressif partagé entre toutes les machines.",
        "color": "#a855f7",
        "color2": "#ec4899",
        "category": "machine"
      },
      {
        "id": "mines",
        "name": "Mines",
        "icon": "💣",
        "tagline": "Un pas de plus, ou pas.",
        "description": "Révélez les cases sûres, augmentez votre multiplicateur et encaissez avant l'explosion.",
        "color": "#f59e0b",
        "color2": "#ef4444",
        "category": "risque"
      },
      {
        "id": "crash",
        "name": "Crash",
        "icon": "🚀",
        "tagline": "Jusqu'où oserez-vous aller ?",
        "description": "Le multiplicateur monte, la fusée accélère. Encaissez avant que tout n'explose.",
        "color": "#34d399",
        "color2": "#06b6d4",
        "category": "risque"
      },
      {
        "id": "dice",
        "name": "Dés",
        "icon": "🎲",
        "tagline": "Au-dessus ou en dessous.",
        "description": "Choisissez un seuil, lancez les dés et laissez la chance décider. Les dés pipés sont là pour vous aider.",
        "color": "#60a5fa",
        "color2": "#818cf8",
        "category": "machine"
      },
      {
        "id": "keno",
        "name": "Keno",
        "icon": "🔢",
        "tagline": "Choisissez vos numéros chanceux.",
        "description": "Sélectionnez jusqu'à 10 numéros, regardez les boules tomber et visez le tirage parfait.",
        "color": "#4ade80",
        "color2": "#14b8a6",
        "category": "tirage"
      },
      {
        "id": "poker",
        "name": "Poker vidéo",
        "icon": "♠️",
        "tagline": "Gardez. Tirez. Encaissez.",
        "description": "Jacks or Better, Deuces Wild et mains royales. Une machine, cinq cartes, zéro bluff.",
        "color": "#e879f9",
        "color2": "#8b5cf6",
        "category": "carte"
      },
      {
        "id": "horses",
        "name": "Courses de chevaux",
        "icon": "🐎",
        "tagline": "Élevez votre écurie. Visez la ligne.",
        "description": "Entraînez vos chevaux, étudiez les cotes et pariez sur la course la plus palpitante du casino.",
        "color": "#fb923c",
        "color2": "#facc15",
        "category": "sport"
      },
      {
        "id": "vault",
        "name": "Salle des coffres",
        "icon": "🗝️",
        "tagline": "Un secret bien gardé.",
        "description": "Une salle cachée réservée aux habitués. Trois coffres, une seule clé par jour.",
        "color": "#fbbf24",
        "color2": "#f472b6",
        "category": "secret"
      }
    ]
  }
};
