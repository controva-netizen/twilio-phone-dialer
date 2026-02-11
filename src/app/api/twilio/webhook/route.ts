import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// This route handles:
// 1. Incoming calls - routes to the correct user based on the dialed number
// 2. Outgoing calls - uses the user's default caller ID
// Twilio sends form-encoded data via POST or query params via GET.

function twimlResponse(twiml: string): NextResponse {
    console.log(`[Twilio TwiML Response]\n${twiml}`)
    return new NextResponse(twiml, {
        headers: { 'Content-Type': 'text/xml' },
    })
}

// Create a Supabase client without cookies (webhook requests come from Twilio, not browser)
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

// Extract params from either POST form data or GET query params
async function extractParams(request: NextRequest): Promise<Record<string, string>> {
    const params: Record<string, string> = {}

    if (request.method === 'POST') {
        try {
            const formData = await request.formData()
            formData.forEach((value, key) => {
                params[key] = value.toString()
            })
        } catch {
            // fallback to query params
        }
    }

    // Also check query params (GET requests or fallback)
    request.nextUrl.searchParams.forEach((value, key) => {
        if (!params[key]) {
            params[key] = value
        }
    })

    return params
}

async function handleRequest(request: NextRequest): Promise<NextResponse> {
    try {
        const params = await extractParams(request)

        const to = params['To'] || ''
        const from = params['From'] || ''
        const callSid = params['CallSid'] || ''
        const direction = params['Direction'] || ''

        console.log(`[Twilio Webhook] Direction: ${direction}, To: ${to}, From: ${from}, CallSid: ${callSid}`)

        // Outgoing call: When browser client dials a number via TwiML App,
        // Twilio sets From=client:xxx and Direction=inbound (counterintuitively).
        // We detect outgoing by checking if From starts with "client:" 
        // or if To is a phone number (not a client).
        const isOutgoing = from.startsWith('client:') || (to && !to.startsWith('client:') && direction !== 'inbound')

        if (isOutgoing) {
            return await handleOutgoingCall(to, from)
        }

        // Incoming call (from phone number to Twilio number)
        return await handleIncomingCall(to, from, request)
    } catch (error) {
        console.error('[Twilio Webhook] Error:', error)
        return twimlResponse(`
            <Response>
                <Say>An error occurred. Please try again later.</Say>
            </Response>
        `)
    }
}

// Support both GET and POST from Twilio
export async function POST(request: NextRequest) {
    return handleRequest(request)
}

export async function GET(request: NextRequest) {
    return handleRequest(request)
}

async function handleOutgoingCall(to: string, from: string): Promise<NextResponse> {
    if (!to) {
        return twimlResponse(`
            <Response>
                <Say>No destination number provided.</Say>
            </Response>
        `)
    }

    // Look up the caller's default number from Supabase
    // The "from" field is "client:userId"
    const userId = from.startsWith('client:') ? from.replace('client:', '') : ''
    let callerId = process.env.TWILIO_DEFAULT_NUMBER || ''

    if (userId) {
        const supabase = createSupabaseAdmin()
        const { data } = await supabase
            .from('user_phone_numbers')
            .select('phone_number')
            .eq('user_id', userId)
            .eq('is_default', true)
            .limit(1)
            .single()

        if (data?.phone_number) {
            callerId = data.phone_number
        }
    }

    console.log(`[Twilio Webhook] Outgoing call to ${to} with callerId ${callerId}`)

    return twimlResponse(`
        <Response>
            <Dial answerOnBridge="true" callerId="${callerId}">
                <Number>${to}</Number>
            </Dial>
        </Response>
    `)
}

async function handleIncomingCall(to: string, from: string, request: NextRequest): Promise<NextResponse> {
    const supabase = createSupabaseAdmin()

    // Find which user owns the dialed number
    const dialedNumber = to || ''

    const { data: numberRecord, error } = await supabase
        .from('user_phone_numbers')
        .select('user_id, call_recording_enabled, voicemail_enabled, voicemail_greeting_url')
        .eq('phone_number', dialedNumber)
        .limit(1)
        .single()

    if (error || !numberRecord) {
        console.warn(`[Twilio Webhook] No user found for number ${dialedNumber}, using fallback`)
        // Fallback: ring with a generic client name
        return twimlResponse(`
            <Response>
                <Dial answerOnBridge="true">
                    <Client>user</Client>
                </Dial>
            </Response>
        `)
    }

    const userId = numberRecord.user_id
    const recordEnabled = numberRecord.call_recording_enabled
    const voicemailEnabled = numberRecord.voicemail_enabled

    // Build the <Dial> verb
    const recordAttr = recordEnabled ? ' record="record-from-answer-dual"' : ''

    // Build the app base URL from the incoming request (so it uses the ngrok/deployed URL)
    const appUrl = `${request.nextUrl.protocol}//${request.headers.get('host')}`

    // If voicemail is enabled, set an action URL to handle no-answer
    const actionAttr = voicemailEnabled
        ? ` action="${appUrl}/api/twilio/voicemail?user_id=${userId}&amp;from=${encodeURIComponent(from || '')}"`
        : ''

    return twimlResponse(`
        <Response>
            <Dial answerOnBridge="true"${recordAttr}${actionAttr} timeout="25">
                <Client>${userId}</Client>
            </Dial>
        </Response>
    `)
}

