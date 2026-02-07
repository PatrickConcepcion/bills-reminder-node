# Project Overview

This backend is a TypeScript + Express API for a bill reminder system. It supports user authentication and bill management (create, list, update, pay, and delete), with MySQL persistence via TypeORM.

# Installation & Setup Instructions

1. Install dependencies:

```bash
npm install
```

2. Create environment variables from the example file:

```bash
cp .env.example .env
```

Important: update `JWT_SECRET` in `.env` (default is `changeme`) to a strong, unique secret before running the app.

3. Ensure MySQL is running.

- Option A (Docker):

```bash
docker compose up -d
```

- Option B: use a local MySQL instance and match the values in `.env`.

4. Run database migrations:

```bash
npm run migration:run
```

5. Start the backend in development mode:

```bash
npm run dev
```

The API starts on `http://localhost:3000` by default, and health check is available at `GET /health`.

# Tech Stack Used

- Runtime and language: Node.js, TypeScript
- HTTP framework: Express
- Database and ORM: MySQL, TypeORM
- Authentication: JWT, HttpOnly cookies, refresh tokens
- Validation: Zod
- Testing: Jest (with mocked repositories for service tests)

# Security and Testing Approach

## Security Approach

- Passwords are hashed using `bcrypt` before storage.
- Access tokens are JWT-based and validated in auth middleware.
- Refresh tokens are generated with cryptographic randomness, stored as SHA-256 hashes, rotated on refresh, and revoked by token family when reuse is detected.
- Auth tokens are handled via HttpOnly cookies to reduce JavaScript access.
- Request validation is enforced with Zod schemas at controller boundaries.
- Error handling is centralized to return consistent API error payloads.
- CORS is configured with an allowlist (`FRONTEND_URL`) and credentials enabled for cookie-based auth.

Note: cookie `secure` is currently set for local development behavior. For production over HTTPS, set cookie `secure` to `true`.

## Testing Approach

- Unit tests are written with Jest and run via:

```bash
npm test
```

- Current coverage focuses on:
  - Auth service behavior (registration, credential validation, refresh token rotation and revocation paths)
  - Bills service behavior (CRUD flows, payment handling, recurring bill next-cycle creation)
  - Zod schema validation rules for bill payloads

- Service tests mock repositories and external libraries (`bcrypt`, `jsonwebtoken`) to isolate business logic and keep tests deterministic.
