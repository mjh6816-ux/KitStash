This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started (Local)

1. Copy `.env.example` to `.env.local` and fill in your Supabase project credentials (including `SUPABASE_USER_ID`).

2. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

See the deployment section below for moving off localhost.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploying for Remote / Away-from-Home Use

See **[DEPLOY.md](./DEPLOY.md)** for the complete, step-by-step guide using the recommended path:

- Vercel hosting (free HTTPS + always-on)
- Built-in Vercel Password Protection for security (no code changes)
- Exact environment variables to set (`SUPABASE_USER_ID` + the three Supabase keys)
- Testing on phone over cellular data (camera works reliably)

There's also a small helper script `init-git.ps1` you can run to initialize the repo and get the exact push commands.

Your local `npm run dev` continues to work unchanged with `.env.local`.
