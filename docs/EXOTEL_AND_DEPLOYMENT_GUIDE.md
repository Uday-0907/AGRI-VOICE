# AgriVoice — Exotel Voicebot Applet & Deployment Readiness Guide

## 1. Exotel Dashboard Configuration (AgentStream / Voicebot Applet)

1. **Required Exotel Feature:** Enable **Voicebot Applet** (bidirectional AgentStream) on your Exotel account (requires completed KYC and active ExoPhone/virtual number).
2. **Applet Configuration (Inbound Call Flow):**
   - Route inbound calls on your ExoPhone to a **Voicebot Applet**.
   - **WebSocket URL:** `wss://<YOUR-DEPLOYED-BACKEND-DOMAIN>/voice-stream?token=<VOICE_WS_AUTH_SECRET>` (or pass `x-agrivoice-ws-auth` header if custom headers are enabled).
   - **Audio Format:** Linear PCM 16-bit, **8000 Hz**, Mono (Little-Endian), Base64-encoded JSON frames.
   - **Supported Protocol Events:**
     - Inbound (Exotel -> Backend): `connected`, `start` (`stream_sid`, `call_sid`, `account_sid`, `from`, `to`), `media` (`payload`), `dtmf`, `stop`.
     - Outbound (Backend -> Exotel): `media` (chunks strictly multiples of **320 bytes**, e.g. 3200 bytes = 200ms), `mark`, `clear` (sent on caller barge-in).
3. **Greeting & Language Flow:**
   - Upon `start`, AgriVoice plays a Telugu-first greeting via Sarvam Bulbul TTS (`te-IN`, 8kHz) and detects the caller's spoken language via Sarvam Saaras STT.
4. **Buyer Handover:**
   - By default (`EXOTEL_DYNAMIC_TRANSFER_ENABLED=false`), buyer connection requests record a verified enquiry in PostgreSQL (`purchase_requests` + Buyer notification) without initiating unverified outbound calls.
   - To enable live call transfer after farmer confirmation, configure an Exotel Transfer/Connect Applet downstream of the Voicebot Applet and set `EXOTEL_DYNAMIC_TRANSFER_ENABLED=true`.

## 2. Production Deployment Requirements

- **Backend Hosting (Persistent WebSocket Required):** Deploy `backend/api` on a persistent Node.js host (e.g., Render, Railway, Fly.io, AWS ECS, or VM) that supports **long-lived bidirectional WSS connections**. Serverless functions (Vercel Functions / AWS Lambda) cannot maintain Exotel AgentStream WebSocket sessions.
- **Frontend Hosting:** Deploy `frontend` (`npm run build` -> `dist/`) on Vercel or Cloudflare Pages with `VITE_API_BASE_URL=https://<YOUR-DEPLOYED-BACKEND-DOMAIN>` and production Clerk `VITE_CLERK_PUBLISHABLE_KEY` (`pk_live_...`).
- **Database Migrations:** Run `npm run db:migrate` against production PostgreSQL (with PostGIS enabled) before starting the Node.js server.
- **Security & TLS:**
  - Use HTTPS/WSS only in production.
  - Set `CORS_ORIGIN` to the exact production frontend URL.
  - Replace `APP_SECRET`, `VOICE_WS_AUTH_SECRET`, and Clerk keys with production secrets via your hosting secrets manager.
- **Health Check:** `GET /health` (`200 OK`) and `GET /voice/status` (non-secret readiness).
