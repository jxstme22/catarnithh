# ctarnith web

A minimal black-and-white landing page for the `ctarnith` CLI.

## Stack

- Vite + React
- Static deployment on Vercel

## Local development

```bash
cd frontend
npm install
npm run dev
```

## Deploy

```bash
cd frontend
vercel
```

The included `vercel.json` handles SPA routing.

## Notes

- Update the GitHub link in `src/App.jsx` when the repo is public.
- The install command is sourced from the root `README.md`.
- The ASCII background (`public/bg.txt`) reacts to cursor movement via a CSS `backdrop-filter` spotlight mask.
