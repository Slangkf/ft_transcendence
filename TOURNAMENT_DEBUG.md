# Tournoi — diagnostic & correctifs (doc de reprise)

> À lire en premier avant de reprendre le sujet (après un `/clear`).
> Bug d'origine : « un joueur de tournoi est renvoyé au bracket / déconnecté du jeu
> sans pouvoir jouer ». L'enquête a traversé **6 runs Docker** ; ce document est
> consolidé sur l'**état actuel** (l'historique détaillé est résumé en bas).

## Contexte projet
- Branche de travail : `fix_Arthur`. Référence « qui marchait » avant merge : `fix_Arthur-avant-merge` (`1952f26`).
- Backend : **une seule instance** Docker (`container_name: backend`), pas de replicas. Pas d'adaptateur Redis Socket.IO → tout broadcast est **local au process**.
- Frontend : **`vite dev`** (port 5500), servi derrière nginx en **HTTPS `:8888`** (cert auto-signé).
- nginx : proxy WebSocket OK (`Upgrade`/`Connection`, `proxy_read_timeout 3600s`). **Pas en cause.**

## ÉTAT ACTUEL (après run nº6)
- ✅ Backend **incrashable**, ne forfaite/n'éjecte plus personne de façon parasite.
- ✅ Plus de « jump » au bracket ; les matchs se résolvent au **vrai score**.
- ✅ Dernier bug traité : page de jeu blanche pour le 3ᵉ joueur → fix `request_sync` (voir ci-dessous). **À RE-VALIDER au prochain run.**
- 🔎 Reste suspect mais non bloquant : un **2ᵉ socket « zombie »** apparaît parfois (1 connexion vive + 1 qui meurt au ping-timeout) ; le client est maintenant résilient via `request_sync`.

## La chaîne de causes (du serveur vers le client)
Le **déclencheur** est l'instabilité de connexion (remote + churn Socket.IO + cookies partagés en test). Le code la **convertissait** en défaite via une cascade de fragilités, corrigées une à une :

