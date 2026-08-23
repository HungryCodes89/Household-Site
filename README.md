# Household Site

Next.js 14 app backed by Supabase. Live at **https://app.thehouseholdbrand.com**.

## Local development

```bash
npm install
npm run dev
```

Runs on http://localhost:3000.

## Deploying

Pushes to `main` deploy to production automatically — the Vercel project
`household-site` is connected to this repo. Branch pushes get preview URLs
instead of going live.

To publish manually (bypasses the git trigger):

```bash
npx vercel --prod --yes
```

## Notes

- Build config comes from `vercel.json` (`"framework": "nextjs"`), which
  overrides the framework preset shown in the Vercel dashboard.
- `supabase/schema.sql` is the canonical schema. Any migration applied to the
  live database should be folded back into that file in the same change.
