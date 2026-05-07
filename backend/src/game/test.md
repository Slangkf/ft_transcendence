curl -i -b cookies_1.txt http://localhost:3000/game/solo/start


curl -i -b cookies.txt -X POST "http://localhost:3000/game/solo/YOUR_GAME_ID/answer" \
  -H "Content-Type: application/json" \
  -d '{"selectedAnswerIndex": 0}'


  curl -X POST "http://localhost:3000/game/solo/YOUR_GAME_ID/answer" \
  -H "Content-Type: application/json" \
  -d '{"selectedAnswerIndex": 1}'

  curl -X POST "http://localhost:3000/game/solo/invalid-id/answer" \
  -H "Content-Type: application/json" \
  -d '{"selectedAnswerIndex": 0}'


  curl -X POST "http://localhost:3000/game/solo/xxx/answer" \
  -H "Content-Type: application/json" \
  -d '{"selectedAnswerIndex": "abc"}'

