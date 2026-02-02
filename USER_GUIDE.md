# TwilioPhone - Complete User Guide

A full-stack web-based phone application built with Twilio Voice SDK that lets you make and receive phone calls directly from your browser.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Twilio Account Setup](#twilio-account-setup)
4. [Project Setup](#project-setup)
5. [Running the Project](#running-the-project)
6. [How to Make Outgoing Calls](#how-to-make-outgoing-calls)
7. [How to Receive Incoming Calls](#how-to-receive-incoming-calls)
8. [Features](#features)
9. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
+---------------------+         +---------------------+         +------------------+
|                     |  HTTP   |                     |  API    |                  |
|   React Frontend    | ------> |  Express Backend    | ------> |   Twilio Cloud   |
|   (Vite, port 5173) |         |  (Node.js, port 3001)|        |                  |
|                     | <------ |                     | <------ |                  |
+---------------------+         +---------------------+         +------------------+
        |                               ^                              |
        |   WebSocket (Voice SDK)       |   Webhooks (ngrok)           |
        +-------------------------------+------------------------------+
                                        |
                                  +------------+
                                  |   ngrok    |
                                  | (tunnel)   |
                                  +------------+
```

### How It Works

1. **Frontend (React + Vite)** - The browser UI with a dialpad, call controls, and call history. Uses the `@twilio/voice-sdk` to establish WebRTC audio connections.

2. **Backend (Express.js)** - Serves two purposes:
   - **Token Endpoint** (`POST /api/token`) - Generates JWT access tokens so the frontend can authenticate with Twilio.
   - **TwiML Webhooks** (`POST /api/voice/outgoing`, `/incoming`, `/status`) - Returns TwiML XML instructions telling Twilio how to route calls.

3. **Twilio Cloud** - Manages the actual phone network connection. When a call is made or received, Twilio hits your backend webhooks to get routing instructions (TwiML).

4. **ngrok** - Creates a public HTTPS tunnel to your local backend (port 3001) so Twilio's servers can reach your webhooks during development.

### Call Flow - Outgoing

```
Browser -> Twilio Voice SDK -> Twilio Cloud -> Your Backend /api/voice/outgoing
                                            -> Twilio reads TwiML response
                                            -> Twilio connects to the phone number
                                            -> Audio flows via WebRTC
```

### Call Flow - Incoming

```
Someone calls your Twilio number -> Twilio Cloud -> Your Backend /api/voice/incoming
                                                 -> Twilio reads TwiML response
                                                 -> Twilio routes call to browser client "user"
                                                 -> Browser receives incoming call event
                                                 -> User accepts/rejects
```

### Project Structure

```
TwilioPhone/
├── backend/
│   ├── src/
│   │   ├── index.js              # Express server entry point
│   │   ├── config/twilio.js      # Twilio client & credential config
│   │   ├── routes/token.js       # Token generation endpoint
│   │   ├── routes/voice.js       # TwiML webhook endpoints
│   │   └── middleware/validateRequest.js  # Twilio signature validation
│   ├── .env                      # Environment variables (secrets)
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── index.jsx             # React entry point
│   │   ├── App.jsx               # Root component
│   │   ├── components/Phone/     # Phone UI components
│   │   │   ├── Phone.jsx         # Main phone component
│   │   │   ├── Dialpad.jsx       # Number keypad
│   │   │   ├── CallControls.jsx  # Call/Hangup/Mute buttons
│   │   │   ├── CallStatus.jsx    # Active call info display
│   │   │   ├── IncomingCall.jsx  # Incoming call popup
│   │   │   └── CallHistory.jsx   # Call log
│   │   ├── hooks/
│   │   │   ├── useTwilioDevice.js  # Twilio device lifecycle
│   │   │   ├── useCallState.js     # Call UI state (duration, mute)
│   │   │   └── useCallHistory.js   # Persistent call history
│   │   └── services/api.js       # Backend API client
│   ├── vite.config.js
│   └── package.json
```

---

## Prerequisites

- **Node.js** v18 or higher
- **npm** (comes with Node.js)
- **ngrok** account and CLI installed ([https://ngrok.com](https://ngrok.com))
- **Twilio account** ([https://www.twilio.com](https://www.twilio.com))
- A modern browser (Chrome or Edge recommended for WebRTC)

---

## Twilio Account Setup

This is the most important section. You need **6 things** from Twilio:

### Step 1: Get Account SID & Auth Token

1. Log in to [Twilio Console](https://console.twilio.com)
2. On the dashboard, copy your **Account SID** (starts with `AC`)
3. Copy your **Auth Token**

### Step 2: Create an API Key

1. Go to **Account > API keys & tokens** (or visit `https://console.twilio.com/us1/account/keys-credentials/api-keys`)
2. Click **Create API Key**
3. Give it a friendly name (e.g., "TwilioPhone App")
4. Select **Standard** key type
5. Click **Create**
6. Copy the **SID** (starts with `SK`) - this is your `TWILIO_API_KEY`
7. Copy the **Secret** - this is your `TWILIO_API_SECRET`
8. **Save these immediately** - the secret is shown only once

### Step 3: Buy a Phone Number

1. Go to **Phone Numbers > Manage > Buy a number** (or visit `https://console.twilio.com/us1/develop/phone-numbers/manage/search`)
2. Search for a number with **Voice** capability
3. Buy the number
4. Note the number (e.g., `+13072075599`) - this is your `TWILIO_PHONE_NUMBER`

### Step 4: Create a TwiML App

1. Go to **Voice > Manage > TwiML Apps** (or visit `https://console.twilio.com/us1/develop/voice/manage/twiml-apps`)
2. Click **Create new TwiML App**
3. Give it a name (e.g., "TwilioPhone")
4. For now, leave the Voice URLs empty (you'll fill them after starting ngrok)
5. Click **Create**
6. Copy the **SID** (starts with `AP`) - this is your `TWILIO_TWIML_APP_SID`

### Step 5: Configure Webhooks (CRITICAL for incoming AND outgoing calls)

After you start ngrok (see [Running the Project](#running-the-project)), you will have a public URL like `https://xxxx-xxxx.ngrok-free.dev`. You need to configure this in **two places**:

#### A. TwiML App Voice URL (for OUTGOING calls)

1. Go to **Voice > Manage > TwiML Apps**
2. Click your TwiML App
3. Set **Voice Request URL** to:
   ```
   https://your-ngrok-url.ngrok-free.dev/api/voice/outgoing
   ```
4. Method: **POST**
5. (Optional) Set **Status Callback URL** to:
   ```
   https://your-ngrok-url.ngrok-free.dev/api/voice/status
   ```
6. Click **Save**

#### B. Phone Number Voice URL (for INCOMING calls)

1. Go to **Phone Numbers > Manage > Active Numbers**
2. Click your phone number
3. Scroll to **Voice Configuration**
4. Set **"A call comes in"** to **Webhook**
5. Set the URL to:
   ```
   https://your-ngrok-url.ngrok-free.dev/api/voice/incoming
   ```
6. Method: **POST**
7. Click **Save**

> **This is how you receive incoming calls.** When someone dials your Twilio phone number, Twilio sends a webhook to this URL, and your backend responds with TwiML that routes the call to the browser client named "user".

---

## Project Setup

### 1. Clone or download the project

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Install frontend dependencies

```bash
cd frontend
npm install
```

### 4. Configure environment variables

Edit `backend/.env` with your Twilio credentials:

```env
PORT=3001
NODE_ENV=development

TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_KEY=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TWIML_APP_SID=APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX

FRONTEND_URL=http://localhost:5173
WEBHOOK_BASE_URL=https://your-ngrok-url.ngrok-free.dev
```

---

## Running the Project

You need **3 terminals** running simultaneously:

### Terminal 1: Start ngrok

```bash
ngrok http 3001
```

This gives you a public URL like `https://abcd-1234.ngrok-free.dev`. Copy this URL.

**After starting ngrok:**
1. Update `WEBHOOK_BASE_URL` in `backend/.env` with the ngrok URL
2. Update your **TwiML App Voice Request URL** in Twilio Console to `https://your-ngrok-url/api/voice/outgoing`
3. Update your **Phone Number Voice Webhook URL** in Twilio Console to `https://your-ngrok-url/api/voice/incoming`

> **Note:** Free ngrok URLs change every time you restart ngrok. You must update the URLs in Twilio Console each time.

### Terminal 2: Start the backend

```bash
cd backend
npm run dev
```

You should see:
```
Server running on port 3001
Environment: development
Frontend URL: http://localhost:5173
```

### Terminal 3: Start the frontend

```bash
cd frontend
npm run dev
```

The browser will automatically open at `http://localhost:5173`.

### Startup Checklist

- [ ] ngrok is running and showing a public HTTPS URL
- [ ] Backend is running on port 3001 (no crash)
- [ ] Frontend is running on port 5173
- [ ] TwiML App Voice URL is set to `{ngrok-url}/api/voice/outgoing`
- [ ] Phone Number Voice Webhook is set to `{ngrok-url}/api/voice/incoming`
- [ ] `WEBHOOK_BASE_URL` in `.env` matches the ngrok URL
- [ ] Browser shows the phone UI with status "Ready" (green dot)

---

## How to Make Outgoing Calls

1. Wait for the status indicator to show **"Ready"** (green dot) in the phone header
2. Enter the destination phone number in **E.164 format**: `+1XXXXXXXXXX` (e.g., `+14155551234`)
3. You can type the number directly or use the dialpad buttons
4. Click the **green call button** to start the call
5. The status will change to **"On Call"** when connected
6. During the call you can:
   - **Mute/Unmute** - Click the mute button
   - **Send DTMF tones** - Press dialpad buttons (useful for IVR menus)
7. Click the **red hangup button** to end the call

---

## How to Receive Incoming Calls

### Setup Required (one-time per ngrok session)

1. Make sure ngrok, backend, and frontend are all running
2. In Twilio Console, go to **Phone Numbers > Active Numbers > Your Number**
3. Under **Voice Configuration**, set **"A call comes in"** webhook to:
   ```
   https://your-ngrok-url.ngrok-free.dev/api/voice/incoming
   ```
4. Save the configuration

### Receiving a Call

1. Have someone call your Twilio phone number (the one in `TWILIO_PHONE_NUMBER`)
2. A popup will appear in the browser showing the caller's number
3. Click **Accept** to answer or **Reject** to decline
4. Once accepted, you can talk, mute, or hang up just like an outgoing call

### How It Works Internally

When someone calls your Twilio number:
1. Twilio sends a POST request to `{ngrok-url}/api/voice/incoming`
2. Your backend returns TwiML that says: "connect this call to browser client `user`"
3. Twilio pushes the call to your browser via the Voice SDK WebSocket
4. The `IncomingCall` component renders with Accept/Reject buttons

---

## Features

| Feature | Description |
|---------|-------------|
| **Outgoing Calls** | Dial any phone number from the browser |
| **Incoming Calls** | Receive calls with accept/reject popup |
| **Mute/Unmute** | Toggle microphone during active call |
| **DTMF Tones** | Send touch-tone digits during a call (for IVR navigation) |
| **Call History** | View all past calls with direction, duration, and status |
| **Call Filtering** | Filter history by All, Incoming, or Outgoing |
| **Quick Redial** | Click any history entry to redial the number |
| **Call Duration** | Live timer during active calls |
| **Audio Device Selection** | Choose audio output device |
| **Test Sound** | Play a test tone to verify audio is working |
| **Auto Token Refresh** | Token automatically refreshes before expiry |

---

## Troubleshooting

### "Failed to fetch" / Backend not responding

- **Cause:** Backend is not running or crashed
- **Fix:** Check the backend terminal. If you see `EADDRINUSE`, the port is occupied:
  ```bash
  npx kill-port 3001
  npm run dev
  ```

### Status shows "Connecting..." and never becomes "Ready"

- **Cause:** Token generation failed, likely bad Twilio credentials
- **Fix:** Verify all 6 credentials in `backend/.env` are correct. Check browser console and backend terminal for error details.

### Outgoing calls don't connect / "No destination number provided"

- **Cause:** TwiML App Voice URL not configured or ngrok not running
- **Fix:** Ensure TwiML App Voice Request URL is set to `{ngrok-url}/api/voice/outgoing`

### Not receiving incoming calls

- **Cause:** Phone Number Voice Webhook not configured
- **Fix:**
  1. Go to Twilio Console > Phone Numbers > Your Number
  2. Set Voice webhook to `{ngrok-url}/api/voice/incoming`
  3. Make sure ngrok is running and the URL matches

### "Address already in use" error (EADDRINUSE)

- **Cause:** Previous server instance didn't shut down cleanly
- **Fix:**
  ```bash
  npx kill-port 3001
  ```
  Then restart the backend.

### No audio / Can't hear anything

- **Cause:** Browser AudioContext is suspended (browser security policy)
- **Fix:**
  1. Click anywhere on the page first (this resumes AudioContext)
  2. Click the "Test sound" button to verify audio works
  3. Check your browser's site permissions for microphone access
  4. Try a different audio output device from the dropdown

### ngrok URL changed

- Free ngrok URLs change on every restart
- After restarting ngrok, update:
  1. `WEBHOOK_BASE_URL` in `backend/.env`
  2. TwiML App Voice Request URL in Twilio Console
  3. Phone Number Voice Webhook URL in Twilio Console
  4. Restart the backend after changing `.env`

### Call connects but one-way audio

- Ensure your browser has **microphone permission** granted
- Try Chrome or Edge (best WebRTC support)
- Check that no other application is using your microphone

---

## Quick Reference

| Item | Value |
|------|-------|
| Backend URL | `http://localhost:3001` |
| Frontend URL | `http://localhost:5173` |
| Health Check | `GET http://localhost:3001/health` |
| Token Endpoint | `POST http://localhost:3001/api/token` |
| Outgoing TwiML | `POST http://localhost:3001/api/voice/outgoing` |
| Incoming TwiML | `POST http://localhost:3001/api/voice/incoming` |
| Call Status | `POST http://localhost:3001/api/voice/status` |
