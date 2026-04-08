# **************************************************************************** #
#                                                                              #
#                                                         :::      ::::::::    #
#    Dockerfile                                         :+:      :+:    :+:    #
#                                                     +:+ +:+         +:+      #
#    By: ikayiban <ikayiban@student.42.fr>          +#+  +:+       +#+         #
#                                                 +#+#+#+#+#+   +#+            #
#    Created: 2026/04/02 18:30:57 by ikayiban          #+#    #+#              #
#    Updated: 2026/04/08 09:44:46 by ikayiban         ###   ########.fr        #
#                                                                              #
# **************************************************************************** #

FROM node:24-bookworm

WORKDIR /app

COPY package*.json .
RUN npm install

COPY . .

RUN npx prisma generate --schema=./database/schema.prisma

RUN npm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]