# Use the official NGINX 1.28.3 image based on Alpine Linux.
FROM	nginx:1.28.3-alpine

# Install OpenSSL without caching package index files.
RUN		apk add --no-cache openssl

# Create the directory used to store SSL certificates and keys.
# Generate a self-signed SSL certificate for HTTPS connections.
# Save the generated certificate and private key in /etc/nginx/ssl.
RUN		mkdir -p /etc/nginx/ssl	&& \
		openssl req -x509 -nodes \
		-keyout /etc/nginx/ssl/server.key \
		-out /etc/nginx/ssl/server.crt \
		-subj "/C=FR/ST=IDF/L=Paris/O=42/OU=Transcendence/CN=trans.42.fr" \
		-addext "subjectAltName=DNS:trans.42.fr,IP:127.0.0.1"

# Replace the default NGINX configuration with a custom template.
COPY ./conf/nginx.conf /etc/nginx/nginx.conf.template

# Copy the custom entrypoint script into the container.
COPY ./docker-entrypoint.sh /docker-entrypoint.sh

# Grant execution permissions to the entrypoint script.
RUN chmod +x /docker-entrypoint.sh

# Expose the HTTPS port used by NGINX.
EXPOSE	8888

# Start NGINX using the custom entrypoint script
CMD	["/docker-entrypoint.sh"]
