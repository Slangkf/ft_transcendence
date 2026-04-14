----- register: 
curl -i -c cookies.txt -X POST http://localhost:3000/api/auth/register   -H "Content-Type: application/json"   -d '{
    "username": "testuser",
    "email": "test@gmail.com",
    "password": "12345678900"
  }'


----- login :
curl -i -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@gmail.com",
    "password": "12345678900"
  }'

----- profil: 
curl -i -b cookies.txt http://localhost:3000/api/user/me

----- changepassword: 
curl -i -b cookies.txt -X POST http://localhost:5500/api/me/changepassword \
  -H "Content-Type: application/json" \
  -d '{
    "oldpassword": "12345678900",
    "newpassword": "newpass123",
    "confirmpd": "newpass123"
  }'