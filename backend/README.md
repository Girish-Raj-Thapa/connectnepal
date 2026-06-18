# ConnectNepal — Community-Based Adventure Discovery & Tourism Booking Platform

Your gateway to the Himalayas. ConnectNepal is a full-featured tourism platform built to make Nepal's adventures discoverable and bookable. From sunrise treks above the clouds to riverside rafting and ancient cultural walks — travellers find, plan, and pay for experiences while local hosts manage their offerings, bookings, and revenue from a single platform.

![Python](https://img.shields.io/badge/Python-3.10-blue)
![Django](https://img.shields.io/badge/Django-4.2-green)
![DRF](https://img.shields.io/badge/DRF-3.14-red)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-blue)
![Redis](https://img.shields.io/badge/Redis-Celery-orange)
![Tests](https://img.shields.io/badge/Tests-353%20passing-brightgreen)
![Coverage](https://img.shields.io/badge/Coverage-73%25-yellowgreen)

---

## Features

### Core Booking Flow
- **Listings** — Hosts create activity listings (treks, city tours, cultural experiences) with slot-based inventory — one departure date per slot with its own capacity
- **Bookings** — Slot-based booking with a 15-minute payment hold, automatic expiry, pricing engine that handles HOURLY / FULL_DAY / MULTI_DAY durations
- **Payments** — eSewa integration with HMAC signature verification, idempotent callback processing, and automated reconciliation for edge cases

### User Features
- **Accounts** — Email/password registration with activation, JWT auth (access token + refresh cookie), role-based access control (Traveller / Host / Admin), full onboarding flows
- **Reviews** — Eligibility-gated reviews (requires a completed booking), host replies, automatic listing rating recalculation on save
- **Trip Planner** — Travellers build multi-day itineraries by adding listings to a plan; automatic item removal and notification when a listing is deleted by the host
- **Packages** — Hosts bundle multiple activities into package deals with their own approval and slot management workflow
- **Complaints** — Travellers raise complaints against bookings; admin resolution workflow with status tracking

### Platform Features
- **Recommendations** — scikit-learn and pgvector powered recommendation engine for personalised listing suggestions
- **Notifications** — Real-time in-app notifications delivered over WebSocket (Django Channels) and stored in the database
- **Analytics** — Host dashboard analytics: booking trends, revenue breakdowns, and slot occupancy rates
- **Chatbot** — AI-powered travel assistant via a local Ollama LLM instance
- **Admin Approval Workflows** — Listings and packages require admin approval before going live; hosts notified on approval or rejection

---

## Tech Stack

| Category | Technology |
|---|---|
| Framework | Django 4.2, Django REST Framework 3.14 |
| Language | Python 3.10 |
| Database | PostgreSQL with pgvector extension |
| Cache / Broker | Redis |
| Background Tasks | Celery + Celery Beat |
| Real-time | Django Channels (WebSocket over Redis) |
| Authentication | JWT via `djangorestframework-simplejwt` |
| Payment Gateway | eSewa (HMAC-SHA256 signature) |
| AI Chatbot | Ollama (local LLM) |
| Recommendations | scikit-learn, pgvector, pandas |
| API Docs | drf-spectacular (OpenAPI / Swagger) |
| Image Processing | Pillow |
| Testing | Django TestCase, factory_boy, coverage, freezegun |

---

## Architecture

```
┌──────────────────────────────────────────────┐
│               API Layer                       │
│  DRF Views, Serializers, URL Routing          │
├──────────────────────────────────────────────┤
│               Service Layer                   │
│  Business Logic (booking_service,             │
│  payment_service, listing_service, etc.)      │
├──────────────────────────────────────────────┤
│               Model Layer                     │
│  Django ORM Models + Signals                  │
├──────────────────────────────────────────────┤
│               Infrastructure                  │
│  PostgreSQL  |  Redis  |  Celery  |  Channels │
└──────────────────────────────────────────────┘
```

**Key Design Patterns**
- **Service Layer** — all business logic lives in `services.py` files, views are thin
- **Role-Based Permissions** — custom `IsTraveller`, `IsHost`, `IsAdmin` permission classes
- **Idempotent Events** — `ProcessedPaymentEvent` unique constraint prevents duplicate payment processing
- **Soft Delete** — listings and bookings use soft delete to preserve history
- **Availability Holds** — slot capacity is locked for 15 minutes during the payment window

---

## Project Structure

```
fyp_backend/
├── connectnepal/              # Django project config
│   ├── settings/
│   │   ├── base.py            # Shared settings
│   │   ├── dev.py             # Development overrides
│   │   └── prod.py            # Production overrides
│   ├── celery.py              # Celery app config
│   ├── urls.py                # Root URL configuration
│   ├── asgi.py                # ASGI entry point (WebSocket)
│   └── wsgi.py                # WSGI entry point
├── accounts/                  # Auth, JWT, onboarding, user profiles
├── listings/                  # Listings, activity slots, categories
├── bookings/                  # Bookings, items, holds, pricing, expiry
├── payments/                  # eSewa service, payment attempts, reconciliation
├── reviews/                   # Reviews, host replies, rating signals
├── trip_planner/              # Trip plans, itinerary items
├── packages/                  # Host packages and package slots
├── complaints/                # Complaint filing and admin resolution
├── recommendations/           # ML-based recommendation engine
├── notifications/             # In-app notifications, WebSocket consumers
├── analytics/                 # Host and admin analytics services
├── chatbot/                   # AI travel assistant
├── utils/                     # Shared exceptions, permissions, validators
├── tests/
│   └── factories.py           # Shared factory_boy model factories
├── docs/                      # Developer guides and API references
├── manage.py
└── requirements.txt
```

---

## Prerequisites

- Python 3.10
- PostgreSQL with the `pgvector` extension enabled
- Redis
- (Optional) Ollama running locally for the chatbot feature

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Girish-Raj-Thapa/connectnepal-backend.git
cd fyp_backend
```

### 2. Create and activate a virtual environment

```bash
python3.10 -m venv venv
source venv/bin/activate       # macOS / Linux
venv\Scripts\activate          # Windows
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment variables

Create a `.env` file in the project root:

```env
SECRET_KEY=your-django-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database
DB_NAME=connectnepal
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_HOST=localhost
DB_PORT=5432

# Redis
CELERY_BROKER_URL=redis://localhost:6379/0
REDIS_RECOMMENDATIONS_URL=redis://localhost:6379/1
REDIS_DASHBOARDS_URL=redis://localhost:6379/2
REDIS_HOST=localhost

# JWT
JWT_ACCESS_TOKEN_LIFETIME_MINUTES=60
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7

# eSewa
ESEWA_PRODUCT_CODE=EPAYTEST
ESEWA_SECRET_KEY=your-esewa-secret-key
ESEWA_VERIFY_URL=https://rc-epay.esewa.com.np/api/epay/transaction/status/

# URLs
FRONTEND_URL=http://localhost:3000
BACKEND_BASE_URL=http://localhost:8000

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=ConnectNepal <your-email@gmail.com>
```

### 5. Enable pgvector in PostgreSQL

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 6. Apply migrations and create a superuser

```bash
python manage.py migrate
python manage.py createsuperuser
```

### 7. Start the development server

```bash
python manage.py runserver
```

---

## Running Background Services

Celery and Channels must run alongside the Django server for the full feature set.

### Celery worker (background tasks)

```bash
celery -A connectnepal worker --loglevel=info
```

### Celery Beat (scheduled tasks — booking expiry, etc.)

```bash
celery -A connectnepal beat --loglevel=info --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

### ASGI server (WebSocket / real-time notifications)

```bash
uvicorn connectnepal.asgi:application --reload
```

---

## API Documentation

Interactive API docs are available when the server is running:

| Interface | URL |
|---|---|
| Swagger UI | `http://localhost:8000/api/schema/swagger-ui/` |
| ReDoc | `http://localhost:8000/api/schema/redoc/` |
| OpenAPI Schema | `http://localhost:8000/api/schema/` |

Detailed API guides for each module are in the `docs/APIs/` directory.

---

## Usage

### Booking Flow (Traveller)

1. Browse listings — `GET /api/listings/`
2. Check available slots — `GET /api/listings/<id>/slots/`
3. Get a price quote — `POST /api/bookings/quote/`
4. Create a booking — `POST /api/bookings/` — returns a 15-minute payment hold
5. Initiate eSewa payment — `POST /api/payments/esewa/initiate/`
6. eSewa redirects back — callback processed automatically, booking confirmed

### Host Listing Flow

1. Register and complete host onboarding (business info + verification docs)
2. Wait for admin approval of host account
3. Create a listing — `POST /api/listings/host/`
4. Add departure slots — `POST /api/listings/<id>/slots/`
5. Listing goes live after admin approval

### Trip Planner Flow

1. Create a trip plan — `POST /api/trip-planner/`
2. Add listings to days — `POST /api/trip-planner/<id>/items/`
3. View full itinerary — `GET /api/trip-planner/<id>/`
4. Remove items or update plan details as needed

---

## Testing

The project has **353 automated tests** across all core apps covering happy paths, negative paths, business rule enforcement, state transitions, and side effects.

### Run the full test suite

```bash
python manage.py test accounts.tests bookings.tests listings.tests reviews.tests payments.tests trip_planner.tests packages.tests complaints.tests
```

### Run a specific app

```bash
python manage.py test bookings.tests
```

### Run a specific test class

```bash
python manage.py test bookings.tests.BookingCapacityTests
```

### Run with coverage

```bash
coverage run --source='.' manage.py test accounts.tests bookings.tests listings.tests reviews.tests payments.tests trip_planner.tests packages.tests complaints.tests
coverage report
```

### Generate HTML coverage report

```bash
coverage html
open htmlcov/index.html
```

See `docs/backend_testing.md` for full details on the test suite, factories, mocking strategy, and per-app class breakdown.

---

## Demo Data Seeding

Deterministic demo accounts for development and frontend testing:

| Role | Email | Password |
|---|---|---|
| Superuser | `super@connectnepal.com` | `Hello@123` |
| Admin | `admin@connectnepal.com` | `Hello@123` |
| Traveller | `traveller@connectnepal.com` | `Hello@123` |
| Host | `host@connectnepal.com` | `Hello@123` |

```bash
# Create demo users
python manage.py seed_demo_users

# Create demo users + approve host + generate verification docs
python manage.py seed_demo_users --approve-host --with-docs

# Seed listings and bookings data
python manage.py seed_demo_data

# Reset demo users to defaults
python manage.py reset_demo_users --yes
```

Override default passwords via env vars: `SEED_SUPER_PASSWORD`, `SEED_ADMIN_PASSWORD`, `SEED_TRAVELLER_PASSWORD`, `SEED_HOST_PASSWORD`.

---

## User Roles

| Role | Capabilities |
|---|---|
| **Traveller** | Browse listings, make bookings, write reviews, build trip plans, raise complaints |
| **Host** | Create listings and packages, manage slots, view booking dashboard, reply to reviews |
| **Admin** | Approve/reject listings and packages, manage complaints, view platform analytics |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Write tests for your changes
4. Commit with a clear message (`git commit -m 'feat: add your feature'`)
5. Push to the branch (`git push origin feature/your-feature`)
6. Open a Pull Request

**Code conventions:**
- Business logic goes in `services.py`, not in views or serializers
- Views should only handle request/response — no DB queries directly in views
- Custom exceptions from `utils/exceptions.py` (`ServiceError`, `ValidationError`)
- All new endpoints require a corresponding test in the app's `tests.py`

---

## Acknowledgments

- [Django REST Framework](https://www.django-rest-framework.org/) — API framework
- [eSewa](https://esewa.com.np/) — Payment gateway
- [Django Channels](https://channels.readthedocs.io/) — WebSocket support
- [factory_boy](https://factoryboy.readthedocs.io/) — Test data factories
- [drf-spectacular](https://drf-spectacular.readthedocs.io/) — OpenAPI schema generation
- [pgvector](https://github.com/pgvector/pgvector) — Vector similarity search for recommendations

---

## Contact

**Girish Raj Thapa**

GitHub: [@Girish-Raj-Thapa](https://github.com/Girish-Raj-Thapa)

---

*Built as a Final Year Project — Community-Based Adventure Discovery & Tourism Booking Platform*
