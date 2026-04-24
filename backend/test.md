----- register: 
curl -i -c cookies_1.txt -k -X POST http://localhost:3000/api/auth/register   -H "Content-Type: application/json"   -d '{
    "username": "testuser",
    "email": "test@gmail.com",
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

-----------join room (url need to check)
curl -X POST http://localhost:3000/api/room/entry \                                                               
  -H "Content-Type: application/json" \
  -b cookies_1.txt \
  -d '{
    "type": "game",
    "nickname": "player1",
	  "targetId": "room123"
  }'

  curl -X POST http://localhost:3000/api/game/multiplayer/start \
  -b cookies_1.txt

  curl -X POST http://localhost:3000/game/start \
  -H "Content-Type: application/json" \
  -b cookies_1.txt \
  -d '{"mode":"multiplayer"}'