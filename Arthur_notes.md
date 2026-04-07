# Tasks
- Implement a complete web-based game where users can play against each other (backend part: 1 point)
- Implement a tournament system (1 point)
- Store tournament scores on the Blockchain (2 points)

## Current questions
- Processus du focntionnement du jeu cote back (structure claire et utilisable de tous comme une class en cpp?)
- Regarder le fonctionnement de async/await (En C/C++, tu raisonnes souvent en exécution assez linéaire tandis que 
En Node/TypeScript backend, beaucoup d’opérations ne rendent pas le résultat immédiatement.)

## Workflow Backend 

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