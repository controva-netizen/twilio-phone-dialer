import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserFromBearer } from '@/lib/apiMobileAuth'

// Mobile variant of /api/user/recordings: Bearer auth, same Supabase data.
// Recording playback uses /api/mobile/recordings/audio (a streaming proxy).

function createSupabaseFor(userToken: string) {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
            },
            global: {
                headers: {
                    Authorization: `Bearer ${userToken}`,
                },
            },
        }
    )
}

// GET /api/mobile/recordings?type=call|voicemail
export async function GET(request: NextRequest) {
    try {
        const auth = await getUserFromBearer(request)
        if (!auth.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })
        }

        const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
        const supabase = createSupabaseFor(token)

        const url = new URL(request.url)
        const type = url.searchParams.get('type')

        let query = supabase
            .from('call_recordings')
            .select('*')
            .eq('user_id', auth.user.id)
            .order('created_at', { ascending: false })

        if (type === 'call' || type === 'voicemail') {
            query = query.eq('recording_type', type)
        }

        const { data, error } = await query

        if (error) {
            console.error('[Mobile Recordings] Fetch error:', error)
            return NextResponse.json({ error: 'Failed to fetch recordings' }, { status: 500 })
        }

        const { count } = await supabase
            .from('call_recordings')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', auth.user.id)
            .eq('recording_type', 'voicemail')
            .eq('is_read', false)

        return NextResponse.json({ recordings: data || [], unreadVoicemails: count || 0 })
    } catch (error) {
        console.error('[Mobile Recordings] Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// PATCH: mark a recording as listened
export async function PATCH(request: NextRequest) {
    try {
        const auth = await getUserFromBearer(request)
        if (!auth.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })
        }

        const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
        const supabase = createSupabaseFor(token)

        const { id } = await request.json()
        if (!id) {
            return NextResponse.json({ error: 'Recording ID required' }, { status: 400 })
        }

        const { error } = await supabase
            .from('call_recordings')
            .update({ is_read: true })
            .eq('id', id)
            .eq('user_id', auth.user.id)

        if (error) {
            return NextResponse.json({ error: 'Failed to update recording' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[Mobile Recordings] PATCH error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// DELETE /api/mobile/recordings?id=xxx
export async function DELETE(request: NextRequest) {
    try {
        const auth = await getUserFromBearer(request)
        if (!auth.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })
        }

        const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
        const supabase = createSupabaseFor(token)

        const url = new URL(request.url)
        const id = url.searchParams.get('id')
        if (!id) {
            return NextResponse.json({ error: 'Recording ID required' }, { status: 400 })
        }

        const { error } = await supabase
            .from('call_recordings')
            .delete()
            .eq('id', id)
            .eq('user_id', auth.user.id)

        if (error) {
            return NextResponse.json({ error: 'Failed to delete recording' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[Mobile Recordings] DELETE error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
