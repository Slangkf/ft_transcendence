#<<<<<<< HEAD
## ---- Build Stage ----
#FROM node:20-alpine AS builder
#
#RUN corepack enable && corepack prepare pnpm@latest --activate
#
#WORKDIR /app
#
#COPY pnpm-workspace.yaml ./
#COPY package.json ./
#
#COPY shared/package.json ./shared/
#COPY backend/package.json ./backend/
#
## 去掉 --frozen-lockfile，改用 --no-frozen-lockfile
#RUN pnpm install --no-frozen-lockfile
#
#COPY shared/ ./shared/
#COPY backend/ ./backend/
#
#RUN pnpm --filter @myapp/shared build
#RUN pnpm --filter backend build
#
## ---- Production Stage ----
#FROM node:20-alpine AS production
#
#RUN corepack enable && corepack prepare pnpm@latest --activate
#
#WORKDIR /app
#
#COPY pnpm-workspace.yaml ./
#COPY package.json ./
#COPY shared/package.json ./shared/
#COPY backend/package.json ./backend/
#
#RUN pnpm install --no-frozen-lockfile --prod
#
#COPY --from=builder /app/shared/dist ./shared/dist
#COPY --from=builder /app/backend/dist ./backend/dist
#
#RUN addgroup -S appgroup && adduser -S appuser -G appgroup
#USER appuser
#
#EXPOSE 3000
#
#CMD ["node", "backend/dist/index.js"]
#=======
# **************************************************************************** #
#                                                                              #
#                                                         :::      ::::::::    #
#    Dockerfile                                         :+:      :+:    :+:    #
#                                                     +:+ +:+         +:+      #
#    By: ikayiban <ikayiban@student.42.fr>          +#+  +:+       +#+         #
#                                                 +#+#+#+#+#+   +#+            #
#    Created: 2026/04/02 18:30:57 by ikayiban          #+#    #+#              #
#    Updated: 2026/04/08 16:54:01 by ikayiban         ###   ########.fr        #
#                                                                              #
# **************************************************************************** #

FROM node:24-bookworm

RUN apt-get update \ 
    && apt-get install -y netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/package*.json ./
RUN npm install

COPY backend/   ./backend
COPY shared/    ./shared
COPY    backend/database    ./prisma
RUN npx prisma generate --schema=./prisma/schema.prisma

#RUN npm run build
COPY    backend/entrypoint.sh   .
RUN chmod +x entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
