FROM	nginx:1.28.3-alpine

# Updates the package list and upgrades those that are installed.
# Installs required packages and then clean the apt cache.
RUN		apk add --no-cache openssl

# Creates a directory to store the TLS/SSL certificate and key.
# Generates a self-signed TLS/SSL certificate and key.
# Stores them in /etc/nginx/ssl.
RUN		mkdir -p /etc/nginx/ssl	&& \
		openssl req -x509 -nodes \
		-keyout /etc/nginx/ssl/server.key \
		-out /etc/nginx/ssl/server.crt \
		-subj "/C=FR/ST=IDF/L=Paris/O=42/OU=Transcendence/CN=trans.42.fr" \
		-addext "subjectAltName=DNS:trans.42.fr,IP:127.0.0.1"

# Replaces default NGINX configuration with custom nginx.conf.
COPY ./conf/nginx.conf /etc/nginx/nginx.conf.template
COPY ./docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Exposes HTTPS port.
EXPOSE	8888

# Starts the NGINX server in the foreground.
CMD	["/docker-entrypoint.sh"]
