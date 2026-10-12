# Bookkeeping App

This project is a web application designed for managing financial records. It allows users to track income and expenses, categorize transactions, and view financial summaries. Key features include user authentication for secure access, the ability to create, read, update, and delete financial records, and potential data visualization to help users understand their financial health.

## Features

- **User Authentication**: Secure login and registration functionalities powered by NextAuth.js, with support for OAuth providers (e.g., Google) to ensure safe access to your financial data.
- **Transaction Management**:
    - Comprehensive CRUD (Create, Read, Update, Delete) operations for managing income and expense records.
    - Ability to categorize transactions for better financial organization and tracking.
- **Data Visualization**:
    - Interactive charts and graphs (via ECharts) to display financial summaries, such as income vs. expenses, spending habits by category, and financial trends over time.
    - Visual insights to help users understand their financial health at a glance.
- **Responsive Design**: A fully responsive user interface that adapts seamlessly to various screen sizes, ensuring a consistent experience on desktops, tablets, and mobile devices.
- **Dark Mode**: A user-selectable dark mode option for improved visual comfort in low-light environments, built using `next-themes`.

## Getting Started

This is a two-app monorepo: `apps/frontend` (Next.js, pnpm) and `apps/backend` (FastAPI, uv). They are **fully independent projects** — no shared workspace tooling ties them together, so each has its own dependency install step.

### Prerequisites

