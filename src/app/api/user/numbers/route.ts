import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
    try {
        const supabase = await createClient()

        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Fetch user's allowed phone numbers
        const { data: numbers, error } = await supabase
            .from('user_phone_numbers')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true })

        if (error) {
            console.error('Error fetching numbers:', error)
            return NextResponse.json({ error: 'Failed to fetch phone numbers' }, { status: 500 })
        }

        return NextResponse.json({ numbers: numbers || [] })
    } catch (error) {
        console.error('Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// Update default number
export async function PUT(request: Request) {
    try {
        const supabase = await createClient()

        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { phoneNumber } = await request.json()

        // Reset all defaults for this user
        await supabase
            .from('user_phone_numbers')
            .update({ is_default: false })
            .eq('user_id', user.id)

        // Set new default
        const { error } = await supabase
            .from('user_phone_numbers')
            .update({ is_default: true })
            .eq('user_id', user.id)
            .eq('phone_number', phoneNumber)

        if (error) {
            console.error('Error updating default:', error)
            return NextResponse.json({ error: 'Failed to update default number' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
