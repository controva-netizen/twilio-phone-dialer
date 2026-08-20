import { NextResponse } from 'next/server'
import twilio from 'twilio'
import { getUserFromBearer } from '@/lib/apiMobileAuth'

const AccessToken = twilio.jwt.AccessToken
const VoiceGrant = AccessToken.VoiceGrant

// Mobile variant of /api/twilio/token. Authenticates with a Supabase Bearer
// token instead of cookies, then mints the same Twilio Voice access token.
export async function POST(request: Request) {
    try {
        const auth = await getUserFromBearer(request)
        if (!auth.user) {
            return NextResponse.json({ error: auth.message || 'Unauthorized' }, { status: auth.status })
        }

        const accountSid = process.env.TWILIO_ACCOUNT_SID
        const apiKey = process.env.TWILIO_API_KEY
        const apiSecret = process.env.TWILIO_API_SECRET
        const twimlAppSid = process.env.TWILIO_TWIML_APP_SID

        if (!accountSid || !apiKey || !apiSecret || !twimlAppSid) {
            console.error('Missing Twilio environment variables')
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
        }

        // Same identity scheme as the web client: the Supabase user UUID.
        // Incoming calls route to this identity via <Client>{userId}</Client>.
        const identity = auth.user.id

        const token = new AccessToken(accountSid, apiKey, apiSecret, {
            identity,
            ttl: 3600,
        })

        token.addGrant(
            new VoiceGrant({
                outgoingApplicationSid: twimlAppSid,
                incomingAllow: true,
            })
        )

        return NextResponse.json({
            token: token.toJwt(),
            identity,
            expiresIn: 3600,
        })
    } catch (error) {
        console.error('[Mobile Token] Error:', error)
        return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 })
    }
}
