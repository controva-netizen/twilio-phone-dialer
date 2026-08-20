import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// This route handles two scenarios:
// 1. POST from Dial action (no-answer) → plays voicemail greeting and records
// 2. POST from Record action (after caller leaves a message) → saves recording to DB

function twimlResponse(twiml: string): NextResponse {
    return new NextResponse(twiml, {
        headers: { 'Content-Type': 'text/xml' },
    })
}

function createSupabaseAdmin() {
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return [] },
                setAll() { /* no-op for webhooks */ },
            },
        }
    )
}

export async function POST(request: NextRequest) {
    try {
        const url = new URL(request.url)
        const userId = url.searchParams.get('user_id')
        const callerNumber = url.searchParams.get('from') || ''
        const isSaveAction = url.searchParams.get('action') === 'save'

        // Cast needed: @types/node's global FormData shadows the DOM's and lacks get()
        const formData = await request.formData() as unknown as Record<string, string> & { forEach(cb: (value: string, key: string) => void): void }
        const dialCallStatus = formData['DialCallStatus'] || null
        const recordingUrl = formData['RecordingUrl'] || null
        const recordingSid = formData['RecordingSid'] || null
        const recordingDuration = formData['RecordingDuration'] || null
        const callSid = formData['CallSid'] || null

        console.log(`[Voicemail] userId: ${userId}, dialStatus: ${dialCallStatus}, action: ${isSaveAction ? 'save' : 'prompt'}`)

        // Scenario 2: Twilio is calling us back after recording was completed
        if (isSaveAction && recordingUrl && userId) {
            return await saveVoicemail({
                userId,
                callerNumber,
                recordingUrl,
                recordingSid: recordingSid || '',
                callSid: callSid || '',
                duration: parseInt(recordingDuration || '0', 10),
            })
        }

        // Scenario 1: Dial action callback - check if we need to go to voicemail
        // DialCallStatus will be 'no-answer', 'busy', 'failed', or 'completed'
        if (dialCallStatus === 'completed') {
            // Call was answered and completed normally, no voicemail needed
            return twimlResponse(`<Response></Response>`)
        }

        // Derive app URL from the incoming request (so it uses ngrok/deployed URL)
        const appUrl = `${request.nextUrl.protocol}//${request.headers.get('host')}`

        // Look up custom greeting
        const supabase = createSupabaseAdmin()
        let greetingUrl: string | null = null

        if (userId) {
            const { data } = await supabase
                .from('user_phone_numbers')
                .select('voicemail_greeting_url')
                .eq('user_id', userId)
                .eq('voicemail_enabled', true)
                .limit(1)
                .single()

            greetingUrl = data?.voicemail_greeting_url || null
        }

        // Build TwiML: Play greeting (or Say default), then Record
        const greetingTwiml = greetingUrl
            ? `<Play>${greetingUrl}</Play>`
            : `<Say voice="Polly.Amy">The person you are calling is not available. Please leave a message after the beep.</Say>`

        const recordActionUrl = `${appUrl}/api/twilio/voicemail?user_id=${userId}&amp;from=${encodeURIComponent(callerNumber)}&amp;action=save`

        return twimlResponse(`
            <Response>
                ${greetingTwiml}
                <Record
                    action="${recordActionUrl}"
                    maxLength="120"
                    playBeep="true"
                    transcribe="false"
                    timeout="10"
                />
                <Say voice="Polly.Amy">No message was recorded. Goodbye.</Say>
            </Response>
        `)
    } catch (error) {
        console.error('[Voicemail] Error:', error)
        return twimlResponse(`
            <Response>
                <Say>An error occurred with voicemail. Goodbye.</Say>
            </Response>
        `)
    }
}

interface SaveVoicemailParams {
    userId: string
    callerNumber: string
    recordingUrl: string
    recordingSid: string
    callSid: string
    duration: number
}

async function saveVoicemail(params: SaveVoicemailParams): Promise<NextResponse> {
    const supabase = createSupabaseAdmin()

    // Get the user's phone number for context
    const { data: numberData } = await supabase
        .from('user_phone_numbers')
        .select('phone_number')
        .eq('user_id', params.userId)
        .eq('is_default', true)
        .limit(1)
        .single()

    const { error } = await supabase
        .from('call_recordings')
        .insert({
            user_id: params.userId,
            phone_number: numberData?.phone_number || '',
            caller_number: params.callerNumber,
            recording_url: params.recordingUrl,
            recording_sid: params.recordingSid,
            call_sid: params.callSid,
            duration: params.duration,
            recording_type: 'voicemail',
            is_read: false,
        })

    if (error) {
        console.error('[Voicemail] Failed to save voicemail:', error)
    } else {
        console.log(`[Voicemail] Saved voicemail from ${params.callerNumber} for user ${params.userId}`)
    }

    return twimlResponse(`
        <Response>
            <Say voice="Polly.Amy">Thank you. Your message has been recorded. Goodbye.</Say>
        </Response>
    `)
}
