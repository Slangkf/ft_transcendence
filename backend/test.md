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