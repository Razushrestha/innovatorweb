# Innovator Web (Next.js)

Web client for Innovator, matched to the Flutter app’s navy / gold / glass design language.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Same backend services as the mobile app
- Session keys aligned with Flutter (`auth_access_token`, etc.)

## Run

```bash
cd innovator-web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## What’s included

- Splash → Login / Signup → App shell (desktop sidebar + mobile dock)
- Liquid glass design system
- **Feed** + compose post (live API `:8012`)
- **Search** (live API `:8015`)
- **Chat** list + thread (live API `:8014`)
- **E-learning** catalog, detail, enroll (local catalog + sample video)
- **Shop** catalog, detail, cart with 13% VAT + delivery (local + localStorage)
- Auth login / register (`:8010`)

## Note on CORS

Browsers require the backend services to allow `http://localhost:3000` (and your deployed origin). If login/feed/chat fail with network/CORS errors, update API CORS on ports `8010`–`8015`.

## Also included

- **Profile** edit + avatar upload (`:8011`)
- **Notifications** list / mark read / delete (`:8012`)
- **Feed media lightbox** (images + video)
- **Google Sign-In** (`@react-oauth/google` → `/api/auth/sso/google`)

## Still to port

Realtime chat websocket, privacy policy page polish.
