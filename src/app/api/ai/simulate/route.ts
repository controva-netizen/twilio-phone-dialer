import { NextRequest, NextResponse } from 'next/server';
import { generateAIResponse, ChatMessage } from '@/lib/ai/llm';
import { DEFAULT_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdmin } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
    try {
        const start = Date.now();
        const body = await request.json();
        const userMessage = (body.message || '').trim();
        const history: ChatMessage[] = body.history || [];

        if (!userMessage) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        // 1. Fetch user's custom system prompt and API keys from Supabase if logged in
        let systemPrompt = DEFAULT_SYSTEM_PROMPT;
        let userKeys: { cerebrasKey?: string; replicateToken?: string } = {};

        try {
            const supabase = await createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const admin = createSupabaseAdmin();
                const { data: adminUser } = await admin.auth.admin.getUserById(user.id);
                const aiMeta = adminUser?.user?.user_metadata?.ai_settings;
                if (aiMeta) {
                    if (aiMeta.system_prompt) systemPrompt = aiMeta.system_prompt;
                    userKeys = {
                        cerebrasKey: aiMeta.cerebras_api_key,
                        replicateToken: aiMeta.replicate_api_token,
                    };
                }
            }
        } catch (e) {
            console.warn('[AI Simulate] Auth check notice:', e);
        }

        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            ...history.slice(-8),
            { role: 'user', content: userMessage }
        ];

        // 2. Generate response via LLM fallback chain
        const aiResponse = await generateAIResponse(messages, userKeys);
        const latencyMs = Date.now() - start;

        return NextResponse.json({
            reply: aiResponse.text,
            shouldTransfer: aiResponse.shouldTransfer,
            provider: aiResponse.provider,
            latencyMs,
        });
    } catch (error) {
        console.error('[AI Simulate] Error:', error);
        return NextResponse.json({
            reply: "I understand. Let me connect you directly with a member of our team right now.",
            shouldTransfer: true,
            provider: 'fallback_rule',
            latencyMs: 10,
        });
    }
}
