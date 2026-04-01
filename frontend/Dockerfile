# Node base image with specific Debian distribution.
FROM    node:24-bookworm

# Working directory.
WORKDIR /app

# Copy the local directory into the /app container directory.
COPY    ./ /app

# Install all listed dependencies from package.json
RUN     npm install

# Svelte-kit listens on port 5500.
EXPOSE  5500

CMD ["npm", "run", "dev"]