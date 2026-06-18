# ConnectNepal Platform

ConnectNepal is a community-based tourism marketplace platform for discovering, booking, and managing adventure experiences across Nepal.

This repository is the private product version of ConnectNepal, separated from the original academic/FYP repositories. It contains both the backend and frontend in one production-oriented monorepo.

## Repository Structure

- `backend/` — Django REST API, Celery, WebSockets, recommendations, chatbot, payments
- `frontend/` — React/Vite frontend application
- `infra/` — Docker, reverse proxy, deployment, and production configuration
- `docs/` — Product, deployment, and technical documentation

## Applications

### Backend

The backend is a Django REST platform with PostgreSQL/pgvector, Redis, Celery, WebSocket notifications, eSewa payments, recommendations, and optional Ollama chatbot support.

See `backend/README.md`.

### Frontend

The frontend is a React/Vite application for travellers, hosts, and admins. It includes discovery, booking, payments, trip planning, complaints, reviews, notifications, dashboards, and chatbot UI.

See `frontend/README.md`.

## Main Runtime Services

A full production-style deployment uses:

- Django ASGI backend
- React frontend
- PostgreSQL with pgvector
- Redis
- Celery worker
- Celery beat
- WebSocket support
- Optional Ollama service for chatbot and FAQ retrieval

## Status

This repository is being prepared for Dockerized production deployment and future client-ready usage.