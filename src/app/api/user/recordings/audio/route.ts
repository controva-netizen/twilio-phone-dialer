import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Proxy Twilio recording audio to the browser.
// Twilio recordings require HTTP Basic Auth (Account SID + Auth Token).

export async function GET(request: NextRequest) {
    try {
        // Verify user is authenticated
        const cookieStore = await cookies()
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() { return cookieStore.getAll() },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    },
                },
            }
        )

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const url = new URL(request.url)
        const recordingUrl = url.searchParams.get('url')

        if (!recordingUrl) {
            return NextResponse.json({ error: 'Recording URL required' }, { status: 400 })
        }

        // Fetch from Twilio with Basic Auth
        const accountSid = process.env.TWILIO_ACCOUNT_SID!
        const apiKey = process.env.TWILIO_API_KEY!
        const apiSecret = process.env.TWILIO_API_SECRET!
        const authHeader = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')

        // Ensure we request .mp3 format
        const audioUrl = recordingUrl.endsWith('.mp3') ? recordingUrl : `${recordingUrl}.mp3`

        const response = await fetch(audioUrl, {
            headers: {
                'Authorization': `Basic ${authHeader}`,
            },
        })

        if (!response.ok) {
            // Fall back to Account SID auth
            const fallbackAuth = Buffer.from(`${accountSid}:${apiSecret}`).toString('base64')
            const fallbackResponse = await fetch(audioUrl, {
                headers: {
                    'Authorization': `Basic ${fallbackAuth}`,
                },
            })

            if (!fallbackResponse.ok) {
                console.error(`[Audio Proxy] Failed to fetch recording: ${fallbackResponse.status}`)
                return NextResponse.json({ error: 'Failed to fetch recording' }, { status: 502 })
            }

            const audioData = await fallbackResponse.arrayBuffer()
            return new NextResponse(audioData, {
                headers: {
                    'Content-Type': 'audio/mpeg',
                    'Content-Length': audioData.byteLength.toString(),
                    'Cache-Control': 'private, max-age=3600',
                },
            })
        }

        const audioData = await response.arrayBuffer()
        return new NextResponse(audioData, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': audioData.byteLength.toString(),
                'Cache-Control': 'private, max-age=3600',
            },
        })
    } catch (error) {
        console.error('[Audio Proxy] Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
