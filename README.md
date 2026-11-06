# QuerySheriff frontend

The frontend is the QuerySheriff dashboard. It is a SvelteKit single-page app (Svelte 5 in runes mode, Tailwind CSS 4) that reads everything from the [backend](https://github.com/querysheriff/backend) through Connect-web. There is no server-side code: the production image serves the static build with Caddy.

Deployment is covered in the [deployment guide](https://github.com/querysheriff/docs); this README is about working on the code.

## Requirements

- Node.js 24 (`.node-version` pins 24.16.0; `engine-strict` in `.npmrc` makes npm refuse older versions)
- A running backend for real data, see [backend local development](https://github.com/querysheriff/backend#local-development)

## Local development

```sh
npm install
cp .env.example .env   # PUBLIC_API_URL=http://localhost:3000/api
npm run dev            # http://localhost:3001
```

The dev server only starts on port 3001, because that is the origin the backend allows by default. If the backend runs with `DEV_AUTO_LOGIN=true`, as its `.env.example` sets, the dashboard opens without a login. Otherwise the first login on an empty backend creates the super admin.

## Configuration

| Variable         | Description                                                                                                                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_API_URL` | Backend API base URL. Unset, the app calls `/api` on its own origin, which is how the image is deployed. Set it only when the API is on another origin, as in local development. The value is fixed when the app is built. |

The image is built without it, so a deployment has to serve the dashboard and `/api` from the same hostname.

## Project structure

```
src/
  routes/          one directory per screen, see below
  lib/             shared logic, see the table below
  lib/components/  UI components and their Storybook stories
  lib/gen/         client generated from the backend's proto schema
static/            icons and the pev2 execution plan viewer page
tests/             Playwright end-to-end tests and the backend mock they use
.storybook/        Storybook config
Caddyfile          static file server config used in the image
```

| Route                               | Screen                                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------------------------- |
| `/queries`                          | Query statistics, and `/queries/[id]` for one query with its samples and execution plans |
| `/locks`                            | Lock waits and what blocked them                                                         |
| `/transactions`                     | Long-running transactions with a timeline of their queries                               |
| `/logs`                             | PostgreSQL logs by severity and category                                                 |
| `/alerts`                           | Slack webhook and alert toggles per server                                               |
| `/admin/collectors`, `/admin/users` | Collector tokens and users, super admin only                                             |
| `/login`                            | Sign-in page                                                                             |

| Module                      | Responsibility                                                                                                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/connect.ts`        | One Connect transport and the typed clients for all seven backend services. It sends the session cookie with every request and signs the user out when the backend answers `Unauthenticated`. |
| `src/lib/loader.svelte.ts`  | `Loader` and `PagedLoader`. Pages fetch inside `$effect`, and a rerun or unmount aborts the request in flight.                                                                                |
| `src/lib/state.svelte.ts`   | Global state: the selected server, database and time range, kept in the URL, and the server list, refreshed every 30 seconds.                                                                 |
| `src/lib/session.svelte.ts` | The signed-in user.                                                                                                                                                                           |
| `src/lib/nav.ts`            | Sidebar entries and screen titles.                                                                                                                                                            |
| `src/lib/format.ts`         | Formatting of durations, counts and timestamps, and severity colors.                                                                                                                          |
| `src/lib/docsContent.ts`    | Text of the in-app help drawer.                                                                                                                                                               |
| `src/routes/layout.css`     | Tailwind `@theme` with every color, the type scale and the fonts. No colors are defined anywhere else.                                                                                        |
| `static/pev2/viewer.html`   | Execution plan viewer, loaded in a sandboxed iframe. Its CDN files are pinned by version and SRI hash.                                                                                        |

Svelte runes mode is forced for all project code in `svelte.config.js`, so components must use `$state`, `$derived`, `$effect` and `$props`. The legacy `export let` and `$:` syntax does not compile.

## Commands

| Command                | Description                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`          | Dev server on `http://localhost:3001`.                                                                                      |
| `npm run build`        | Static build into `build/`.                                                                                                 |
| `npm run preview`      | Serve the build on `http://localhost:3001`.                                                                                 |
| `npm run check`        | Type check with `svelte-check`, then `lint`, then `test`. Run it before you push.                                           |
| `npm run lint`         | Prettier in check mode and ESLint.                                                                                          |
| `npm run format`       | Format everything with Prettier.                                                                                            |
| `npm run test`         | Vitest unit tests (`src/lib/*.test.ts`).                                                                                    |
| `npm run test:e2e`     | Playwright tests against a production build on `localhost:4173`, with the backend mocked in each test. Not part of `check`. |
| `npm run storybook`    | Storybook on `http://localhost:6006`.                                                                                       |
| `npm run proto:update` | Regenerate `src/lib/gen/` from a backend running on `localhost:3000`.                                                       |

To run one unit test file:

```sh
npx vitest run src/lib/format.test.ts
```

Playwright needs its browser once before the first `npm run test:e2e`:

```sh
npx playwright install chromium
```

## Generated client

`src/lib/gen/` comes from the proto files the backend serves at `/schema.zip`; never edit it by hand. After a schema change in [backend](https://github.com/querysheriff/backend#changing-the-wire-schema), start that backend, run `npm run proto:update` and commit `src/lib/gen/`.

## Further reading

- [Deployment guide](https://github.com/querysheriff/docs): Helm chart, ingress, troubleshooting