- [Node.js](https://nodejs.org/) 18.x+ and [pnpm](https://pnpm.io/) (`corepack enable && corepack prepare pnpm@9 --activate` if you don't have it)
- [Python](https://www.python.org/) 3.12+ and [uv](https://docs.astral.sh/uv/)
- [Docker](https://www.docker.com/) (for `docker compose`, used for local Postgres and/or the full backend stack)

### 1. Clone the Repository

```bash
git clone <repository-url>
cd <repository-name>
```

### 2. Install Dependencies

Each project installs its own dependencies:

```bash
pnpm install                      # root: just `concurrently`, for `pnpm run dev`
pnpm --dir apps/frontend install  # frontend's real dependencies
cd apps/backend && uv sync        # backend's dependencies (creates apps/backend/.venv)
```

### 3. Environment Variables

Two separate env files, one per app — see `apps/frontend/.env.example` and `apps/backend/.env.example` for the full list. Copy each to `.env.development.local` / `.env` and fill in real values.

Key things to keep in sync between the two:
- Frontend's `BACKEND_JWT_SECRET` must equal backend's `JWT_SECRET`.
- Frontend's `INTERNAL_API_SECRET` must equal backend's `INTERNAL_API_SECRET`.
- Frontend's `NEXT_PUBLIC_API_URL` must point at wherever the backend is actually listening (`https://localhost:4000` for local dev).

`NEXTAUTH_SECRET`/`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (frontend) and `DATABASE_URL` (backend) are unrelated to the two shared secrets above.

### 4. Database Setup

The backend owns the database — the frontend never talks to Postgres directly. The schema lives in `apps/backend/app/schema.sql` (`CREATE TABLE IF NOT EXISTS`) and is applied automatically every time the backend starts, so there is no separate migration step.

- Start Postgres with `docker compose up -d postgres`.
- There is no migration tool: to change the schema, edit `schema.sql` for fresh databases, and for existing ones either add an idempotent `ALTER TABLE` to the end of `schema.sql` (as done for `records.category_id`) or apply it by hand.

### 5. Running the Development Server

From the repo root, `pnpm run dev` starts both apps concurrently (frontend on `https://localhost:3000`, backend on `https://localhost:4000` via uvicorn with `--reload`) — make sure Postgres is reachable first (`docker compose up -d postgres` is the easiest way).

```bash
pnpm run dev            # both apps
pnpm run dev:frontend   # frontend only
pnpm run dev:backend    # backend only
```

Alternatively, `docker compose up` runs Postgres + the backend as containers (frontend still runs on the host via `pnpm run dev:frontend`).

The backend serves interactive API docs at `https://localhost:4000/docs`.

## Tech Stack

- **Frontend:** [Next.js](https://nextjs.org/) (App Router), [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS](https://tailwindcss.com/), [NextAuth.js](https://next-auth.js.org/) (Google OAuth), [Zustand](https://zustand-demo.pmnd.rs/), [Radix UI](https://www.radix-ui.com/), [ECharts](https://echarts.apache.org/), managed with [pnpm](https://pnpm.io/).
- **Backend:** [FastAPI](https://fastapi.tiangolo.com/) with raw SQL via [psycopg 3](https://www.psycopg.org/psycopg3/) (async connection pool) against Postgres, `PyJWT` for verifying the frontend-issued JWT, `uvicorn` as the server (dev and prod alike), managed with [uv](https://docs.astral.sh/uv/).
- **Auth bridge:** NextAuth issues a short-lived JWT (`session.apiToken`) that the frontend sends as `Authorization: Bearer` on every backend call; the backend verifies it independently. A separate shared secret (`INTERNAL_API_SECRET`) guards the one pre-login bootstrap endpoint.

## Project Structure

```
apps/
  frontend/            Next.js app (pnpm project) — UI + NextAuth only, no DB access
    src/app/            routes, pages, layout; src/app/api/auth is the only remaining API route (NextAuth)
    src/components/     shared UI components
    src/lib/            utilities
  backend/              FastAPI app (uv project) — all DB access and business logic
    app/main.py         app, lifespan (connection pool + schema), CORS, routers
    app/routers/        HTTP endpoints
    app/services.py     all SQL
    app/auth.py         JWT and internal-secret dependencies
    app/schema.sql      table definitions, applied on startup
    tests/              pytest + TestClient against a real Postgres
    Dockerfile
docker-compose.yml      postgres + backend, for local Docker-based dev
package.json            root: orchestration only (`concurrently`), not a workspace root
```

See [docs/plans/frontend-backend-split.md](docs/plans/frontend-backend-split.md) for the full design rationale behind this split.

## Contributing

We welcome contributions to the Bookkeeping App! Whether you're fixing a bug, adding a new feature, or improving documentation, your help is appreciated.

### Reporting Issues

If you encounter a bug or have a feature suggestion, please report it using [GitHub Issues](<link-to-github-issues>). Provide as much detail as possible, including steps to reproduce the bug or a clear description of the suggested feature.

### Pull Request Process

1.  **Fork the repository**: Start by forking the main repository to your GitHub account.
2.  **Create a branch**: For new features, use `git checkout -b feature/your-feature-name`. For bug fixes, use `git checkout -b bugfix/issue-number`.
3.  **Make your changes**: Implement your feature or bug fix.
4.  **Lint your code**: Ensure your code adheres to the project's linting standards by running:
    ```bash
    pnpm run lint
    ```
    Please fix any linting errors or warnings before committing.
5.  **Commit your changes**: Write clear, concise, and descriptive commit messages.
6.  **Push your branch**: Push your changes to your forked repository.
7.  **Open a Pull Request**: Create a pull request from your branch to the `main` branch of the original repository. Provide a clear description of the changes in your PR.

### Code Style

This project uses ESLint for code linting and formatting. The rules are defined in the project's ESLint configuration. Please ensure your contributions conform to these rules, as checked by the `pnpm run lint` command.

### Setting up a Development Environment

For instructions on how to set up your local development environment, please refer to the [Getting Started](#getting-started) section.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deployment

Frontend and backend deploy separately.

### Frontend: Vercel

The frontend deploys to [Vercel](https://vercel.com/) same as before, with one required change: set the project's **Root Directory** to `apps/frontend` in Settings → General (the app no longer lives at the repo root). Configure `apps/frontend/.env.example`'s variables as Vercel environment variables, with `NEXT_PUBLIC_API_URL` pointing at wherever the backend is deployed.

### Backend: any Docker host

The backend is a standard Docker container (`apps/backend/Dockerfile`) — deploy it to any host that can run one. A free option that works with zero changes to the Dockerfile:
- **[Render](https://render.com/)** (free web service, deploy directly from `apps/backend/Dockerfile`) + **[Neon](https://neon.tech/)** or **[Supabase](https://supabase.com/)** (free Postgres — Render's own free Postgres is deleted after 90 days, so point `DATABASE_URL` at one of these instead). Render's free tier sleeps when idle, with a few seconds of cold start on wake.

Set the backend's environment variables (`DATABASE_URL`, `JWT_SECRET`, `INTERNAL_API_SECRET`, `FRONTEND_URL`) to match what the frontend expects, then point the frontend's `NEXT_PUBLIC_API_URL` at the deployed backend's URL.

## License

This project is licensed under the MIT License.

It is recommended to create a `LICENSE` file in the root of the project containing the full text of the MIT License.
