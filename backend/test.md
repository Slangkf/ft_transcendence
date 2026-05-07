----- register: 
curl -i -c cookies_1.txt -k -X POST http://localhost:3000/api/auth/register   -H "Content-Type: application/json"   -d '{
    "username": "abcde22fd",
    "email": "abcde2d@gmail.com",
    "password": "12345678900"
  }'
curl -i -c cookies_1.txt -k -X POST http://localhost:3000/api/auth/register   -H "Content-Type: application/json"   -d '{
    "username": "abcdeef",
    "email": "abcd1efw@gmail.com",
    "password": "12345678900"
  }'



----- login :
curl -i -c cookies_1.txt -k -X POST https://localhost:8888/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@gmail.com",
    "password": "newpass123"
  }'

----- profil: 
curl -i -b cookies_1.txt -k https://localhost:8888/api/user/me

----- changepassword: 
curl -i -b cookies_1.txt -k -X POST https://localhost:8888/api/user/me/changepassword \
  -H "Content-Type: application/json" \
  -d '{
    "oldpassword": "12345678900",
    "newpassword": "newpass123",
    "confirmpd": "newpass123"
  }'

-----------start game (multiplayer can be solo)
  curl -X POST http://localhost:3000/api/game/multiplayer/start \
  -b cookies_2.txt

--------set ready 
  curl -X POST http://localhost:3000/api/game/multiplayer/ready/f95b62af-c3cf-4b13-984c-f3f7dfe68969 \
  -b cookies_1.txt \
  -H "Content-Type: application/json" \
  -d '{
    "isReady": true
  }'
-----------submit answer 
curl -i -X POST "http://localhost:3000/game/multiplayer/e087df91-4109-408f-a394-cb44bc476f7a/answer" \
  -b cookies_1.txt
  -H "Content-Type: application/json" \
  -d '{"selectedAnswerIndex": 0}'
----- update avatar:
curl -i -b cookies.txt -c cookies.txt -k -X POST https://localhost:8888/api/user/me/avatar \
  -F "avatar=@/absolute/path/to/avatar.jpg"


//////////////////////////////////////

1. Register

curl -i -k -c cookies.txt -X POST https://localhost:8888/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser_cycle",
    "email": "testcycle@gmail.com",
    "password": "12345678900"
  }'

2. Login

  curl -i -k -b cookies.txt -c cookies.txt -X POST https://localhost:8888/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testcycle@gmail.com",
    "password": "12345678900"
  }'


3. Lire le profil avec le cookie

curl -i -k -b cookies.txt https://localhost:8888/api/user/me

4. Changer le mot de passe

curl -i -k -b cookies.txt -X POST https://localhost:8888/api/user/me/changepassword \
  -H "Content-Type: application/json" \
  -d '{
    "oldpassword": "12345678900",
    "newpassword": "NouveauMdp123",
    "confirmpd": "NouveauMdp123"
  }'


5. Tester l’ancien mot de passe

curl -i -k -c cookies_old.txt -X POST https://localhost:8888/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testcycle@gmail.com",
    "password": "12345678900"
  }'

6. Login avec le nouveau mot de passe

curl -i -k -b cookies.txt -c cookies.txt -X POST https://localhost:8888/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testcycle@gmail.com",
    "password": "NouveauMdp123"
  }'

7. Vérifier à nouveau le profil

curl -i -k -b cookies.txt https://localhost:8888/api/user/me

8. Logout

curl -i -k -b cookies.txt -c cookies.txt -X POST https://localhost:8888/api/auth/logout


9. Vérifier qu’on n’est plus connecté

curl -i -k -b cookies.txt https://localhost:8888/api/user/me

Résultats attendus :
- `register` -> `201 Created`
- `login` -> `200 OK` + `Set-Cookie`
- `GET /api/user/me` -> `200 OK`
- `changepassword` -> `200 OK` avec message de relogin
- login avec ancien mot de passe -> `401`
- login avec nouveau mot de passe -> `200 OK`
- `logout` -> `200 OK`
- `GET /api/user/me` après logout -> `401`

Petit détail important :
- `-c cookies.txt` enregistre les cookies reçus
- `-b cookies.txt` renvoie les cookies stockés
- après `login` ou `logout`, utiliser `-b cookies.txt -c cookies.txt` évite de réutiliser un ancien `auth_token` révoqué

Si tu veux, je peux aussi te préparer une version “copier-coller” avec un seul utilisateur concret, par exemple `test1@gmail.com`, pour éviter de retaper les valeurs.


Test avatar upload 

curl -i -k -b cookies.txt \
  -X POST http://localhost:3000/api/user/me/avatar \
  -F "avatar=@/home/ikayiban/Downloads/image.jpg"


Tests pour le systeme d'amis :

Voici le protocole de test complet, pas à pas, pour valider l'intégralité de ton système d'amis et d'utilisateurs. 

Ce scénario est configuré pour ton architecture **HTTPS (port 8888)** et utilise deux fichiers de cookies distincts pour simuler deux utilisateurs sur le même terminal :
* **`cookie1.txt`** pour `testuser1` (ID: **2**)
* **`cookie2.txt`** pour `testuser2` (ID: **3**)

---

### ÉTAPE 1 : Création des comptes (Inscription / Register)

On commence par créer les deux utilisateurs. L'inscription va automatiquement générer et sauvegarder le premier jet de cookies.

