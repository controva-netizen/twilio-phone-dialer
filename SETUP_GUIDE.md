# Netro Scale - Setup Guide

Browser-based calling app built with Next.js 16, Twilio Voice SDK, and Supabase.

---

## Prerequisites

- **Node.js** v18+
- **ngrok** ([ngrok.com](https://ngrok.com)) — for local development
- **Twilio account** ([twilio.com](https://www.twilio.com))
- **Supabase project** ([supabase.com](https://supabase.com))

---

## Step 1: Twilio Setup

### 1.1 Get Credentials

From the [Twilio Console](https://console.twilio.com):

| Credential | Where to find | Format |
|---|---|---|
| Account SID | Dashboard | `ACxxxxxxxx` |
| API Key | Account → API Keys → Create Standard | `SKxxxxxxxx` |
| API Secret | Shown once when creating API Key | Save immediately! |

### 1.2 Buy a Phone Number

1. Go to **Phone Numbers → Buy a Number**
2. Select one with **Voice** capability
3. Note the number (e.g., `+13072075599`)

### 1.3 Create a TwiML App

1. Go to **Voice → TwiML Apps → Create**
2. Name: `Netro Scale`
3. **Voice Request URL**: `https://YOUR-NGROK-URL/api/twilio/webhook`
4. Method: **POST**
5. Save and copy the **SID** (starts with `AP`)

### 1.4 Configure Phone Number Webhook

1. Go to **Phone Numbers → Active Numbers → Your Number**
2. Under **Voice Configuration**:
   - **A call comes in**: Webhook
   - **URL**: `https://YOUR-NGROK-URL/api/twilio/webhook`
   - **Method**: POST
3. Save

> **Note:** Both the TwiML App and Phone Number webhook point to the same URL: `/api/twilio/webhook`

---

## Step 2: Supabase Setup

### 2.1 Create Project

Create a project at [supabase.com](https://supabase.com) and note:
- **Project URL** (Settings → API)
- **Anon Key** (Settings → API → Project API Keys)
- **Service Role Key** (Settings → API → Project API Keys)

### 2.2 Run Database Migration

Go to **SQL Editor** and run the contents of `supabase-migration.sql`.

This creates:
- `user_phone_numbers` table (with voice feature columns)
- `call_recordings` table (for recordings & voicemails)
- RLS policies for security

### 2.3 Create Users

Go to **Authentication → Users → Add User** to create email/password accounts.

### 2.4 Assign Phone Numbers

In **Table Editor → user_phone_numbers**, insert rows:

| Column | Example |
|---|---|
| `user_id` | User's UUID from Auth |
| `phone_number` | `+13072075599` |
| `friendly_name` | `Main Line` |
| `is_default` | `true` |

---

## Step 3: Configure Environment

Copy `.env.example` to `.env.local` and fill in your values:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_API_KEY=SKxxxxxxxx
TWILIO_API_SECRET=your-secret
TWILIO_TWIML_APP_SID=APxxxxxxxx
TWILIO_DEFAULT_NUMBER=+1XXXXXXXXXX
```

---

## Step 4: Run Locally

### Terminal 1: Start ngrok

```bash
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://xxxx.ngrok-free.dev`) and update:
- TwiML App Voice Request URL
- Phone Number Voice Webhook URL

### Terminal 2: Start the app

```bash
npm install
npm run dev
```

Open http://localhost:3000, log in, and verify **"Ready"** status.

---

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── twilio/
│   │   │   ├── token/        # JWT token generation
│   │   │   ├── webhook/      # Incoming & outgoing call handling
│   │   │   └── voicemail/    # Voicemail recording & playback
│   │   └── user/
│   │       ├── numbers/      # Phone number management
│   │       └── voice-settings/ # Recording & voicemail toggles
│   ├── calls/                # Main dialer page
│   ├── login/                # Auth page
│   └── settings/             # User settings
├── components/               # UI components
├── hooks/                    # Twilio device, call state
├── lib/                      # Config, API client, Supabase
└── middleware.ts             # Auth protection
```

### Call Flow

**Outgoing:** Browser → Twilio SDK → Twilio Cloud → `/api/twilio/webhook` → TwiML → Connects call

**Incoming:** Phone call → Twilio → `/api/twilio/webhook` → Looks up user by number → Routes to browser client

---

## Features

| Feature | Description |
|---|---|
| Multi-user auth | Supabase email/password with admin-assigned numbers |
| Incoming calls | Routed to correct user based on dialed number |
| Outgoing calls | Uses user's default caller ID |
| Call recording | Toggle per-number in Settings |
| Voicemail | Plays greeting, records message when unanswered |
| Answer on bridge | Call only answered when user picks up |
| DTMF tones | Send digits during active calls |
| Call history | Local call log with filtering |

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Status never becomes "Ready" | Check Twilio env vars in `.env.local` |
| Calls redirect to /login | Middleware bypass not working — check `middleware.ts` |
| "Document parse failure" errors | Check for unescaped `&` in TwiML XML |
| Incoming calls don't ring | Verify phone number webhook points to `/api/twilio/webhook` |
| Voicemail not saving | Run `supabase-migration.sql` and check `SUPABASE_SERVICE_ROLE_KEY` |
| ngrok URL changed | Update TwiML App + Phone Number webhook URLs |

---

## Deployment (Vercel)

1. Connect repo to Vercel
2. Add all env vars from `.env.example`
3. Deploy — webhook URLs will be `https://your-app.vercel.app/api/twilio/webhook`
4. Update TwiML App and Phone Number webhooks to the Vercel URL
