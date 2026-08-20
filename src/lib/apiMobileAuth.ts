import { createClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

// Auth helper for the mobile app. The web client authenticates with Supabase
// session cookies, but React Native carries no cookies, so mobile routes accept
// the Supabase access token in the Authorization: Bearer header instead.

export interface BearerAuthResult {
    user: User | null
    status: number
    message?: string
}

export async function getUserFromBearer(request: Request): Promise<BearerAuthResult> {
    const header = request.headers.get('authorization') || ''
    const token = header.replace(/^Bearer\s+/i, '').trim()

    if (!token) {
        return { user: null, status: 401, message: 'Missing Authorization header' }
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
            },
        }
    )

    const { data, error } = await supabase.auth.getUser(token)

    if (error || !data?.user) {
        return { user: null, status: 401, message: 'Invalid or expired token' }
    }

    return { user: data.user, status: 200 }
}
