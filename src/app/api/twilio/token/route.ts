import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import twilio from 'twilio'

const AccessToken = twilio.jwt.AccessToken
const VoiceGrant = AccessToken.VoiceGrant

export async function POST() {
    try {
        const supabase = await createClient()

        // Authenticate the user
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Validate Twilio env vars
        const accountSid = process.env.TWILIO_ACCOUNT_SID
        const apiKey = process.env.TWILIO_API_KEY
        const apiSecret = process.env.TWILIO_API_SECRET
        const twimlAppSid = process.env.TWILIO_TWIML_APP_SID

        if (!accountSid || !apiKey || !apiSecret || !twimlAppSid) {
            console.error('Missing Twilio environment variables')
            return NextResponse.json(
                { error: 'Server configuration error' },
                { status: 500 }
            )
        }

        // Use the Supabase user ID as the Twilio client identity
        // This allows Twilio to route calls to specific users
        const identity = user.id

        // Create access token
        const token = new AccessToken(accountSid, apiKey, apiSecret, {
            identity,
            ttl: 3600, // 1 hour
        })

        // Create Voice grant
        const voiceGrant = new VoiceGrant({
            outgoingApplicationSid: twimlAppSid,
            incomingAllow: true,
        })

        token.addGrant(voiceGrant)

        return NextResponse.json({
            token: token.toJwt(),
            identity,
            expiresIn: 3600,
        })
    } catch (error) {
        console.error('Token generation error:', error)
        return NextResponse.json(
            { error: 'Failed to generate token' },
            { status: 500 }
        )
    }
}
