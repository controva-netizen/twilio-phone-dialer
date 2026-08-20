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

// GET: list the signed-in user's assigned phone numbers
export async function GET(request: Request) {
    try {
        const auth = await getUserFromBearer(request)
        if (!auth.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })
        }

        // Extract the raw bearer token to enforce per-user RLS on this query
        const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
        const supabase = createSupabaseFor(token)

        const { data: numbers, error } = await supabase
            .from('user_phone_numbers')
            .select('*')
            .eq('user_id', auth.user.id)
            .order('created_at', { ascending: true })

        if (error) {
            console.error('[Mobile Numbers] Fetch error:', error)
            return NextResponse.json({ error: 'Failed to fetch phone numbers' }, { status: 500 })
        }

        return NextResponse.json({ numbers: numbers || [] })
    } catch (error) {
        console.error('[Mobile Numbers] Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// PUT: change the user's default (caller ID) number
export async function PUT(request: NextRequest) {
    try {
        const auth = await getUserFromBearer(request)
        if (!auth.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })
        }

        const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
        const supabase = createSupabaseFor(token)

        const { phoneNumber } = await request.json()

        if (!phoneNumber || typeof phoneNumber !== 'string') {
            return NextResponse.json({ error: 'phoneNumber is required' }, { status: 400 })
        }

        await supabase
            .from('user_phone_numbers')
            .update({ is_default: false })
            .eq('user_id', auth.user.id)

        const { error } = await supabase
            .from('user_phone_numbers')
            .update({ is_default: true })
            .eq('user_id', auth.user.id)
            .eq('phone_number', phoneNumber)

        if (error) {
            console.error('[Mobile Numbers] Update default error:', error)
            return NextResponse.json({ error: 'Failed to update default number' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[Mobile Numbers] PUT error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
