# Use the official Node.js 24 image based on Debian Bookworm.
FROM    node:24-bookworm

# Set the working directory inside the container.
WORKDIR /app

# Copy the project files from the local machine to the container.
COPY    ./ /app

# Install project dependencies defined in package.json.
RUN     npm install

# Expose the port used by the SvelteKit server.
EXPOSE  5500

# Start the application in development mode.
CMD ["npm", "run", "dev"]
