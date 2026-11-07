<p align="center">
  <img src="static/logo.svg" alt="QuerySheriff logo" width="96">
</p>

<h1 align="center">QuerySheriff frontend</h1>

The frontend is the QuerySheriff dashboard, a SvelteKit single-page app with no server-side code. It reads all its data from the [backend](https://github.com/querysheriff/backend) over Connect RPC.

![The Queries page: query volume and latency over seven days, and the queries that took the most total time, with their tags](https://raw.githubusercontent.com/querysheriff/.github/master/profile/queries.png)

It has these pages:

- Queries: latency over time and the queries with the most total time, filterable by tag
- Query detail: one query's history, captured runs and execution plans
- Locks: lock waits and which session blocked which
- Transactions: long transactions and a timeline of what each one ran
- Logs: PostgreSQL logs by severity and category
- Alerts: Slack alert settings per server
- Admin: collector tokens and users

## Installation

The frontend ships as the Docker image `ghcr.io/querysheriff/frontend` (linux/amd64), which serves the static build with Caddy. The Helm chart in the [deployment guide](https://github.com/querysheriff/docs/blob/master/deployment.md#4-install-the-backend-and-frontend) installs it together with the backend.

## Configuration

`PUBLIC_API_URL`, read at build time, is the only setting. Leave it unset in production.

## Development

Requires Node.js 24 and a [backend running locally](https://github.com/querysheriff/backend#development).

```sh
npm install
cp .env.example .env   # PUBLIC_API_URL=http://localhost:3000/api
npm run dev            # http://localhost:3001
```