1. **Crash process** → restart Docker → tout le monde déconnecté. (pilier 1)
2. **Pointeur volatil `gameUser`** comme canal de livraison → events ciblés perdus. (pilier 2)
3. **Forfait sur déconnexion** → un blip réseau éliminait du bracket. (pilier 3)
4. **`leave()` HTTP** (pré-join d'un 2ᵉ onglet) → forfait instantané mid-match. (pilier 4)
5. **Page de jeu** : dépendances fragiles (variable partagée, hint sessionStorage) → gel / page blanche. (fixes client)

## Correctifs appliqués

### Backend — robustesse
- **Serveur incrashable** : `process.on('unhandledRejection'|'uncaughtException')` (log, pas `exit`) dans `index.ts` + `try/catch` global autour du `setTimeout` de déconnexion (`socket.gamehandler.ts`). *Au prochain crash apparent, chercher une ligne `[GUARD] …` : présente = attrapée ; absente = ce n'est pas une rejection JS (OOM / kill / restart manuel).*
- **Room par user** (fin du pointeur volatil) : chaque socket rejoint `user:<id>` (`onConnection`). `GameEmitter.toUser` émet vers cette room (tous les onglets reçoivent) ; `tryStart` / `createMatchRooms` utilisent `socketsJoin` ; `onDisconnect` teste « reste-t-il un socket dans `user:<id>` ? » via `fetchSockets()`. → multi-onglets / churn inoffensifs, sans kick-war.

### Backend — logique tournoi (`tournament.service.ts`)
- `forfeit()` ne traite que les matchs `ready|playing` (**plus `pending`**) → ne peut plus effondrer la finale d'un finaliste en attente.
- `onDisconnect` ne forfaite **jamais** une session tournoi (la session reste intacte, reconnexion directe ; le match se résout au score via le timer de question, ou au ready-timeout).
- `leave()` **hard-guard** : ignoré si `status ∈ {in_game, matched}` (log `leave() IGNORED`) → un `/leave` hors-bande ne sort plus un joueur d'un match actif.

### Backend — sync d'état (`socket.gamehandler.ts` + `socket.types.ts`)
- Nouvel event **`request_sync`** (client→serveur) → rejoue `handleReconnect` → `session_reconnect`. Le client peut pull l'état autoritatif à tout moment (indispensable depuis que le socket est persistant).
- `answer_result` porte `currentQuestionIndex` (compteur autoritatif serveur).
- `submit_answer` accepte `expectedQuestionId` (retry idempotent).

### Frontend
- `gameSocket.ts` : **`disconnectGameSocket()` = no-op** → le socket `/game` vit toute la session (se ferme au reload/logout). Plus de churn `io client disconnect`. `socket.connect()` gardé par `.active` (plus de connect pendant le handshake).
- `play/[gameId]/+page.svelte` :
  - émet **`request_sync`** au montage → la question vient toujours du serveur (fini la dépendance au hint `mp_first_question`) ;
  - **capture locale** du `nextQuestion` par résultat (fini la variable partagée `pendingNext` qui gelait le jeu sur « score seul » en demi) ;
  - **watchdog** : si `currentQuestion === null` & partie en cours >3 s → ré-émet `request_sync` ;
  - `questionNumber` dérivé du serveur ; `pendingAnswer` re-flushé à la reconnexion.
- `tournament/[tournamentId]/+page.svelte` : écoute `game_started` et redirige vers la page de jeu **si participant** (filet quand l'onglet visible est le bracket). + redirection dérivée du bracket + poll HTTP 3 s (déjà là).

### Réglages
- `ReadyTimerService` 60 s (`container.ts`) + compteur Ready client 60 s (cohérence).

## Procédure de test propre
```bash
docker compose up --build
docker exec redis redis-cli FLUSHALL          # état serveur VIERGE (évite les tournois fantômes)
```
- 4 **bacs à cookies isolés** (4 navigateurs, ou 4 profils, ou Firefox Multi-Account Containers). **Pas** d'incognito d'une même session (cookies partagés). **1 seul onglet par compte.**
- Entre 2 tests : fermer/rouvrir l'onglet sur `/modes` (vide le `sessionStorage`), rester loggé.
- Nettoyer le **compte de test supprimé** dont le cookie spamme `AppError: User no longer exist` (401).

### Lire les logs
```bash
docker logs -f backend 2>&1 | grep -E "\[TOURNEY\]|\[WS\]|\[GUARD\]"
# client : DevTools → Console (filtre [TOURNEY-CLIENT]) + Network → WS
```
Signes de succès : aucun `FORFEIT (disconnect)` ni `leave() IGNORED` pendant un match ; `CREATE /game socket #1` **unique** ; chaque joueur voit sa question dès l'entrée en partie.

## Rappels Socket.IO
- Chaque (re)connexion = **nouveau `socket.id`** ; tout mapping `userId→socketId` est volatil (→ on est passé aux rooms `user:<id>`).
- Les events one-shot **se perdent** si le socket n'est pas connecté à l'instant T (pas de rejeu) → préférer un **état récupérable** (room broadcast + `request_sync`).
- Les rooms Socket.IO sont **en mémoire** : un socket doit re-`join` à chaque reconnexion (`handleReconnect`).
- `socket.disconnect()` côté serveur → le client reçoit `io server disconnect` (pas d'auto-reconnect). Côté client, `reason=io client disconnect` = **notre code** a coupé.

## TODO / reste à faire
- [ ] **Valider le run nº7** (request_sync) : le 3ᵉ joueur doit voir sa question et jouer la demi.
- [ ] Élucider le **2ᵉ socket zombie** (2× `CONNECT` même `create#1`) si ça persiste — sinon laisser (inoffensif).
- [ ] Pilier 3, amélioration UX : marquer un joueur parti `disconnected` (+ reset à la reconnexion) pour que l'adversaire n'attende pas le timeout par question.
- [ ] Vérifier/empêcher la diversion d'un joueur de tournoi vers le matchmaking MP classique (bug « diversion », vu une fois run `6b7f702e`).
- [ ] **Retirer les logs** `[TOURNEY]` / `[WS]` / `[TOURNEY-CLIENT]` avant le merge final.
- [ ] `npm run type-check` / build **dans Docker** (l'hôte n'a pas les deps, `.bin` vide).
- [ ] Finaliser le merge `fix_Arthur` → `main` (PR).

## Run nº7 — « le 3ᵉ joueur saute toujours » : causes probables & test multi-machines

> Symptôme : le **3ᵉ arrivé** voit sa partie se terminer/figer **au moment où le 4ᵉ clique « Ready »**. Reproduit systématiquement **avec 4 navigateurs sur UNE seule machine**, IP `172.20.10.x` (= **partage de connexion iPhone**).

### Ce qui est ÉCARTÉ (preuves)
- **Contamination inter-match côté serveur** : les demies sont parfaitement isolées. `answer_result`/`game_finished` ne partent QUE vers `roomId` (`socket.gamehandler.ts:336/347/388`) ; le 3ᵉ joueur n'est jamais membre de la room de l'autre demie. Logs serveur : rooms + `gameId` distincts, `socketsInRoom=2` chacun.
- **Crash / OOM / restart backend** : `docker inspect backend` → `restarts=0`, `oom=false`. `entrypoint.sh` = `exec npm run start` (pas de boucle/watcher). Guards `[GUARD]` présents (`index.ts:19-24`) et **aucun** dans les logs. (Le « double boot » vu un jour venait de deux `up` successifs, pas d'un auto-restart.)
- **Position « 3ᵉ » ≠ bug de code** : le code traite les 2 demies symétriquement. Le « 3ᵉ » = `players[2]` = host/`p1` de la demie B = **la fenêtre qu'on laisse en arrière-plan pour aller cliquer Ready sur la 4ᵉ**. La déterministe vient du **protocole de test**, pas du code.

### Causes probables, classées (pour le test de demain)
1. **★ Suspension de la fenêtre en arrière-plan (nº1 sur une seule machine).** macOS **App Nap** + throttling des onglets en arrière-plan (Safari/Chrome) gèlent le JS et **ferment le WebSocket** → message client `WebSocket … closed due to suspension`. La fenêtre du 3ᵉ, passée en arrière-plan, ne répond plus aux **pings Socket.IO** → le serveur la jette (`transport close`) → au retour, le `question-timer` a déjà force-avancé ses questions ⇒ « partie finie ».
   - *Confirmer* : garder les 4 fenêtres **visibles côte à côte** (tiling) → si le bug disparaît, c'est ça. Ou tester multi-machines (chacun au premier plan).
2. **Ping-timeout Socket.IO par défaut trop court.** Aucun réglage dans `lib/socket.ts` ⇒ `pingInterval≈25s`, `pingTimeout≈20s`. Le moindre gel (throttle + contention CPU) fait rater le pong ⇒ déconnexion.
   - *Mitiger (app, utile en prod aussi)* : `new Server(httpserver, { pingInterval: 25000, pingTimeout: 60000, ... })`.
3. **Contention ressources sur 1 machine.** 4 navigateurs + `vite dev` + 5 conteneurs Docker ⇒ pression CPU/RAM ⇒ suspension + jank de l'event-loop. *Confirmer* : `docker stats` + Moniteur d'activité pendant le run.
4. **Réseau partage iPhone (`172.20.10.x`) — devient critique en MULTI-machine.** Le hotspot iOS a des **timeouts NAT idle agressifs**, peu de devices, jitter/pertes. Sur 1 machine le trafic navigateur↔serveur reste local (peu impactant) ; **dès que 4 machines distinctes passent par le hotspot, c'est une vraie source de coupures**. → **Utiliser un vrai routeur Wi-Fi/LAN demain, pas le hotspot.**
5. **Certificat auto-signé HTTPS `:8888` + reconnexion.** Chaque machine doit **accepter le cert** avant de jouer ; sinon la reco WSS peut échouer silencieusement (`xhr poll error`). → Visiter la page et accepter l'avertissement sur **chaque** navigateur d'abord. Idéalement `mkcert`.
6. **Fallback `polling` cassé.** Si le WS tombe et que la reco bascule en long-polling sur un chemin instable ⇒ `xhr poll error`. Option : forcer `transports: ['websocket']` (le WS est bien proxifié par nginx, `nginx.conf:35-46`).
7. **(Résiduel) cookie partagé / 2ᵉ socket** : nul en multi-machine (1 compte/machine). Ce run-ci l'isolation était OK (users 2/3/4/5 distincts).

### Durcissements app qui rendraient le symptôme inoffensif (même si la cause est l'environnement)
- **Serveur** `lib/socket.ts` : monter `pingTimeout` à ~60s (tolérer un onglet bridé).
- **Client** : sur `document.visibilitychange` → quand l'onglet **redevient visible**, `socket.connect()` + `request_sync` (la page `play` a déjà `request_sync` au mount + un watchdog, mais pas de relance explicite au retour de focus).
- Option `transports: ['websocket']` côté client (`gameSocket.ts`).
> Ces 3 changements ne sont **pas encore appliqués** — à décider après le test multi-machines.

### Protocole de test multi-machines (demain)
1. **Réseau** : un vrai routeur Wi-Fi/LAN. Noter l'IP LAN de la machine serveur (ex. `192.168.x.y`). **Pas** le hotspot iPhone.
2. **Serveur** : `docker compose up --build` puis `docker exec redis redis-cli FLUSHALL`. Vérifier l'absence de restart : `docker logs backend 2>&1 | grep -c "Server is running on port 3000"` (doit valoir **1**).
3. **4 machines distinctes**, 1 compte chacune (cookies propres). Sur chaque : ouvrir `https://<IP_LAN>:8888`, **accepter le certificat**, se logger.
4. **Empêcher la mise en veille** : écran/onglet au premier plan, désactiver la veille système + App Nap (macOS), et le throttling d'onglets en arrière-plan (Chrome : `chrome://flags` → *Throttle Javascript timers in background* = Disabled).
5. Lancer le tournoi. Sur **chaque** machine : DevTools → Console filtre `[TOURNEY-CLIENT]` **+** Network → WS → Frames. Noter l'heure exacte de toute coupure et ce qui se passait (focus perdu ? veille ? blip réseau ?).
6. **Serveur** en parallèle : `docker logs -f backend 2>&1 | grep -E "\[WS\]|\[TOURNEY\]|\[GUARD\]"`.

### Comment lire le résultat
- Bug **disparaît** en multi-machines (chacun au premier plan, vrai réseau) ⇒ **artefact de test** (suspension d'arrière-plan + hotspot), pas un bug produit. Appliquer alors les durcissements ci-dessus pour la robustesse réseau réelle.
- Un joueur tombe avec `transport close` / `closed due to suspension` **pile quand sa machine se met en veille / perd le focus / blip réseau** ⇒ environnement → durcir (ping-timeout + resync au visibilitychange).
- Un joueur tombe **sans aucun event réseau côté client** alors que le serveur émet quelque chose vers lui ⇒ rouvrir la piste code (peu probable après les fixes).
- `xhr poll error` ⇒ problème transport/cert/reco → cert non accepté, ou forcer `transports: ['websocket']`.

## Historique condensé des runs (pour mémoire)
- **nº1** (`logs.txt`, `c8ec3f9e`) : 2 mécanismes de bounce (NO socketId + forfait-déconnexion/tempête). → 5 fixes initiaux (#1 pending, #2 in_game, #3 pointeur, #4 retry submit, #5 compteur).
- **nº2** : le backend **crashait** (pas de handler global) + 2 sockets/compte. → 3 piliers (incrashable, room par user, pas de forfait-déconnexion).
- **nº3** : forfaits immédiats restants = `leave()` (pré-join d'un 2ᵉ onglet). → pilier 4 (leave guard + suppression pré-join).
- **nº4** : backend OK, bug 100% client = joueur « resté sur le bracket ». → fix `game_started`→play sur le bracket. Puis **gel « score seul »** = `pendingNext` partagé. → capture locale + watchdog.
- **nº5** : racine du « 3ème » = churn `io client disconnect` (`disconnectGameSocket` à la navigation). → no-op (socket persistant).
- **nº6** : effet de bord du socket persistant = plus de `session_reconnect` auto → page de jeu blanche. → **`request_sync`** + `.active`.
