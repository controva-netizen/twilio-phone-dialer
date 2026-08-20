import { NextRequest, NextResponse } from 'next/server'
import { getUserFromBearer } from '@/lib/apiMobileAuth'

// Streams a Twilio recording to the mobile app. Expo-Audio cannot attach HTTP
// basic-auth headers, so the app plays from this proxy URL with its bearer
// token instead of hitting Twilio directly.

export async function GET(request: NextRequest) {
    try {
        const auth = await getUserFromBearer(request)
        if (!auth.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })
        }

        const url = new URL(request.url)
        const recordingUrl = url.searchParams.get('url')

        if (!recordingUrl) {
            return NextResponse.json({ error: 'Recording URL required' }, { status: 400 })
        }

        // Only allow proxying Twilio recording hosts
        const parsed = new URL(recordingUrl)
        if (!parsed.hostname.endsWith('twilio.com')) {
            return NextResponse.json({ error: 'Unsupported recording host' }, { status: 400 })
        }

        const accountSid = process.env.TWILIO_ACCOUNT_SID!
        const apiKey = process.env.TWILIO_API_KEY!
        const apiSecret = process.env.TWILIO_API_SECRET!

        if (!accountSid || !apiKey || !apiSecret) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
        }

        const authHeader = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
        const audioUrl = recordingUrl.endsWith('.mp3') ? recordingUrl : `${recordingUrl}.mp3`

        let response = await fetch(audioUrl, {
            headers: { Authorization: `Basic ${authHeader}` },
        })

        if (!response.ok) {
            // Fall back to Account SID auth
            const fallbackAuth = Buffer.from(`${accountSid}:${apiSecret}`).toString('base64')
            response = await fetch(audioUrl, {
                headers: { Authorization: `Basic ${fallbackAuth}` },
            })
        }

        if (!response.ok) {
            console.error(`[Mobile Audio Proxy] Failed to fetch recording: ${response.status}`)
            return NextResponse.json({ error: 'Failed to fetch recording' }, { status: 502 })
        }

        const audioData = await response.arrayBuffer()
        return new NextResponse(audioData, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': audioData.byteLength.toString(),
                'Cache-Control': 'private, max-age=3600',
                'Accept-Ranges': 'bytes',
            },
        })
    } catch (error) {
        console.error('[Mobile Audio Proxy] Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
