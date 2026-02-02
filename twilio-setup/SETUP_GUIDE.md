# Twilio Console Setup Guide

This guide walks you through setting up Twilio Console for the TwilioPhone app.

## Prerequisites

You need a Twilio account with:
- Account SID and Auth Token
- An API Key (SID + Secret)
- A phone number with Voice capability
- A TwiML App

---

## Step 1: Create API Key

1. Go to [Twilio Console > Account > API Keys](https://console.twilio.com/us1/account/keys-credentials/api-keys)
2. Click **Create API Key**
3. Name it "TwilioPhone App"
4. Select **Standard** key type
5. Click **Create**
6. **Save the SID and Secret immediately** - the secret is only shown once!

---

## Step 2: Create Twilio Function (Token Generator)

1. Go to [Functions and Assets > Services](https://console.twilio.com/us1/develop/functions/services)
2. Click **Create Service**
3. Name it `twilio-phone` and click **Next**
4. Click **Add Function** (the + button)
5. Set the path to `/token`
6. Delete the default code and paste the contents of `token-function.js`
7. Click **Add** > **Environment Variables** and add:
   | Key | Value |
   |-----|-------|
   | `ACCOUNT_SID` | Your Account SID (ACxxxx) |
   | `API_KEY` | Your API Key SID (SKxxxx) |
   | `API_SECRET` | Your API Key Secret |
   | `TWIML_APP_SID` | Your TwiML App SID (APxxxx) - create this in Step 3 first |
8. Click the **Settings** icon > **Dependencies** and ensure `twilio` is listed
9. Click **Deploy All**
10. Click your `/token` function > Set **Visibility** to **Public**
11. Copy the URL (e.g., `https://twilio-phone-xxxx.twil.io/token`)

---

## Step 3: Create TwiML Bins

### Outgoing Call Bin

1. Go to [TwiML Bins](https://console.twilio.com/us1/develop/twiml-bins/twiml-bins)
2. Click **Create new TwiML Bin**
3. Name it "Outgoing Call Handler"
4. Paste the contents of `outgoing-twiml-bin.xml`
5. **Replace `+1XXXXXXXXXX` with your Twilio phone number**
6. Save and copy the URL

### Incoming Call Bin

1. Click **Create new TwiML Bin** again
2. Name it "Incoming Call Handler"
3. Paste the contents of `incoming-twiml-bin.xml`
4. Save and copy the URL

---

## Step 4: Create TwiML App

1. Go to [Voice > TwiML Apps](https://console.twilio.com/us1/develop/voice/manage/twiml-apps)
2. Click **Create new TwiML App**
3. Set:
   - **Friendly Name**: TwilioPhone
   - **Voice Request URL**: Paste your **Outgoing Call** TwiML Bin URL
   - **Method**: HTTP POST
4. Save and copy the **SID** (starts with `AP`)
5. Go back to your Twilio Function and add this SID as `TWIML_APP_SID` environment variable
6. Re-deploy the Function

---

## Step 5: Configure Phone Number

1. Go to [Phone Numbers > Active Numbers](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming)
2. Click your phone number
3. Scroll to **Voice Configuration**
4. Set **"A call comes in"** to **Webhook**
5. Paste your **Incoming Call** TwiML Bin URL
6. Set Method to **HTTP POST**
7. Save

---

## Step 6: Configure the App

Create a `.env.local` file in your project root:

```env
NEXT_PUBLIC_TWILIO_FUNCTION_URL=https://your-service-xxxx.twil.io/token
```

Replace the URL with your Twilio Function URL from Step 2.

---

## Testing

1. Run `npm run dev`
2. Open http://localhost:3000
3. Wait for "Ready" status (green indicator)
4. Make an outgoing call to test
5. Call your Twilio number from another phone to test incoming calls

---

## Troubleshooting

### "Failed to fetch token"
- Verify your Twilio Function URL is correct in `.env.local`
- Check the Function is deployed and set to Public
- Check Function logs in Twilio Console

### Status never becomes "Ready"
- Check browser console for errors
- Verify all environment variables are set in Twilio Function

### Calls don't connect
- Verify TwiML Bin URLs are correct in TwiML App and Phone Number config
- Check Twilio Debugger for errors
