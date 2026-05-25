# Deploy Supabase Edge Functions (fix signup 404)

The mobile app calls Edge Functions (`send-otp`, `verify-otp`, `reset-password-with-otp`) at **your Supabase URL**. A 404 means those functions are not available at that URL yet.

Your **`.env`** is correct: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` point to your instance. No change needed there.

---

## Self-hosted Supabase (your case)

**Do not use `supabase login`** — that is only for **Supabase Cloud**. It opens the cloud dashboard and is not used for self-hosted instances.

With self-hosted Supabase, Edge Functions must run on **your** infrastructure using the [Supabase Edge Runtime](https://supabase.com/docs/reference/self-hosting-functions/introduction) (Deno-based). The app already calls:

- `{EXPO_PUBLIC_SUPABASE_URL}/functions/v1/send-otp`
- `{EXPO_PUBLIC_SUPABASE_URL}/functions/v1/verify-otp`
- `{EXPO_PUBLIC_SUPABASE_URL}/functions/v1/reset-password-with-otp`

So your self-hosted stack must serve these three functions at that base URL.

### Option A: You already have Edge Runtime in your self-hosted stack

1. Copy the three function folders from this repo into the directory your Edge Runtime uses:
   - `apps/core/mbukanji-maps/supabase/functions/send-otp/`
   - `apps/core/mbukanji-maps/supabase/functions/verify-otp/`
   - `apps/core/mbukanji-maps/supabase/functions/reset-password-with-otp/`
2. Ensure the runtime is configured to serve them at `/functions/v1/<name>` (or whatever path your Supabase API gateway expects).
3. Set env vars for the functions (e.g. `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, SMTP for send-otp) on the server where the runtime runs.

### Option B: Add Edge Runtime to your self-hosted setup

1. Use the [Supabase Edge Runtime](https://github.com/supabase/edge-runtime) (Docker or `run.sh`):
   ```bash
   # Example: run functions from the repo
   docker run -it --rm -p 9000:9000 \
     -v /path/to/JanPAMS/apps/core/mbukanji-maps/supabase/functions:/usr/services \
     supabase/edge-runtime start --main-service /usr/services
   ```
2. Put this behind your existing reverse proxy so that `https://your-supabase-domain.com/functions/v1/*` is forwarded to the Edge Runtime (port 9000 in the example).
3. Configure the same env vars (Supabase URL, service role key, SMTP, etc.) for the container or process.

### Option C: Self-hosted demo (e.g. Fly.io)

See Supabase docs: [Self-Hosting Functions](https://supabase.com/docs/reference/self-hosting-functions/introduction) and the [self-hosted Edge Functions demo](https://github.com/supabase/self-hosted-edge-functions-demo). Copy `send-otp`, `verify-otp`, and `reset-password-with-otp` from `apps/core/mbukanji-maps/supabase/functions/` into the demo’s `./functions` directory and deploy.

### Env vars for the functions (self-hosted)

On the server/container where the Edge Runtime runs, the functions need at least:

- `SUPABASE_URL` — same as your `EXPO_PUBLIC_SUPABASE_URL` (your self-hosted API URL).
- `SUPABASE_SERVICE_ROLE_KEY` — service role key for your self-hosted instance (for Auth Admin API, DB, etc.).

For **send-otp** (email OTP), you also need SMTP or another way to send email (the function uses Deno mailer; see `send-otp/index.ts`).

---

## Supabase Cloud only (if you were using cloud)

If your instance were **Supabase Cloud** (not self-hosted), you would:

1. Run `supabase login` (opens browser to Supabase Cloud).
2. From `apps/core/mbukanji-maps`: `npx supabase link --project-ref <ref>` then `npm run deploy:auth-functions`.

**You can ignore this section** when using a self-hosted URL and anon key in `.env`.

---

## Verify

After the three functions are deployed and reachable at your self-hosted URL:

- `POST {EXPO_PUBLIC_SUPABASE_URL}/functions/v1/send-otp` (with body `{ identifier, purpose, type }`) should return 200, not 404.

Then try signup again in the mobile app; the 404 should be resolved.
