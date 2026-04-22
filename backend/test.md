----- register: 
curl -i -c cookies.txt -k -X POST https://localhost:8888/api/auth/register   -H "Content-Type: application/json"   -d '{
    "username": "testuser",
    "email": "test@gmail.com",
    "password": "12345678900"
  }'


----- login :
curl -i -c cookies.txt -k -X POST https://localhost:8888/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@gmail.com",
    "password": "12345678900"
  }'

----- profil: 
curl -i -b cookies.txt -k https://localhost:8888/api/user/me

----- changepassword: 
curl -i -b cookies.txt -k -X POST https://localhost:8888/api/user/me/changepassword \
  -H "Content-Type: application/json" \
  -d '{
    "oldpassword": "12345678900",
    "newpassword": "newpass123",
    "confirmpd": "newpass123"
  }'

----- update avatar:
curl -i -b cookies.txt -k -X POST https://localhost:8888/api/user/me/avatar \
  -F "avatar=@/absolute/path/to/avatar.jpg"


//////////////////////////////////////

1. Register

curl -i -k -c cookies.txt -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser_cycle",
    "email": "testcycle@gmail.com",
    "password": "12345678900"
  }'


2. Login

curl -i -k -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testcycle@gmail.com",
    "password": "12345678900"
  }'


3. Lire le profil avec le cookie

curl -i -k -b cookies.txt http://localhost:3000/api/user/me


4. Changer le mot de passe

curl -i -k -b cookies.txt -X POST http://localhost:3000/api/user/me/changepassword \
  -H "Content-Type: application/json" \
  -d '{
    "oldpassword": "12345678900",
    "newpassword": "NouveauMdp123",
    "confirmpd": "NouveauMdp123"
  }'


5. Tester l’ancien mot de passe

curl -i -k -c cookies_old.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testcycle@gmail.com",
    "password": "12345678900"
  }'


6. Login avec le nouveau mot de passe

curl -i -k -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testcycle@gmail.com",
    "password": "NouveauMdp123"
  }'


7. Vérifier à nouveau le profil

curl -i -k -b cookies.txt http://localhost:3000/api/user/me


8. Logout

curl -i -k -b cookies.txt -X POST http://localhost:3000/api/auth/logout


9. Vérifier qu’on n’est plus connecté

curl -i -k -b cookies.txt http://localhost:3000/api/user/me


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

Si tu veux, je peux aussi te préparer une version “copier-coller” avec un seul utilisateur concret, par exemple `test1@gmail.com`, pour éviter de retaper les valeurs.
