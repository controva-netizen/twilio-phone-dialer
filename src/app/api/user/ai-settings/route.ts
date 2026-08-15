import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SENIOR_SWEEPSTAKES_SYSTEM_PROMPT, DEFAULT_SWEEPSTAKES_CONFIG } from '@/lib/ai/prompts';

interface UserAISettings {
    replicate_api_token: string;
    cerebras_api_key: string;
    deepgram_api_key: string;
    cartesia_api_key: string;
    ai_voice: string;
    system_prompt: string;
    transfer_keywords: string;
    max_turns: number;
}

const DEFAULT_AI_SETTINGS: UserAISettings = {
    replicate_api_token: '',
    cerebras_api_key: '',
    deepgram_api_key: '',
    cartesia_api_key: '',
    ai_voice: 'Polly.Danielle-Neural',
    system_prompt: SENIOR_SWEEPSTAKES_SYSTEM_PROMPT,
    transfer_keywords: DEFAULT_SWEEPSTAKES_CONFIG.transferKeywords.join(', '),
    max_turns: 6,
};

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        // Return default settings if unauthenticated or not yet configured
        if (!user) {
            return NextResponse.json(DEFAULT_AI_SETTINGS);
        }

        // Try querying custom ai_settings or user metadata
        const { data: meta } = await supabase
            .from('user_ai_settings')
            .select('*')
            .eq('user_id', user.id)
            .limit(1)
            .single();

        if (meta) {
            return NextResponse.json({
                ...DEFAULT_AI_SETTINGS,
                ...meta,
            });
        }

        return NextResponse.json(DEFAULT_AI_SETTINGS);
    } catch (e) {
        console.error('[AI Settings] Fetch error:', e);
        return NextResponse.json(DEFAULT_AI_SETTINGS);
    }
}

export async function PUT(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();

        // Try upserting to user_ai_settings table
        try {
            await supabase
                .from('user_ai_settings')
                .upsert({
                    user_id: user.id,
                    ...body,
                    updated_at: new Date().toISOString(),
                });
        } catch {}

        return NextResponse.json({ success: true, settings: body });
    } catch (error) {
        console.error('[AI Settings] Update error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
