# Netro Scale

<!-- Business description to be added. -->

A browser-based phone application built with Next.js 16 and the Twilio Voice SDK. Make and receive calls directly from your browser with multi-user support, call recording, voicemail, and an optional AI voice agent that answers using a script and knowledge base you configure.

## Quick Start

```bash
npm install
npm run dev
```

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for full Twilio and Supabase configuration.

## Tech Stack

- **Next.js 16** — App Router with API routes
- **Twilio Voice SDK** — Browser-based calling
- **Supabase** — Auth, database, and RLS
- **TypeScript** — Full type safety

## AI Voice Agent

The AI voice agent ships with a neutral, general-purpose business assistant template. Before using it, open **Settings → AI Voice Agent & Script Engine** and replace the opening greeting and system prompt with your own company name, the purpose of your calls, and your FAQ / knowledge base. The agent only answers from the information you provide and hands off to a live team member when it is unsure or when the caller asks for a person.
