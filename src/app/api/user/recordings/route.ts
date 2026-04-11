import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import twilio from 'twilio'

async function createSupabaseServer() {
    const cookieStore = await cookies()
    return createServerClient(
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
}

// GET /api/user/recordings?type=call|voicemail
export async function GET(request: NextRequest) {
    try {
        const supabase = await createSupabaseServer()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const url = new URL(request.url)
        const type = url.searchParams.get('type') // 'call' | 'voicemail' | null (all)

        // Sync call recordings from Twilio API (only for call recordings, not voicemails)
        if (type === 'call' || !type) {
            await syncTwilioRecordings(supabase, user.id)
        }

        let query = supabase
            .from('call_recordings')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

        if (type === 'call' || type === 'voicemail') {
            query = query.eq('recording_type', type)
        }

        const { data, error } = await query

        if (error) {
            console.error('[Recordings] Fetch error:', error)
            return NextResponse.json({ error: 'Failed to fetch recordings' }, { status: 500 })
        }

        // Also get unread voicemail count
        const { count } = await supabase
            .from('call_recordings')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('recording_type', 'voicemail')
            .eq('is_read', false)

        return NextResponse.json({ recordings: data || [], unreadVoicemails: count || 0 })
    } catch (error) {
        console.error('[Recordings] Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/**
 * Sync call recordings from Twilio REST API into Supabase.
 * This catches recordings that the recordingStatusCallback may have missed
 * (e.g. if ngrok was down, server restarted, etc.)
 */
async function syncTwilioRecordings(supabase: ReturnType<typeof createServerClient>, userId: string) {
    try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID
        const apiKey = process.env.TWILIO_API_KEY
        const apiSecret = process.env.TWILIO_API_SECRET

        if (!accountSid || !apiKey || !apiSecret) {
            console.warn('[Recordings Sync] Missing Twilio credentials')
            return
        }

        const client = twilio(apiKey, apiSecret, { accountSid })

        // Get user's phone numbers to match recordings
        const { data: phoneNumbers } = await supabase
            .from('user_phone_numbers')
            .select('phone_number')
            .eq('user_id', userId)

        if (!phoneNumbers || phoneNumbers.length === 0) return

        // Get existing recording SIDs from DB to avoid duplicates
        const { data: existingRecordings } = await supabase
            .from('call_recordings')
            .select('recording_sid')
            .eq('user_id', userId)
            .eq('recording_type', 'call')

        const existingSids = new Set((existingRecordings || []).map((r: { recording_sid: string }) => r.recording_sid))

        // Fetch DialVerb recordings from Twilio (last 7 days)
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

        const recordings = await client.recordings.list({
            dateCreatedAfter: sevenDaysAgo,
            limit: 50,
        })

        if (recordings.length === 0) return

        // For each recording, check if it belongs to this user's calls
        const userPhoneSet = new Set(phoneNumbers.map((p: { phone_number: string }) => p.phone_number))
        const newRecordings: Array<{
            user_id: string
            phone_number: string
            caller_number: string
            recording_url: string
            recording_sid: string
            call_sid: string
            duration: number
            recording_type: string
            is_read: boolean
            created_at: string
        }> = []

        for (const rec of recordings) {
            // Skip if we already have this recording
            if (existingSids.has(rec.sid)) continue

            // Skip non-completed recordings
            if (rec.status !== 'completed') continue

            // Check if this recording's call involves the user's phone numbers
            // We need to look up the call to get the From/To
            try {
                const call = await client.calls(rec.callSid).fetch()
                const from = call.from || ''
                const to = call.to || ''

                // Check if this call is associated with the user's phone numbers
                const isUserCall = userPhoneSet.has(from) || userPhoneSet.has(to) ||
                    // Also check if the call was to a client identity (user_id)
                    to.includes(userId)

                if (!isUserCall) continue

                const callerNumber = userPhoneSet.has(from) ? to : from
                const userPhone = userPhoneSet.has(from) ? from : to

                newRecordings.push({
                    user_id: userId,
                    phone_number: userPhone,
                    caller_number: callerNumber,
                    recording_url: `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${rec.sid}`,
                    recording_sid: rec.sid,
                    call_sid: rec.callSid,
                    duration: rec.duration ? parseInt(String(rec.duration), 10) : 0,
                    recording_type: 'call',
                    is_read: false,
                    created_at: rec.dateCreated ? rec.dateCreated.toISOString() : new Date().toISOString(),
                })
            } catch (callErr) {
                // Skip recordings we can't look up
                console.warn(`[Recordings Sync] Could not fetch call ${rec.callSid}:`, callErr)
                continue
            }
        }

        if (newRecordings.length > 0) {
            const { error } = await supabase
                .from('call_recordings')
                .insert(newRecordings)

            if (error) {
                console.error('[Recordings Sync] Insert error:', error)
            } else {
                console.log(`[Recordings Sync] Synced ${newRecordings.length} recordings for user ${userId}`)
            }
        }
    } catch (error) {
        console.error('[Recordings Sync] Error:', error)
    }
}

// PATCH /api/user/recordings - Mark recording as read
export async function PATCH(request: NextRequest) {
    try {
        const supabase = await createSupabaseServer()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { id } = body

        if (!id) {
            return NextResponse.json({ error: 'Recording ID required' }, { status: 400 })
        }

        const { error } = await supabase
            .from('call_recordings')
            .update({ is_read: true })
            .eq('id', id)
            .eq('user_id', user.id)

        if (error) {
            return NextResponse.json({ error: 'Failed to update recording' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[Recordings] PATCH error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// DELETE /api/user/recordings?id=xxx
export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createSupabaseServer()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const url = new URL(request.url)
        const id = url.searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'Recording ID required' }, { status: 400 })
        }

        const { error } = await supabase
            .from('call_recordings')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id)

        if (error) {
            return NextResponse.json({ error: 'Failed to delete recording' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[Recordings] DELETE error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
