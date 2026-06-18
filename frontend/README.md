# ConnectNepal Frontend — Adventure Discovery, Booking & Trip Planning UI

The React frontend for **ConnectNepal**, a community-based tourism platform for discovering, planning, booking, and managing adventure experiences across Nepal. Travellers can browse listings and packages, build itineraries, complete bookings, review experiences, raise complaints, and receive real-time notifications. Hosts and admins get dedicated dashboards for managing listings, packages, bookings, reviews, complaints, and platform workflows.

![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![Vite](https://img.shields.io/badge/Vite-7-purple)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-38bdf8)
![Tests](https://img.shields.io/badge/Tests-112%20passing-brightgreen)
![Playwright](https://img.shields.io/badge/E2E-Playwright-green)

---

## Features

### Traveller Experience
- **Public discovery** — Browse public listings and host packages with filters, search, pagination, package tabs, and recommendation sections.
- **Booking flow** — Slot-based checkout, booking summary, payment handoff, payment success/failure/processing pages, and booking detail views.
- **Trip Planner** — Create multi-day trip plans, add listings to specific days, move/edit/remove itinerary items, archive trip plans, and book from a trip plan.
- **Reviews** — View personal reviews, create/edit/delete eligible reviews, view host replies, and report inappropriate replies.
- **Complaints** — File complaints against bookings, upload evidence, track complaint timelines, and respond to received complaints.
- **Notifications & Chat** — In-app notification bell, notification history, real-time notification socket, and chatbot/chat history UI.

### Host Experience
- **Dashboard** — Host analytics cards, booking/revenue trends, category breakdowns, and recent activity.
- **Listings** — Create/edit listings, upload media, manage schedules, slots, exceptions, and listing availability.
- **Packages** — Create/edit package deals, select package listings through searchable selection, manage package schedules, slots, exceptions, and cover images.
- **Bookings** — View booking items, inspect booking snapshots, mark confirmed bookings as completed, and access traveller context.
- **Reviews & Complaints** — Reply to reviews, report reviews, view received/filed complaints, respond to complaints, and upload evidence.

### Admin Experience
- **Admin dashboards** — Platform overview, users, host verification, bookings, complaints, and review moderation.
- **Moderation workflows** — Verify hosts, moderate review reports and host replies, manage complaint outcomes, and cancel bookings where allowed.
- **Reusable UI** — Shared tables, badges, modals, confirmation dialogs, filters, loaders, and status components.

---

## Tech Stack

| Category | Technology |
|---|---|
| Framework | React 19 |
| Language | TypeScript 5.9 |
| Build Tool | Vite 7 |
| Styling | Tailwind CSS 4 |
| Routing | React Router 7 |
| Forms | React Hook Form + Yup |
| API Client | Axios with request/response case transformation |
| Charts | Recharts |
| Icons | Lucide React |
| Dates | date-fns |
| Testing | Vitest, React Testing Library, MSW |
| E2E / Smoke | Playwright |
| Notifications | react-hot-toast + WebSocket integration |

---

## Architecture

```
┌──────────────────────────────────────────────┐
│              Route Layer                      │
│  AppRoutes, PrivateRoutes, RoleRoutes         │
├──────────────────────────────────────────────┤
│              Page Layer                       │
│  Public, Traveller, Host, Admin pages         │
├──────────────────────────────────────────────┤
│              Component Layer                  │
│  Feature components + shared UI primitives    │
├──────────────────────────────────────────────┤
│              State / Context                  │
│  Auth, theme, notifications, confirmation     │
├──────────────────────────────────────────────┤
│              Service Layer                    │
│  Axios API modules per backend domain         │
├──────────────────────────────────────────────┤
│              Types / Validators               │
│  API contracts, form schemas, helpers         │
└──────────────────────────────────────────────┘
```

**Key frontend patterns**
- **Domain services** — API calls live in `src/services/*.service.ts`, not directly in pages.
- **Typed API contracts** — DTOs and UI-facing models live in `src/types/`.
- **Form validation** — Yup schemas live under `src/utils/validators/`.
- **Role-aware routing** — `PrivateRoutes` and `RoleRoutes` enforce auth, onboarding, and role access.
- **Case conversion** — Axios interceptors convert frontend camelCase to backend snake_case and back.
- **Media URL resolution** — Shared helpers resolve backend-relative media paths before rendering images or file links.
- **Component reuse** — Listing cards, booking badges, slot managers, review modals, complaint views, and trip planner widgets are shared across pages.

---

## Project Structure

```
fyp_frontend/
├── public/                         # Static assets served by Vite
├── src/
│   ├── assets/                     # Bundled assets
│   ├── components/                 # Shared and feature components
│   │   ├── bookings/               # Booking status, summaries, calendars
│   │   ├── chatbot/                # Chat widget and messages
│   │   ├── complaints/             # Complaint forms, detail pages, evidence UI
│   │   ├── dashboard/              # Analytics cards/charts
│   │   ├── form/                   # Inputs, dropdowns, uploads, toggles
│   │   ├── host-listings/          # Host listing forms/tables/media
│   │   ├── listings/               # Public listing cards, galleries, recommendations
│   │   ├── notifications/          # Notification bell and list items
│   │   ├── packages/               # Package cards, forms, slots, booking sidebar
│   │   ├── reviews/                # Review cards, modals, moderation UI
│   │   ├── slots/                  # Slot/schedule/exception managers
│   │   └── trip-planner/           # Trip plans, journey timeline, add-to-trip flow
│   ├── config/                     # Navbar/sidebar configuration
│   ├── constants/                  # Routes, roles, pagination, options
│   ├── context/                    # Auth, theme, notifications, confirmation
│   ├── hooks/                      # Reusable hooks
│   ├── layouts/                    # Dashboard/auth/onboarding layouts
│   ├── pages/                      # Route-level pages
│   │   ├── admin/
│   │   ├── auth/
│   │   ├── host/
│   │   ├── payment/
│   │   ├── public/
│   │   └── traveller/
│   ├── routes/                     # App route definitions and guards
│   ├── services/                   # API clients grouped by domain
│   ├── tests/                      # Unit/integration tests and MSW setup
│   ├── types/                      # API and domain TypeScript types
│   └── utils/                      # Formatting, routing, media, validators
├── docs/                           # Frontend guides and API notes
├── e2e/                            # Playwright tests
├── index.html
├── package.json
├── vite.config.ts
├── vitest.config.ts
└── playwright.config.ts
```

---

## Prerequisites

- Node.js 20+ recommended
- npm 10+ recommended
- ConnectNepal backend running locally or remotely

The backend should expose the API base URL used by `VITE_API_URL`, for example:

```text
http://localhost:8000/api
```

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Girish-Raj-Thapa/connectnepal-frontend.git
cd fyp_frontend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
VITE_API_URL=http://localhost:8000/api
```

`VITE_API_URL` is used for:
- Axios API requests
- WebSocket notification URL construction
- resolving backend-relative media URLs such as `/media/...`

### 4. Start the development server

```bash
npm run dev
```

The app is served by Vite, typically at:

```text
http://localhost:5173
```

---

## Available Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and create a production build |
| `npm run preview` | Preview the production build locally |
| `npm run type-check` | Run TypeScript project checks without emitting files |
| `npm run lint` | Run ESLint using the development config |
| `npm run lint:ci` | Run ESLint using the CI config |
| `npm run test` | Run the Vitest test suite |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:coverage` | Run Vitest with coverage |
| `npm run test:e2e` | Run Playwright system tests |
| `npm run test:smoke` | Run Playwright smoke tests |

---

## Backend Integration

The frontend expects the backend to provide:

- JWT auth with access tokens and refresh cookies
- Role-based APIs for traveller, host, and admin users
- WebSocket notification support
- Media/file URLs, sometimes relative to the backend origin
- Paginated list responses in the standard shape:

```ts
type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};
```

### API client behavior

The shared Axios client in `src/services/api.service.ts`:
- injects the current access token
- refreshes expired tokens through the auth context
- transforms request bodies from camelCase to snake_case
- transforms response bodies from snake_case to camelCase
- normalizes error payload keys where possible

Query params are passed explicitly in snake_case where required because the request interceptor only transforms request bodies.

---

## Usage Flows

### Traveller Flow

1. Register/login and complete onboarding
2. Browse listings or packages
3. Pick an available slot/departure
4. Create a booking and complete eSewa payment
5. Track booking status from My Bookings
6. Review completed experiences
7. Build trip plans and add listings to itinerary days
8. Raise complaints and upload evidence when needed

### Host Flow

1. Register as host and complete onboarding
2. Upload verification documents
3. Create listings and upload media
4. Configure slots, schedules, and exceptions
5. Create packages from existing listings
6. Manage package departures
7. Track bookings and mark confirmed bookings completed
8. Reply to reviews and handle complaints

### Admin Flow

1. Review host verification requests
2. Moderate review reports and host replies
3. Track and resolve complaints
4. Monitor users, bookings, and platform activity

---

## Testing

The frontend test suite uses Vitest, React Testing Library, MSW, and Playwright.

### Run all unit and integration tests

```bash
npm run test
```

### Run one test file

```bash
npx vitest run src/tests/integration/pages/trips/TripPlannerDetail.test.tsx
```

### Run type checks

```bash
npm run type-check
```

### Run lint

```bash
npm run lint
```

### Run Playwright smoke tests

```bash
npm run test:smoke
```

### Run Playwright system tests

```bash
npm run test:e2e
```

Test support files live in:

```text
src/tests/
├── integration/
├── unit/
├── msw/
├── setup.ts
└── test-utils.tsx
```

Manual UI test checklists live in `docs/UI_TESTS/`.

---

## Demo Accounts

Use the backend seed commands to create deterministic accounts. Common local demo users:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@connectnepal.com` | `Hello@123` |
| Traveller | `traveller@connectnepal.com` | `Hello@123` |
| Host | `host@connectnepal.com` | `Hello@123` |

The exact available demo data depends on the backend seed commands used.

---

## User Roles

| Role | Frontend Capabilities |
|---|---|
| **Traveller** | Browse listings/packages, book experiences, pay, review, plan trips, file complaints |
| **Host** | Manage listings/packages/slots/bookings, reply to reviews, handle complaints |
| **Admin** | Verify hosts, moderate reviews, resolve complaints, manage platform data |

---

## Contributing

1. Create a feature branch
2. Keep API calls inside `src/services/`
3. Add or update types in `src/types/`
4. Validate forms with schemas in `src/utils/validators/`
5. Prefer reusable components over page-specific duplication
6. Run checks before committing:

```bash
npm run type-check
npm run lint
npm run test
```

**Code conventions**
- Frontend models use camelCase.
- API params that are not request bodies should be sent in backend-expected snake_case.
- Do not render raw backend media paths directly; use media URL helpers for `/media/...` paths.
- Keep role-specific logic in route guards or page-level orchestration, not low-level UI components.
- Prefer concise, typed service methods over ad-hoc Axios calls in components.

---

## Related Documentation

Useful frontend docs:

| Topic | File |
|---|---|
| Architecture | `docs/ARCHITECTURE.md` |
| Modularization | `docs/MODULARIZATION_GUIDE.md` |
| Testing | `docs/tests_guide.md` |
| Public listings | `docs/public_listings_guide.md` |
| Bookings | `docs/booking_feature_guide.md` |
| Payments | `docs/payment_guide.md` |
| Trip planner | `docs/TRIP_PLANNER_PAGES_GUIDE.md` |
| Reviews | `docs/REVIEWS_FRONTEND_GUIDE.md` |
| Complaints | `docs/complaints_guide.md` |
| Packages | `docs/packages_guide.md` |
| Notifications | `docs/notifications_frontend_manual_implementation.md` |

---

## Acknowledgments

- [React](https://react.dev/) — UI library
- [Vite](https://vite.dev/) — Frontend tooling
- [Tailwind CSS](https://tailwindcss.com/) — Styling
- [React Router](https://reactrouter.com/) — Routing
- [React Hook Form](https://react-hook-form.com/) — Form management
- [Vitest](https://vitest.dev/) — Unit and integration testing
- [Playwright](https://playwright.dev/) — Browser automation
- [Lucide](https://lucide.dev/) — Icons

---

## Contact

**Girish Raj Thapa**

GitHub: [@Girish-Raj-Thapa](https://github.com/Girish-Raj-Thapa)

---

*Built as a Final Year Project — Community-Based Adventure Discovery & Tourism Booking Platform*