#### A. Créer le premier utilisateur (`testuser1`)
```bash
curl -i -k -c cookie1.txt -X POST https://localhost:8888/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser1",
    "email": "test1@gmail.com",
    "password": "12345678900"
  }'
```

#### B. Créer le second utilisateur (`testuser2`)
```bash
curl -i -k -c cookie2.txt -X POST https://localhost:8888/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser2",
    "email": "test2@gmail.com",
    "password": "12345678900"
  }'
```
---

### ÉTAPE 2 : Authentification (Connexion / Login)

Pour s'assurer que les sessions et les cookies sont parfaitement isolés, on connecte explicitement chaque utilisateur dans son fichier de cookie dédié.

#### A. Connexion de `testuser1` (sauvegarde dans `cookie1.txt`)
```bash
curl -i -k -c cookie1.txt -X POST https://localhost:8888/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test1@gmail.com", "password": "12345678900"}'
```

#### B. Connexion de `testuser2` (sauvegarde dans `cookie2.txt`)
```bash
curl -i -k -c cookie2.txt -X POST https://localhost:8888/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test2@gmail.com", "password": "12345678900"}'
```

---

### ÉTAPE 3 : Recherche de Profils (Routes Utilisateur)

Avant d'envoyer une demande, tes utilisateurs utilisent les nouvelles routes de ton `UserRouter` pour trouver le profil de l'autre.

#### A. `testuser1` cherche le profil de `testuser2` par son Username
```bash
curl -i -k -b cookie1.txt https://localhost:8888/api/user/username/testuser2
```

#### B. `testuser2` cherche le profil de `testuser1` par son ID (ID = 2)
```bash
curl -i -k -b cookie2.txt https://localhost:8888/api/user/2
```

---

### ÉTAPE 4 : Gestion des demandes d'amis (Friendship Requests)

#### A. Envoi de la demande d'ami
`testuser2` (`cookie2.txt`) envoie une demande d'ami à `testuser1` (ID: 2).
```bash
curl -i -k -b cookie2.txt -X POST https://localhost:8888/api/friendship/request \
  -H "Content-Type: application/json" \
  -d '{"friendId": 2}'
```
*⚠️ **Important :** Note bien la valeur du champ `"id"` (ID de la relation) renvoyée dans la réponse JSON de cette commande. Nous l'appellerons `{friendshipId}` (généralement `1` si ta base est neuve).*

#### B. Vérification des requêtes envoyées par l'expéditeur
`testuser2` vérifie sa liste de demandes envoyées :
```bash
curl -i -k -b cookie2.txt https://localhost:8888/api/friendship/requests/sent
```

#### C. Vérification des requêtes reçues en attente par le destinataire
`testuser1` (`cookie1.txt`) vérifie s'il a bien reçu une demande :
```bash
curl -i -k -b cookie1.txt https://localhost:8888/api/friendship/requests/pending
```

---

### ÉTAPE 5 : Acceptation ou Refus de la demande

#### Option A : Accepter la demande d'ami
`testuser1` (`cookie1.txt`) accepte la demande. *(Remplace `{friendshipId}` par l'ID obtenu à l'étape 4.A)* :
```bash
curl -i -k -b cookie1.txt -X PUT https://localhost:8888/api/friendship/request/{friendshipId}/accept
```

*(Si tu préfères tester le refus à la place de l'acceptation :)*
#### Option B (Alternative) : Refuser la demande d'ami
```bash
curl -i -k -b cookie1.txt -X DELETE https://localhost:8888/api/friendship/request/{friendshipId}/decline
```

---

### ÉTAPE 6 : Consultation de la liste d'amis et des statuts

Une fois la demande acceptée :

#### A. Liste d'amis de `testuser1`
On vérifie que `testuser2` apparaît bien dans la liste avec son statut en ligne :
```bash
curl -i -k -b cookie1.txt https://localhost:8888/api/friendship/friends
```

#### B. Récupérer directement le statut en ligne de `testuser1` (ID: 2) depuis le compte de `testuser2`
```bash
curl -i -k -b cookie2.txt https://localhost:8888/api/friendship/status/2
```

#### C. Vérifier la mise à jour des profils (Compteur d'amis)
Le champ `friendsNb` dans le profil de `testuser1` doit maintenant afficher `1` :
```bash
curl -i -k -b cookie1.txt https://localhost:8888/api/user/me
```

---

### ÉTAPE 7 : Mise à jour manuelle du statut de présence
`testuser2` (`cookie2.txt`) change son statut de présence (par exemple, pour passer "OFFLINE" ou un autre état défini par ton enum).

```bash
curl -i -k -b cookie2.txt -X PUT https://localhost:8888/api/friendship/status \
  -H "Content-Type: application/json" \
  -d '{"status": "OFFLINE"}'
```

*(Tu peux relancer l'étape **6.A** avec le `cookie1.txt` pour vérifier que `testuser1` voit bien la mise à jour en temps réel).*

---

### ÉTAPE 8 : Suppression d'un ami (Unfriend)

`testuser1` (`cookie1.txt`) décide de retirer `testuser2` (ID: 3) de ses amis.

```bash
curl -i -k -b cookie1.txt -X DELETE https://localhost:8888/api/friendship/friend/3
```

#### Vérification finale :
Si tu lances la commande pour voir ton profil, le compteur `friendsNb` doit être redescendu à `0` :
```bash
curl -i -k -b cookie1.txt https://localhost:8888/api/user/me
```