import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: Fetch voice settings for the user's default number
export async function GET() {
    try {
        const supabase = await createClient()

        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data, error } = await supabase
            .from('user_phone_numbers')
            .select('call_recording_enabled, voicemail_enabled, voicemail_greeting_url')
            .eq('user_id', user.id)
            .eq('is_default', true)
            .limit(1)
            .single()

        if (error) {
            // If no default number, return defaults
            return NextResponse.json({
                call_recording_enabled: false,
                voicemail_enabled: false,
                voicemail_greeting_url: null,
            })
        }

        return NextResponse.json(data)
    } catch (error) {
        console.error('Error fetching voice settings:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// PUT: Update voice settings for the user's default number
export async function PUT(request: Request) {
    try {
        const supabase = await createClient()

        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

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

        const { error } = await supabase
            .from('user_phone_numbers')
            .update(updates)
            .eq('user_id', user.id)
            .eq('is_default', true)

        if (error) {
            console.error('Error updating voice settings:', error)
            return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
