# Node base image with specific Debian distribution.
FROM    node:24-bookworm

# Working directory.
WORKDIR /app

# Copy the local directory into the /app container directory.
COPY    frontend/package*.json ./
COPY    ./frontend  .
COPY    ./shared    ./src/lib

# Install all listed dependencies from package.json
RUN     npm install

# Svelte-kit listens on port 5500.
EXPOSE  5500

CMD ["npm", "run", "dev"]