# Netro Scale - Call Flow Diagrams

## Login & Authentication

```mermaid
sequenceDiagram
    participant User as Browser
    participant MW as Middleware
    participant Login as /login
    participant Supa as Supabase Auth
    participant App as /calls

    User->>MW: Visit any page
    MW->>Supa: Check session (getUser)
    alt No session
        MW-->>User: Redirect to /login
        User->>Login: Enter email + password
        Login->>Supa: signInWithPassword()
        Supa-->>Login: Session + User
        Login-->>User: Redirect to /calls
    else Has session
        MW-->>App: Allow through
        App->>App: Fetch token, init Twilio Device
    end
```

---

## Twilio Device Initialization

```mermaid
sequenceDiagram
    participant Browser
    participant TokenAPI as /api/twilio/token
    participant Supa as Supabase
    participant Twilio as Twilio Cloud

    Browser->>TokenAPI: POST (with auth cookie)
    TokenAPI->>Supa: getUser() → get user.id
    TokenAPI->>TokenAPI: Generate JWT with VoiceGrant
    Note over TokenAPI: Identity = user.id (UUID)
    TokenAPI-->>Browser: { token, identity }
    Browser->>Twilio: Register Device with token
    Twilio-->>Browser: Device "Ready"
```

---

## Outgoing Call

```mermaid
sequenceDiagram
    participant User as Browser Client
    participant Twilio as Twilio Cloud
    participant Webhook as /api/twilio/webhook
    participant Supa as Supabase
    participant Phone as Destination Phone

    User->>Twilio: device.connect({ To: "+1234567890" })
    Note over Twilio: TwiML App triggers webhook
    Twilio->>Webhook: POST (From=client:userId, To=+1234567890)
    Webhook->>Webhook: Detect outgoing (From starts with "client:")
    Webhook->>Supa: Look up user's default number
    Supa-->>Webhook: phone_number (caller ID)
    Webhook-->>Twilio: TwiML Response
    Note over Webhook: Dial answerOnBridge="true"<br/>callerId="+1XXXXXXXXXX"<br/>Number: +1234567890
    Twilio->>Phone: Ring destination phone
    Phone-->>Twilio: Answer
    Twilio-->>User: Audio bridge established
```

---

## Incoming Call

```mermaid
sequenceDiagram
    participant Caller as External Phone
    participant Twilio as Twilio Cloud
    participant Webhook as /api/twilio/webhook
    participant Supa as Supabase
    participant User as Browser Client

    Caller->>Twilio: Calls +13072075599
    Twilio->>Webhook: POST (To=+13072075599, From=+caller)
    Webhook->>Supa: Look up user by phone_number
    Supa-->>Webhook: user_id, recording/voicemail settings
    Webhook-->>Twilio: TwiML Response
    Note over Webhook: Dial answerOnBridge="true"<br/>Client: userId<br/>+ record & voicemail attrs
    Twilio->>User: Incoming call event
    User->>User: Show Accept/Reject UI

    alt User accepts
        User-->>Twilio: Accept call
        Twilio-->>Caller: Audio bridge established
    else User rejects or no answer (25s timeout)
        User-->>Twilio: Reject / timeout
        Note over Twilio: Check voicemail setting
    end
```

---

## Voicemail Flow

```mermaid
sequenceDiagram
    participant Caller as External Phone
    participant Twilio as Twilio Cloud
    participant VM as /api/twilio/voicemail
    participant Supa as Supabase

    Note over Twilio: Call unanswered (no-answer/busy)
    Twilio->>VM: POST (DialCallStatus=no-answer, user_id, from)
    VM->>Supa: Check for custom greeting URL
    Supa-->>VM: voicemail_greeting_url (or null)

    alt Custom greeting exists
        VM-->>Twilio: TwiML: Play greeting URL
    else No custom greeting
        VM-->>Twilio: TwiML: Say "Please leave a message..."
    end

    Note over Twilio: Play greeting → beep → record
    Caller->>Twilio: Leaves voice message
    Twilio->>VM: POST (action=save, RecordingUrl, duration)
    VM->>Supa: INSERT into call_recordings
    Note over Supa: recording_type = "voicemail"<br/>is_read = false
    Supa-->>VM: Success
    VM-->>Twilio: TwiML: Say "Message recorded. Goodbye."
    Twilio-->>Caller: Hang up
```

---

## Call Recording

```mermaid
sequenceDiagram
    participant Twilio as Twilio Cloud
    participant Webhook as /api/twilio/webhook
    participant Supa as Supabase

    Note over Webhook: During incoming call setup
    Webhook->>Supa: Check call_recording_enabled
    Supa-->>Webhook: true

    Webhook-->>Twilio: TwiML with record="record-from-answer-dual"
    Note over Twilio: Records both sides<br/>from answer to hangup
    Note over Twilio: Recording stored on Twilio servers
```

---

## Complete System Overview

```mermaid
flowchart TB
    subgraph Browser
        A[Login Page] --> B[Supabase Auth]
        B --> C[Calls Page]
        C --> D[Twilio Device]
    end

    subgraph "Next.js API Routes"
        E["/api/twilio/token"]
        F["/api/twilio/webhook"]
        G["/api/twilio/voicemail"]
        H["/api/user/numbers"]
        I["/api/user/voice-settings"]
    end

    subgraph Supabase
        J[(user_phone_numbers)]
        K[(call_recordings)]
        L[Auth]
    end

    subgraph "Twilio Cloud"
        M[TwiML App]
        N[Phone Numbers]
    end

    D -->|"POST /api/twilio/token"| E
    E -->|"Verify session"| L
    D -->|"Outgoing call"| M
    M -->|"Webhook"| F
    N -->|"Incoming call"| F
    F -->|"Lookup user"| J
    F -->|"No answer"| G
    G -->|"Save voicemail"| K
    C -->|"Settings"| H
    C -->|"Settings"| I
    H -->|"Read/Write"| J
    I -->|"Read/Write"| J
```
