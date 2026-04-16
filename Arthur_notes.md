# Tasks
- Implement a complete web-based game where users can play against each other (backend part: 1 point)
- Implement a tournament system (1 point)
- Store tournament scores on the Blockchain (2 points)
- score et gestion daffichage au hasard des questions

## Workflow Backend 

1. L'utilisateur tape http://localhost:5500/mode

  SvelteKit (le framework frontend) reçoit la requête. Son routeur basé sur les fichiers regarde dans src/routes/ — il trouve mode/+page.svelte et le sert.

  La page affiche les 3 boutons. L'utilisateur clique Solo.

  ---
  2. Clic Solo → navigation vers /game?mode=solo

  // mode/+page.svelte
  onclick={() => goto('/game?mode=solo')}

  SvelteKit fait une navigation côté client (pas de rechargement de page). Il charge routes/game/+page.svelte.

  ---
  3. La page /game s'initialise

  // game/+page.svelte
  const mode = $derived(page.url.searchParams.get('mode') ?? 'solo');
  // mode = "solo"

  La page lit le paramètre mode dans l'URL. Toutes les variables réactives sont initialisées à vide (gameId = null, currentQuestion = null, etc.). Un bouton
  "Start game" est affiché.

  ---
  4. Clic "Start game" → appel HTTP au backend

  // game/+page.svelte
  const response = await fetch(`http://localhost:3000/game/solo/start`);

  Une requête GET part vers le backend Node/Express sur le port 3000.

  ---
  5. Express reçoit GET /game/solo/start

  // game.router.ts
  gameRouter.get('/:mode/start', GameController.start);
  // req.params.mode = "solo"

  Express match la route et appelle GameController.start.

  ---
  6. Le controller identifie le mode et délègue

  // game.controller.ts
  const service = getModeService('solo');
  // retourne l'instance SoloService déjà créée en mémoire

  const game = await service.startGame();

  getModeService consulte la map modeInstances et retourne le singleton SoloService.

  ---
  7. SoloService.startGame() — cœur de la logique

  // solo.ts
  const quizId = await this.pickNextQuizId();  // → appel DB

  pickNextQuizId() (dans GameService) :
  - Si le pool availableQuizIds[] est vide : interroge Prisma pour récupérer tous les IDs de quiz, mélange aléatoirement, remplit le pool
  - Retire et retourne le premier ID du pool (aucun quiz ne se répète jusqu'à épuisement)

  const questions = await this.fetchQuizQuestions(quizId);  // → appel DB

  fetchQuizQuestions() (dans GameService) :
  - Prisma envoie SELECT * FROM Quiz JOIN Question WHERE quiz.id = ? à PostgreSQL
  - Retourne les questions avec leurs options et la bonne réponse
  - Mappe vers le type interne Question (avec correctAnswerIndex calculé, jamais envoyé au front)

  const gameId = randomUUID();  // ex: "a3f8-..."
  this.gameRepository.create(gameState);    // stocke l'état en RAM
  this.gameQuestions.set(gameId, questions); // stocke les questions en RAM

  L'état de la partie vit en mémoire sur le serveur, lié à un gameId unique.

  ---
  8. Le controller répond au frontend

  {
    "success": true,
    "data": {
      "gameId": "a3f8-...",
      "question": {
        "id": 12,
        "question": "Quelle est la capitale de l'Allemagne ?",
        "options": ["Paris", "Berlin", "Madrid", "Rome"]
      }
    }
  }

  correctAnswerIndex n'est jamais inclus — seul le serveur sait quelle réponse est bonne.

  ---
  9. Le frontend reçoit et affiche

  // game/+page.svelte
  gameId = result.data.gameId;         // gardé en mémoire pour les prochains appels
  currentQuestion = result.data.question;

  Svelte détecte que currentQuestion a changé (variable $state) et re-rend automatiquement le DOM — la question et ses 4 boutons de réponse apparaissent.

  ---
  10. L'utilisateur clique une réponse → GET /game/solo/<gameId>/answer?selectedAnswerIndex=1

  Le backend :
  1. Retrouve le GameState en RAM via le gameId
  2. Retrouve les questions en RAM via la gameQuestions Map
  3. Compare selectedAnswerIndex avec correctAnswerIndex stocké côté serveur
  4. Met à jour le score, avance currentQuestionIndex
  5. Si c'est la dernière question → delete de la Map et du repository (libération mémoire)
  6. Retourne { isCorrect, correctAnswer, nextQuestion, score, isFinished }

  Le frontend met à jour le feedback, le score, et affiche la question suivante — ou l'écran de fin si isFinished: true.

## Current questions
- Processus du focntionnement du jeu cote back (structure claire et utilisable de tous comme une class en cpp?)
- Regarder le fonctionnement de async/await (En C/C++, tu raisonnes souvent en exécution assez linéaire tandis que 
En Node/TypeScript backend, beaucoup d’opérations ne rendent pas le résultat immédiatement.)

## TypeScript 
Typescript/js sont des langages utilisant fortement la poo, possibilite dinstancie un objet sans que ce dernier n'appaartienne a une class.

Types de base :
- let name: string = "Arthur";
- let score: number = 0;
- let isReady: boolean = false;
tableaux :
- let players: string[] = ["Arthur", "Igor"];
Objets :
- const player = {
  id: "u1",
  username: "Arthur",
  score: 0
};

- Union de types : une variable peut avoir plusieurs types possibles définis à l’avance 
type GameStatus = "waiting" | "running" | "finished";

## JSON
- JSON (**JavaScript Object Notation**) est un format texte standard pour représenter des données structurées.
### A quoi ca sert ?
Il permet d’écrire des objets avec des clés/valeurs, des tableaux, des nombres, des chaînes et des booléens.
Ce n’est pas du code exécutable, uniquement de la donnée.
Il est très utilisé car il est simple, lisible et compatible avec presque tous les langages.
- Premier usage : **configuration** (ex : `package.json` pour définir dépendances et scripts).
- Deuxième usage : **transport de données** entre frontend et backend (API, WebSocket).
- Troisième usage : **stockage simple** (mock data, questions de quiz, seeds).
- Quatrième usage : **description de structure** (ex : ABI de smart contract).
- Cinquième usage : **sérialisation** (transformer un objet en texte et inversement).
JSON n’est pas une base de données, mais peut contenir des données simples.
Dans transcendence, il sert à :
- configurer l’environnement Node et les outils.
- envoyer l’état du jeu du backend vers le frontend.
- messages temps réel (WebSocket).
- contenir des données statiques comme des questions de quiz.
- interagir avec la blockchain via des fichiers ABI.

## Express.js
### A quoi ca sert ?
Express.js est souvent utilisé pour créer des services web accessibles par un navigateur ou une application mobile. Il permet aussi de concevoir des API REST, utilisées pour faire communiquer des logiciels entre eux.

Dans un contexte professionnel, il sert à produire rapidement des outils internes, des tableaux de bord ou des systèmes métier connectés à des bases de données.

Il est aussi utilisé dans le développement d’applications full-stack JavaScript, en association avec des frameworks frontend comme React ou Angular.
### Comment fonctionne Express
Express.js repose sur le concept de middleware. Un middleware est une fonction qui reçoit une requête, la traite, puis passe le contrôle à la fonction suivante.

La logique d’une application est découpée en couches légères, chacune ayant une responsabilité précise : authentification, traitement des données, envoi de la réponse, etc.

Pour créer des routes (chemins correspondants à différentes pages ou services), Express.js utilise une syntaxe simple. Il suffit de spécifier l’URL, la méthode HTTP (GET, POST, PUT, DELETE) et la fonction qui doit répondre.

Express.js est parfois confondu avec Node.js. Node.js est le moteur d'exécution JavaScript côté serveur. Express.js est une couche logicielle construite au-dessus de Node.js pour simplifier le développement web.



### etape A — creation d’une partie
Le front envoie :
type de partie
nombre de joueurs
options
theme
mode tournoi ou non
Le backend :
valide les parametres
cree une instance de game
initialise l’etat
renvoie l’etat initial

### etape B — lobby
Les joueurs rejoignent la partie.
Le backend gere :
liste des joueurs
statut ready / not ready
nombre max
etat du lobby
Le front affiche ce que le back renvoie.

### etape C — demarrage
Quand les conditions sont remplies :
nombre de joueurs atteint
tout le monde prêt
 backend se met en route :
verrouille les inscriptions
initialise le round 1
choisit la premiere question ou l’etat initial
passe status à running

### etape D — boucle de jeu
Pendant la partie :
les joueurs envoient des actions
le backend les reçoit ->
il les valide
il met à jour l’etat
il envoie l’etat mis à jour à tous les clients

### etape E — fin de manche / tour
calcule les scores
determine qui passe au round suivant
prepare la suite

### etape F — fin de partie
determine le gagnant
enregistre le resultat
notifie le tournoi si besoin

### etape G — tournoi / blockchain
Si la partie est liee à un tournoi :
le resultat alimente le bracket
si tournoi fini, envoi du resume on-chain