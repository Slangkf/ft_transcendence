
.PHONY: setup-secrets build up down restart clean reset-secrets logs-all


#setup secrets for podman 
setup-secrets:
	@echo "Setting up secrets........"
	@podman swarm init 2>/dev/null || true
	@echo "Creating secrets from ./secrets folder..."
	@for file in ./secrets/*; do \
		if [ -f "$$file" ]; then \
			name=$$(basename "$$file"); \
			echo "  Processing: $$name"; \
			podman secret rm "$$name" 2>/dev/null || true; \
			podman secret create "$$name" "$$file"; \
			echo " Created: $$name"; \
		fi \
	done
	@echo ""
	@echo "All secrets:"
	@podman secret ls

#buile images 
build: setup-secrets
	@echo "Build images for the containers"
	@podman compose build --no-cache
	@echo "Build complete!"

up: setup-secrets
	@echo "Starting containers......"
	@podman compose up -d 
	@echo "Containers started!"
	@echo ""
	@echo "Container status:"
	@podman compose ps
	@echo ""
	@echo "	Access services:"
	@echo "   Frontend: http://localhost:8888"
	@echo "   Backend API: http://localhost:3000"
	@echo "   Database: localhost:5432"
	@echo "   Redis: localhost:6380"

down : 
	@echo "Stopping containers....."
	@podman compose down 
	@echo "Containers stopped!"

restart: down up
	@echo "Container restarted!"

clean: down
	@echo "Cleaning up ....."
	@echo "Remove volumes"
	@podman compose down -v 
	@echo "cleaning system......."
	@podman system prune -f 
	@echo "Cleanup complete"


reset-secrets:
	@echo "🗑️  Removing all secrets..."
	@for secret in $$($(DOCKER_CMD) secret ls --format "{{.Name}}" 2>/dev/null); do \
		$(DOCKER_CMD) secret rm "$$secret" 2>/dev/null || true; \
	done
	@echo "✅ Secrets removed!"
	@echo ""

logs-all:
	@echo "All logs:"
	@podman compose logs -f 