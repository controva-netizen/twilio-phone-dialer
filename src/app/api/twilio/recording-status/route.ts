import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Twilio calls this when a call recording is completed.
// We save the recording metadata to Supabase.

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

        // Cast needed: @types/node's global FormData shadows the DOM's and lacks get()
        const formData = await request.formData() as unknown as Record<string, string> & { forEach(cb: (value: string, key: string) => void): void }
        const recordingUrl = formData['RecordingUrl'] || null
        const recordingSid = formData['RecordingSid'] || null
        const recordingDuration = formData['RecordingDuration'] || null
        const callSid = formData['CallSid'] || null
        const recordingStatus = formData['RecordingStatus'] || null

        console.log(`[Recording Status] userId: ${userId}, status: ${recordingStatus}, sid: ${recordingSid}, duration: ${recordingDuration}s`)

        if (!userId || !recordingUrl || recordingStatus !== 'completed') {
            return NextResponse.json({ ok: true })
        }

        const supabase = createSupabaseAdmin()

        // Look up the user's phone number for context
        const { data: numberData } = await supabase
            .from('user_phone_numbers')
            .select('phone_number')
            .eq('user_id', userId)
            .eq('is_default', true)
            .limit(1)
            .single()

        const { error } = await supabase
            .from('call_recordings')
            .insert({
                user_id: userId,
                phone_number: numberData?.phone_number || '',
                caller_number: '', // We don't have this from the recording callback
                recording_url: recordingUrl,
                recording_sid: recordingSid || '',
                call_sid: callSid || '',
                duration: parseInt(recordingDuration || '0', 10),
                recording_type: 'call',
                is_read: false,
            })

        if (error) {
            console.error('[Recording Status] Failed to save recording:', error)
        } else {
            console.log(`[Recording Status] Saved call recording ${recordingSid} for user ${userId}`)
        }

        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error('[Recording Status] Error:', error)
        return NextResponse.json({ ok: true })
    }
}
