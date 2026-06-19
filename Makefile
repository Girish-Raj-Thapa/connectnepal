SHELL := /bin/sh

PROJECT_NAME := connectnepal
COMPOSE_BASE := docker compose --project-directory . -f infra/docker-compose.yml
COMPOSE_DEV := $(COMPOSE_BASE) -f infra/docker-compose.dev.yml
COMPOSE_PROD := $(COMPOSE_BASE) -f infra/docker-compose.prod.yml
SERVICE ?= api

.PHONY: help
help:
	@printf "\nDocker workflow\n\n"
	@printf "  make dev-up            Start dev stack in background\n"
	@printf "  make dev-build         Build and start dev stack\n"
	@printf "  make dev-down          Stop dev stack\n"
	@printf "  make dev-logs          Tail dev logs (SERVICE=<name> for a single service)\n"
	@printf "  make dev-ps            Show dev containers\n"
	@printf "  make dev-restart       Restart one dev service (SERVICE=api)\n"
	@printf "  make dev-shell         Open shell in dev service\n"
	@printf "  make dev-migrate       Run Django migrations in dev\n"
	@printf "  make dev-collectstatic Run collectstatic in dev\n"
	@printf "  make dev-config        Render merged dev compose config\n"
	@printf "\n"
	@printf "  make prod-up           Start prod stack in background\n"
	@printf "  make prod-build        Build and start prod stack\n"
	@printf "  make prod-down         Stop prod stack\n"
	@printf "  make prod-logs         Tail prod logs (SERVICE=<name> for a single service)\n"
	@printf "  make prod-ps           Show prod containers\n"
	@printf "  make prod-restart      Restart one prod service (SERVICE=api)\n"
	@printf "  make prod-shell        Open shell in prod service\n"
	@printf "  make prod-migrate      Run Django migrations in prod image\n"
	@printf "  make prod-collectstatic Run collectstatic in prod image\n"
	@printf "  make prod-config       Render merged prod compose config\n"
	@printf "\n"
	@printf "  make images            Show local Docker image sizes\n"
	@printf "  make clean-dev         Stop dev stack and remove volumes\n"
	@printf "  make clean-prod        Stop prod stack and remove volumes\n\n"

.PHONY: dev-up
dev-up:
	$(COMPOSE_DEV) up -d

.PHONY: dev-build
dev-build:
	$(COMPOSE_DEV) up --build -d

.PHONY: dev-down
dev-down:
	$(COMPOSE_DEV) down

.PHONY: clean-dev
clean-dev:
	$(COMPOSE_DEV) down -v

.PHONY: dev-logs
dev-logs:
	$(COMPOSE_DEV) logs -f $(SERVICE)

.PHONY: dev-logs-all
dev-logs-all:
	$(COMPOSE_DEV) logs -f

.PHONY: dev-ps
dev-ps:
	$(COMPOSE_DEV) ps

.PHONY: dev-restart
dev-restart:
	$(COMPOSE_DEV) restart $(SERVICE)

.PHONY: dev-shell
dev-shell:
	$(COMPOSE_DEV) exec $(SERVICE) sh

.PHONY: dev-migrate
dev-migrate:
	$(COMPOSE_DEV) run --rm api python manage.py migrate

.PHONY: dev-collectstatic
dev-collectstatic:
	$(COMPOSE_DEV) run --rm api python manage.py collectstatic --noinput

.PHONY: dev-config
dev-config:
	$(COMPOSE_DEV) config

.PHONY: prod-up
prod-up:
	$(COMPOSE_PROD) up -d

.PHONY: prod-build
prod-build:
	$(COMPOSE_PROD) up --build -d

.PHONY: prod-down
prod-down:
	$(COMPOSE_PROD) down

.PHONY: clean-prod
clean-prod:
	$(COMPOSE_PROD) down -v

.PHONY: prod-logs
prod-logs:
	$(COMPOSE_PROD) logs -f $(SERVICE)

.PHONY: prod-logs-all
prod-logs-all:
	$(COMPOSE_PROD) logs -f

.PHONY: prod-ps
prod-ps:
	$(COMPOSE_PROD) ps

.PHONY: prod-restart
prod-restart:
	$(COMPOSE_PROD) restart $(SERVICE)

.PHONY: prod-shell
prod-shell:
	$(COMPOSE_PROD) exec $(SERVICE) sh

.PHONY: prod-migrate
prod-migrate:
	$(COMPOSE_PROD) run --rm api python manage.py migrate

.PHONY: prod-collectstatic
prod-collectstatic:
	$(COMPOSE_PROD) run --rm api python manage.py collectstatic --noinput

.PHONY: prod-config
prod-config:
	$(COMPOSE_PROD) config

.PHONY: images
images:
	docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
