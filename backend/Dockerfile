# --- ÉTAPE 1 : Build ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./
COPY tsconfig.json ./

# Installer toutes les dépendances (y compris devDependencies pour compiler)
RUN npm install

# Copier le reste du code source
COPY . .

# Compiler le TypeScript en JavaScript
RUN npm run build

# --- ÉTAPE 2 : Exécution ---
FROM node:20-alpine AS runner

WORKDIR /app

# Définir l'environnement sur production
ENV NODE_ENV=production

# Copier uniquement les fichiers nécessaires depuis l'étape de build
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist

# Installer uniquement les dépendances de production (plus léger, plus sûr)
RUN npm install --omit=dev

# Exposer le port sur lequel ton Express tourne (ex: 3000)
EXPOSE 3000

# Lancer l'application
CMD ["node", "dist/main.js"]