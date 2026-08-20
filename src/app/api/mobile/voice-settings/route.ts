import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserFromBearer } from '@/lib/apiMobileAuth'

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

// GET: fetch voice settings for the user's default number
export async function GET(request: Request) {
    try {
        const auth = await getUserFromBearer(request)
        if (!auth.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })
        }

        const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
        const supabase = createSupabaseFor(token)

        const { data, error } = await supabase
            .from('user_phone_numbers')
            .select('call_recording_enabled, voicemail_enabled, voicemail_greeting_url')
            .eq('user_id', auth.user.id)
            .eq('is_default', true)
            .limit(1)
            .single()

        if (error || !data) {
            return NextResponse.json({
                call_recording_enabled: false,
                voicemail_enabled: false,
                voicemail_greeting_url: null,
            })
        }

        return NextResponse.json(data)
    } catch (error) {
        console.error('[Mobile Voice Settings] Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// PUT: update voice settings for the user's default number
export async function PUT(request: NextRequest) {
    try {
        const auth = await getUserFromBearer(request)
        if (!auth.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })
        }

        const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
        const supabase = createSupabaseFor(token)

        const body = await request.json()
        const updates: Record<string, unknown> = {}

        if (typeof body.call_recording_enabled === 'boolean') {
            updates.call_recording_enabled = body.call_recording_enabled
        }
        if (typeof body.voicemail_enabled === 'boolean') {
            updates.voicemail_enabled = body.voicemail_enabled
        }
        if (body.voicemail_greeting_url !== undefined) {
            updates.voicemail_greeting_url = body.voicemail_greeting_url
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
        }

        const { error } = await supabase
            .from('user_phone_numbers')
            .update(updates)
            .eq('user_id', auth.user.id)
            .eq('is_default', true)

        if (error) {
            console.error('[Mobile Voice Settings] Update error:', error)
            return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[Mobile Voice Settings] PUT error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
