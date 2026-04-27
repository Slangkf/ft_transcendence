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