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

// Ensure phone numbers are strictly in E.164 format (+1XXXXXXXXXX)
function formatE164(phone: string): string {
    if (!phone) return ''
    const clean = phone.replace(/[^0-9+]/g, '')
    if (!clean) return ''
    if (clean.startsWith('+')) return clean
    if (clean.length === 10) return `+1${clean}`
    if (clean.length === 11 && clean.startsWith('1')) return `+${clean}`
    return `+${clean}`
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

    // 1. First check URL query params
    request.nextUrl.searchParams.forEach((value, key) => {
        params[key] = value
    })

    // 2. Parse POST body
    if (request.method === 'POST') {
        try {
            const contentType = request.headers.get('content-type') || ''
            if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
                const formData = await request.formData()
                formData.forEach((value, key) => {
                    params[key] = value.toString()
                })
            } else if (contentType.includes('application/json')) {
                const json = await request.json()
                Object.entries(json).forEach(([k, v]) => {
                    if (v !== undefined && v !== null) params[k] = String(v)
                })
            } else {
                const rawText = await request.text()
                const searchParams = new URLSearchParams(rawText)
                searchParams.forEach((value, key) => {
                    params[key] = value
                })
            }
        } catch (e) {
            console.error('[Twilio Webhook] Param extraction error:', e)
        }
    }

    return params
}

