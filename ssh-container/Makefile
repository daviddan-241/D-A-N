# ─────────────────────────────────────────────────────────────────────────────
# DevBox Makefile — convenience commands
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: help build up down restart logs status shell add-key list-keys clean

CONTAINER   ?= devbox
DEV_USER    ?= devuser
SSH_PORT    ?= 2222
COMPOSE     := docker compose

help: ## Show this help
	@awk 'BEGIN{FS=":.*##"} /^[a-zA-Z_-]+:.*##/{printf "  \033[36m%-15s\033[0m %s\n",$$1,$$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "  Usage: make <target>  [VAR=value ...]"

# ── Lifecycle ──────────────────────────────────────────────────────────────────
build: ## Build the Docker image
	$(COMPOSE) build --no-cache

up: ## Start the container in the background
	$(COMPOSE) up -d
	@echo "Container started. SSH: ssh -p $(SSH_PORT) $(DEV_USER)@localhost"

down: ## Stop and remove the container (volumes are preserved)
	$(COMPOSE) down

restart: ## Restart the container
	$(COMPOSE) restart

# ── Status & logs ──────────────────────────────────────────────────────────────
status: ## Show container status and health
	$(COMPOSE) ps
	@echo ""
	@docker inspect --format='Health: {{.State.Health.Status}}' $(CONTAINER) 2>/dev/null || true

logs: ## Follow container logs
	$(COMPOSE) logs -f --tail=100

logs-ssh: ## Follow SSH-specific logs
	docker exec $(CONTAINER) tail -f /var/log/ssh-container/sshd.log

# ── Keys ───────────────────────────────────────────────────────────────────────
add-key: ## Add your default SSH public key (~/.ssh/id_*.pub)
	@KEY=$$(ls ~/.ssh/id_ed25519.pub ~/.ssh/id_rsa.pub 2>/dev/null | head -1); \
	if [ -z "$$KEY" ]; then echo "No SSH key found. Generate one: ssh-keygen -t ed25519"; exit 1; fi; \
	./scripts/add-key.sh "$$KEY"

add-key-file: ## Add a specific key file: make add-key-file FILE=~/.ssh/mykey.pub
	./scripts/add-key.sh "$(FILE)"

list-keys: ## List authorized keys in the running container
	./scripts/list-keys.sh

# ── Shell access ───────────────────────────────────────────────────────────────
shell: ## Open a bash shell in the container (as devuser)
	docker exec -it -u $(DEV_USER) $(CONTAINER) /bin/bash

shell-root: ## Open a root shell in the container
	docker exec -it $(CONTAINER) /bin/bash

# ── SSH test ───────────────────────────────────────────────────────────────────
ssh: ## SSH into the container using your default key
	ssh -p $(SSH_PORT) -o StrictHostKeyChecking=no $(DEV_USER)@localhost

# ── Maintenance ────────────────────────────────────────────────────────────────
health: ## Run the health check manually
	docker exec $(CONTAINER) /healthcheck.sh

regen-keys: ## Delete and regenerate SSH host keys (WARNING: clients must re-accept)
	@echo "WARNING: this will change the server's identity. All clients will see a host key warning."
	@read -p "Type 'yes' to continue: " c; [ "$$c" = "yes" ] || exit 1
	docker exec $(CONTAINER) bash -c "rm -f /etc/ssh/host_keys/*"
	$(COMPOSE) restart

clean: ## Remove containers AND volumes (DESTRUCTIVE — erases all data)
	@echo "WARNING: this will destroy all data in devbox_home, devbox_host_keys, and devbox_logs!"
	@read -p "Type 'destroy' to confirm: " c; [ "$$c" = "destroy" ] || exit 1
	$(COMPOSE) down -v

# ── First-run setup ────────────────────────────────────────────────────────────
setup: ## First-time setup: copy .env, build, start, and add your SSH key
	@if [ ! -f .env ]; then cp .env.example .env; echo "Created .env from .env.example"; fi
	$(MAKE) build
	$(MAKE) up
	@sleep 5
	$(MAKE) add-key
	@echo ""
	@echo "✓ DevBox ready! Connect with: make ssh"
