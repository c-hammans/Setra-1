# setra

A mobile-first strength training diary for planning workouts, logging live sessions, reviewing exercise history and tracking personal bests.

## Current data model

All data is stored in the browser with `localStorage`. There is no account or backend yet. This makes the prototype private and inexpensive, but data does not sync between devices and clearing Safari website data will remove it.

## Local development

Requirements: Node.js 22 and pnpm 11.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production check

```bash
pnpm build
pnpm start
```

## Deploy with Vercel

1. Push this directory to a GitHub repository.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Keep the detected framework as **Next.js** and use the default build settings.
4. Deploy. No environment variables are required.

Vercel will automatically create preview deployments for pull requests and production deployments from the main branch.

## Install on iPhone

1. Open the deployed Vercel URL in Safari.
2. Tap **Share**.
3. Choose **Add to Home Screen**.
4. Open setra from the new home-screen icon.

Safari stores the diary locally on that iPhone. A future backend will be required for accounts, backup and cross-device syncing.
