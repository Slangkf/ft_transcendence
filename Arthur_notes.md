# Tasks
- Implement a complete web-based game where users can play against each other (backend part: 1 point)
- Implement a tournament system (1 point)
- Store tournament scores on the Blockchain (2 points)

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

## Workflow Backend 

Jianxin a commence la partie back du jeu en implementant la gestion des questions,
une partie "router" de

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