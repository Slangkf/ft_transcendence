#!/bin/sh

while ! nc -z db 5432; do
  sleep 1
done
echo "Database is up!"

npm run db:migrate
npm run db:seed
exec npm run start