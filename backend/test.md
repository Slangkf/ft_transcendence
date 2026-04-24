----- register: 
curl -i -c cookies_1.txt -k -X POST http://localhost:3000/api/auth/register   -H "Content-Type: application/json"   -d '{
    "username": "abcd",
    "email": "abcd@gmail.com",
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
  -b cookies_1.txt

--------set ready 
  curl -X POST http://localhost:3000/api/game/:room/ready \
  -b cookies_1.txt 