#!/bin/sh
set -e

# Dynamically retrieve the system DNS resolver from /etc/resolv.conf.
DNS=$(cat /etc/resolv.conf | grep nameserver | head -1 | awk '{print $2}')
echo "Using DNS resolver: $DNS"

# Replace the placeholder in the NGINX configuration template with the detected DNS resolver.
sed "s/__RESOLVER__/$DNS/g" /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Validate the generated NGINX configuration before starting the service.
nginx -t

# Start NGINX in the foreground.
exec nginx -g "daemon off;"