async function handleRequest(request: NextRequest): Promise<NextResponse> {
    try {
        const params = await extractParams(request)

        console.log('[Twilio Webhook] Received params:', JSON.stringify(params))

        const from = params['From'] || ''
        const direction = params['Direction'] || ''
        const callSid = params['CallSid'] || ''

        // Check all possible parameters for the destination number
        let to = params['ToNumber'] || 
                 params['phoneNumber'] || 
                 params['PhoneNumber'] || 
                 params['called'] || 
                 params['Called'] || 
                 params['destination'] || 
                 params['number'] || 
                 params['phone_number'] || 
                 params['To'] || 
                 ''

        // If 'to' is a TwiML App SID (starts with AP) or 'client:', look for the real destination number
        if (to.startsWith('AP') || to.startsWith('client:') || !to) {
            const possibleKeys = ['ToNumber', 'phoneNumber', 'PhoneNumber', 'called', 'Called', 'destination', 'number', 'phone_number']
            for (const key of possibleKeys) {
                if (params[key] && !params[key].startsWith('AP') && !params[key].startsWith('client:')) {
                    to = params[key]
                    break
                }
            }
            // If still not found, check any param with digits
            if (to.startsWith('AP') || to.startsWith('client:') || !to) {
                const digitParam = Object.entries(params).find(([k, v]) => 
                    !v.startsWith('AP') && 
                    !v.startsWith('client:') && 
                    !v.startsWith('CA') && 
                    !v.startsWith('AC') && 
                    v.replace(/[^0-9]/g, '').length >= 3
                )
                if (digitParam) {
                    to = digitParam[1]
                }
            }
        }

        console.log(`[Twilio Webhook] Direction: ${direction}, Resolved To: ${to}, From: ${from}, CallSid: ${callSid}`)

        // Outgoing call: When browser client dials via TwiML App,
        // From starts with "client:" (e.g. client:user_id or client:anonymous)
        const isOutgoing = from.startsWith('client:') || direction === 'outbound-api' || (to && !to.startsWith('client:') && !to.startsWith('AP') && direction !== 'inbound')

        if (isOutgoing) {
            return await handleOutgoingCall(to, from, params)
        }

        // Incoming call (from phone number to Twilio number)
        return await handleIncomingCall(to, from, request)
    } catch (error) {
        console.error('[Twilio Webhook] Error:', error)
        return twimlResponse(`
            <Response>
                <Say>An error occurred. Please check server logs.</Say>
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

async function handleOutgoingCall(to: string, from: string, params: Record<string, string>): Promise<NextResponse> {
    if (!to || to.startsWith('AP') || to.startsWith('client:')) {
        console.error('[Twilio Webhook] No valid destination number in params:', params)
        return twimlResponse(`
            <Response>
                <Say>No destination number was provided. Please check the dialed number and try again.</Say>
            </Response>
        `)
    }

    const cleanTo = formatE164(to)

    // 1. Check if callerId was explicitly sent in params from the client
    let callerId = params['callerId'] || 
                   params['CallerId'] || 
                   params['fromNumber'] || 
                   params['FromNumber'] || 
                   process.env.TWILIO_DEFAULT_NUMBER || 
                   process.env.TWILIO_PHONE_NUMBER || 
                   process.env.TWILIO_CALLER_ID || 
                   ''

    // 2. Look up the caller's default number from Supabase
    const userId = from.startsWith('client:') ? from.replace('client:', '') : ''
    if (userId) {
        try {
            const supabase = createSupabaseAdmin()
            
            // Check user's default number
            const { data: defaultData } = await supabase
                .from('user_phone_numbers')
                .select('phone_number')
                .eq('user_id', userId)
                .eq('is_default', true)
                .limit(1)
                .single()

            if (defaultData?.phone_number) {
                callerId = defaultData.phone_number
            } else {
                // Check any assigned number for this user
                const { data: anyData } = await supabase
                    .from('user_phone_numbers')
                    .select('phone_number')
                    .eq('user_id', userId)
                    .limit(1)
                    .single()

                if (anyData?.phone_number) {
                    callerId = anyData.phone_number
                }
            }
        } catch (e) {
            console.error('[Twilio Webhook] Error fetching callerId from Supabase:', e)
        }
    }

    // 3. Fallback to any number in user_phone_numbers if still empty
    if (!callerId) {
        try {
            const supabase = createSupabaseAdmin()
            const { data: fallbackData } = await supabase
                .from('user_phone_numbers')
                .select('phone_number')
                .limit(1)
                .single()

            if (fallbackData?.phone_number) {
                callerId = fallbackData.phone_number
            }
        } catch {}
    }

    // Format callerId to strict E.164 format (+1XXXXXXXXXX)
    callerId = formatE164(callerId)

    console.log(`[Twilio Webhook] Outgoing call to ${cleanTo} with callerId ${callerId}`)

    // If callerId is STILL empty or invalid, notify user gracefully via audio instead of throwing Error 13214
    if (!callerId) {
        console.error('[Twilio Webhook] Error: Invalid/missing callerId. CallerId is empty.')
        return twimlResponse(`
            <Response>
                <Say>Unable to place call. No verified Twilio caller ID was found. Please set your default phone number in Settings or check TWILIO_DEFAULT_NUMBER.</Say>
            </Response>
        `)
    }
    
    return twimlResponse(`
        <Response>
            <Dial answerOnBridge="true" callerId="${callerId}">
                <Number>${cleanTo}</Number>
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

    // Build the app base URL from the incoming request
    const appUrl = `${request.nextUrl.protocol}//${request.headers.get('host')}`

    // Build the <Dial> verb attributes
    const recordAttr = recordEnabled ? ' record="record-from-answer-dual"' : ''
    const recordCallbackAttr = recordEnabled
        ? ` recordingStatusCallback="${appUrl}/api/twilio/recording-status?user_id=${userId}" recordingStatusCallbackEvent="completed"`
        : ''

    // If voicemail is enabled, set an action URL to handle no-answer
    const actionAttr = voicemailEnabled
        ? ` action="${appUrl}/api/twilio/voicemail?user_id=${userId}&amp;from=${encodeURIComponent(from || '')}"`
        : ''

    return twimlResponse(`
        <Response>
            <Say voice="Polly.Sofia">Thank you for calling. Please hold while we connect your call.</Say>
            <Dial answerOnBridge="true"${recordAttr}${recordCallbackAttr}${actionAttr} timeout="25">
                <Client>${userId}</Client>
            </Dial>
        </Response>
    `)
}
