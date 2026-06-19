# ConnectNepal Documentation

This directory is the authoritative documentation root for the ConnectNepal monorepo.

The current drafts are based on repository inspection performed against the code in:

- `backend/`
- `frontend/`
- `docs/`
- `infra/`

These documents intentionally separate:

- what is present in code
- what is implied by code
- what is missing and still needs implementation

They do not assume infrastructure or architecture that is not present in the repository.

## Current Documents

- [System Overview](./system-overview.md)
- [Repository Structure](./repository-structure.md)
- [Architecture](./architecture.md)
- [Production Readiness](./production-readiness.md)

### Backend

- [Backend Architecture](./backend/backend-architecture.md)
- [Backend Apps Overview](./backend/apps-overview.md)
- [Settings and Environment](./backend/settings-and-environment.md)
- [Security Review](./backend/security.md)

### Deployment

- [Docker Info](../infra/docker-info.md)
- [Docker Optimization Notes](../infra/docker-optimize.md)
- [Docker Runtime Notes](../infra/docker.md)
- [Docker Deep Details](../infra/docker_details.md)
- [Dockerization Blueprint](../infra/dockerization_blueprint.md)
- [Environment Variables](./deployment/environment-variables.md)

## Documentation Status

This documentation set is a draft baseline, not a final operations manual.

High-confidence sections are based directly on repository code. Lower-confidence areas are explicitly marked as:

- not verified at runtime
- not present in code
- unclear from current repository state

## Maintenance Guidance

- Update these files whenever runtime entrypoints, settings, auth flows, payment flows, queues, or deployment topology change.
- Prefer extending this root `docs/` tree rather than adding duplicate docs under app-specific folders unless there is a strong reason.
- Treat `README.md` files as entrypoints and summaries, not the only source of architecture truth.
