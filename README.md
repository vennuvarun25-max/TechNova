# TechNova

TechNova is a team-based technology competition platform. Organizers manage teams, day-wise rounds, tests, resources, verification, scoring, and event information. Teams use a dashboard to follow the event, submit task completion for review, access released materials, manage candidate profile links, and track their standing.

## Contents

- [Capabilities](#capabilities)
- [Requirements](#requirements)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [Production deployment](#production-deployment)
- [Uploads and persistence](#uploads-and-persistence)
- [Testing](#testing)
- [Project layout](#project-layout)
- [Operational notes](#operational-notes)

## Capabilities

### Admin

- Create and manage teams with three candidates assigned the identity roles **VISION LEAD**, **CODE ARCHITECT**, and **INNOVATION STRATEGIST**.
- Create, edit, order, lock, and delete rounds grouped by day; add tasks and round resources.
- Mark a day complete. Completed days remain closed to tests; released round resources are available from Central Resources.
- Upload Test Resources and Shared Resources to the Central Resources library. Test Resources can be locked or released; Shared Resources are available as configured.
- Review task submissions, verify work, award or adjust XP, and unverify a task to remove its completion/XP and allow a new submission.
- Open or close Tests and Resources for selected teams and optionally close Tests when the competition timer ends.
- Configure the competition timer, award profile-link XP, manage projects, and view team progress and the leaderboard.
- Edit the About page, including its cover image, exactly two TechNova leads, and two or three TechNova co-leads. Each person can have a portrait and bio.

### Team dashboard

- View the team dashboard, candidate roster, role labels, Nova rank, team XP, and event timer.
- Add and edit candidate LinkedIn, GitHub, LeetCode, and Kaggle profile links from the dashboard.
- View day-wise rounds and open available tests and resources.
- Mark tasks done for admin review. A task is not awarded XP until verified; an admin unverify reopens it for another attempt.
- Open released Test Resources and Shared Resources from Central Resources.
- View projects, team progress, and the leaderboard. Teams see completed projects from other teams and their own projects.
- View the admin-managed About page. It is read-only for teams.

### Access and data protection

- The server enforces role checks and team ownership for protected API operations.
- Test and resource access is checked by the API, not only hidden in the interface.
- Uploaded resources and About images require an authenticated token to download.
- Team passwords are stored as bcrypt hashes.
- Ongoing projects are visible only to their owning team and admins.

## Requirements

- Node.js 20 or newer and npm. The root development script uses `wait-on` 9, which requires Node.js 20 or newer.
- MongoDB 6 or newer, either local or hosted (for example, MongoDB Atlas).
- A persistent writable filesystem for `server/uploads/`, or an equivalent persistent volume configured at that path.

## Local setup

From the repository root:

```bash
npm run install:all
```

Copy the environment template and set private values. On PowerShell:

```powershell
Copy-Item server/.env.example server/.env
```

On macOS/Linux:

```bash
cp server/.env.example server/.env
```

Edit `server/.env` with a reachable MongoDB URI, a long random JWT secret, and a unique admin username and password. See [Environment variables](#environment-variables).

Start the API and Vite development server together:

```bash
npm run dev
```

The API listens on port `5000` by default and Vite serves the client at `http://localhost:5173`. The root development script waits for the API port before starting Vite. Vite proxies `/api` and `/uploads` to the API.

Open `http://localhost:5173/login` to sign in with a team ID/name and that team's password. Open `http://localhost:5173/admin-login` for the admin login.

The first server startup creates the admin account if none exists. The values in `ADMIN_USERNAME` and `ADMIN_PASSWORD` are used only for that initial creation; changing them later does not change an existing admin account. Use the admin UI to manage teams and their shared team login passwords.

## Environment variables

Set these in `server/.env` locally and in the deployment provider's secret/environment settings in production:

| Variable | Required | Description |
| --- | --- | --- |
| `MONGO_URI` | Yes | MongoDB connection string for the TechNova database. |
| `JWT_SECRET` | Yes | Long, random secret used to sign and verify 12-hour login tokens. |
| `ADMIN_USERNAME` | First start | Initial admin username, used only if no admin account exists yet. |
| `ADMIN_PASSWORD` | First start | Initial admin password, used only if no admin account exists yet. |
| `PORT` | No | HTTP port. The server defaults to `5000`; most hosting platforms set this automatically. |
| `OPENAI_API_KEY` | No | Enables AI roadmap generation for round resources. Keep it private. |
| `OPENAI_MODEL` | No | Optional model override; defaults to `gpt-4o-mini`. |

Never deploy with the development JWT secret or the example admin password. Do not commit `server/.env` or other credentials.

## Production deployment

TechNova is deployed as one Node service: Express serves the API and the built Vite client from the same origin.

1. Provision MongoDB and configure its network access so the application host can connect.
2. Configure the environment variables above in the hosting provider. Set a unique admin password and a cryptographically random `JWT_SECRET` before first startup.
3. Set the build command to:

   ```bash
   npm run install:all && npm run build
   ```

4. Set the start command to:

   ```bash
   npm start
   ```

5. Attach persistent storage for `server/uploads/` and mount it at that exact path. Uploaded round resources, central resources, About cover images, and leadership portraits are stored there.
6. Configure HTTPS and a health check for the deployed service. Confirm the root login page, admin login, team login, uploads, and MongoDB connection after deployment.

`npm run build` creates `client/dist`. The Express server serves that directory when it exists and returns the SPA entry point for client-side routes. Building the client is therefore required before starting the production service.

The backend currently uses local disk for uploads. A host with an ephemeral filesystem will lose uploaded files on restart or redeploy unless a persistent disk is attached. For multiple application instances, use shared persistent storage or migrate uploads to object storage, and use a shared cache if cross-instance rank-cache consistency is required.

## Uploads and persistence

- Uploads are written to `server/uploads/` with generated filenames.
- Individual uploaded files are limited to 25 MB by the server.
- Supported About and leadership images are PNG, JPG/JPEG, or WebP.
- The repository ignore rules exclude uploaded files because they are runtime/user data. Back up the upload volume separately from source code and the MongoDB database.
- MongoDB stores records and references to stored filenames; it does not store the image bytes.

## Testing

Run the server unit tests from the repository root:

```bash
node --test server/test/*.test.js
```

Build the production client:

```bash
npm run build
```

## Project layout

```text
client/                 React 18 + Vite frontend
  src/pages/admin/      Admin dashboards and management screens
  src/pages/student/    Team dashboards and competition pages
  src/styles.css        Shared application styles
server/                 Express API and MongoDB models
  config/               Database connection
  middleware/           JWT authentication and role checks
  models/               Mongoose schemas
  routes/               Auth, admin, team, member, and shared endpoints
  test/                 Node test-runner tests
  uploads/              Runtime uploaded files (persistent storage required)
  utils/                Access, uploads, timer, project, and rank helpers
package.json            Root install, development, build, and start scripts
```

## Operational notes

- The main competition sign-in is team-based: three candidates share the team's credentials. Admin-created individual member accounts have backend authentication endpoints, but the current React application does not expose a complete individual-member sign-in/dashboard flow.
- Dashboard data is polled periodically. The team rank is calculated from grouped XP totals and cached briefly in each server process to avoid recalculating totals for every team on every request.
- The rank cache is process-local. If running multiple API instances, ranks can differ briefly between instances; use a shared cache if strict cross-instance consistency is needed.
- Capacity depends on the Node host, MongoDB tier, network latency, upload storage, and number of simultaneous users. Load-test against the intended production services before promising a concurrency target.
