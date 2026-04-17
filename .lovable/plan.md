
The user wants the full end-to-end flow in the plan, not just the static page. So plan now covers: (1) static page artifact, (2) Railway endpoint spec, (3) Supabase columns, (4) SMS link wiring, (5) bot reads back the address.

Two values to confirm before building (asked last round, no answer):
- Azure Maps key — use the one pasted in chat? (rotate it after)
- Railway base URL — use `https://voice-loom-bot-production.up.railway.app`?

I'll proceed assuming yes to both unless they say otherwise.

# Plan — RescueBoy location confirmation, end-to-end

## 1. Static page (artifact, NOT in this React app)
Generate to `/mnt/documents/rescueboy-location/` + zipped bundle.

**Files**: `index.html`, `app.js`, `styles.css`
- Mobile-first, Estonian (`lang="et"`), Azure Maps Web SDK v3 via CDN
- Reads `?caseId=…&token=…` from URL (error if missing)
- Auth: `authOptions: { authType: 'subscriptionKey', subscriptionKey: '<AZURE_MAPS_KEY>' }`
- On load: ask geolocation → if granted, center on user; if denied, default to Tallinn `[24.7536, 59.4370]`
- Draggable `HtmlMarker`; tap map to reposition
- Big bottom button **"Kinnita asukoht"**
- Helper text: *"Liigutage vajadusel nööpnõela ja vajutage kinnita."*
- POST `{caseId, token, lat, lon}` → Railway endpoint
- Success: hide map, show *"Asukoht kinnitatud"* + returned address
- Error: inline Estonian message, re-enable button

## 2. Railway endpoint (spec for orchestrator — implement in `orchestrator/src/routes/`)

**`POST /api/location/confirm`**
- Validate body with Zod: `caseId` (string), `token` (string), `lat` (number -90..90), `lon` (number -180..180)
- Verify token (HMAC of `caseId` with shared secret, or DB lookup — TBD)
- Reverse-geocode:
  `GET https://atlas.microsoft.com/search/address/reverse/json?api-version=1.0&query={lat},{lon}&subscription-key={AZURE_MAPS_KEY}&language=et-EE`
- Extract `addresses[0].address.freeformAddress`
- Update Supabase `calls` row where `id = caseId`:
  - `location_confirmed = true`
  - `location_lat`, `location_lon`, `location_address`, `location_confirmed_at = now()`
- Respond: `{ ok: true, address, lat, lon }`
- CORS: allow Azure static site origin
- Add `AZURE_MAPS_KEY` to Railway env

## 3. Supabase migration
Add columns to `public.calls`:
- `location_confirmed boolean default false`
- `location_lat double precision`
- `location_lon double precision`
- `location_address text`
- `location_confirmed_at timestamptz`

## 4. SMS link wiring (orchestrator `media-stream.ts`)
When AI sends a "location request" SMS template, append the link:
`https://<azure-storage-endpoint>/index.html?caseId=<call_id>&token=<signed_token>`
- Generate `token` = HMAC-SHA256(`call_id`, `LOCATION_TOKEN_SECRET`)
- Replace `{{location_link}}` placeholder in SMS template body

## 5. Bot reads address back (orchestrator `media-stream.ts`)
- On call start, subscribe via Supabase realtime to `calls` row updates where `id = currentCallId`
- When `location_confirmed` flips to true, inject system message into OpenAI Realtime WS:
  > "📍 Klient kinnitas asukoha: <location_address>. Kinnita see talle vestluses tagasi."
- Trigger `response.create` so AI speaks it

## 6. Deployment steps (told to user, not auto-done)
1. Upload `index.html`, `app.js`, `styles.css` to Azure Storage `$web` container
2. Note the Primary endpoint (e.g. `https://rescueboy.z6.web.core.windows.net`)
3. Restrict Azure Maps key by referrer → that endpoint only
4. Add Railway env vars: `AZURE_MAPS_KEY`, `LOCATION_TOKEN_SECRET`, `AZURE_STATIC_BASE_URL`
5. Redeploy orchestrator

## Files touched
- **Artifact** (generated, not in repo): `/mnt/documents/rescueboy-location/{index.html,app.js,styles.css}` + `.zip`
- **Migration**: add 5 location columns to `calls`
- **`orchestrator/src/routes/location.ts`** (new) — `POST /api/location/confirm`
- **`orchestrator/src/index.ts`** — mount route
- **`orchestrator/src/ws/media-stream.ts`** — token generation, link templating, realtime subscription, AI injection
- **`orchestrator/.env.example`** + `infra/env/orchestrator.env.example` — add 3 new vars

## Confirm before I build
- Azure Maps key = the one from chat? (and you'll rotate it after)
- Railway base URL = `https://voice-loom-bot-production.up.railway.app`?
- Token strategy = HMAC of call_id (stateless, simple) vs DB lookup (revocable)?
