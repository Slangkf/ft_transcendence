
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


COPY backend/ .
COPY shared/ ./shared/
ENV PATH="/app/node_modules/.bin:$PATH"

RUN ls /app/node_modules/.bin/ts-node && echo "ts-node found" || echo "ts-node NOT found"
RUN npx prisma generate --schema=./prisma/schema.prisma

#RUN npm run build
RUN chmod +x entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
CMD ["npm", "run", "dev"]
