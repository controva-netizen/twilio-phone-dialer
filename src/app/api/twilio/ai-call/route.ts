import { NextRequest, NextResponse } from 'next/server';
import { generateInitialGreeting, DEFAULT_AI_CONFIG } from '@/lib/ai/prompts';

function escapeXml(unsafe: string): string {
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function twimlResponse(twiml: string): NextResponse {
    console.log(`[Twilio AI Entry Response]\n${twiml}`);
    return new NextResponse(twiml, {
        headers: { 'Content-Type': 'text/xml' },
    });
}

// Extract params from either POST form data or GET query params
async function extractParams(request: NextRequest): Promise<Record<string, string>> {
    const params: Record<string, string> = {};
    request.nextUrl.searchParams.forEach((value, key) => {
        params[key] = value;
    });

    if (request.method === 'POST') {
        try {
            const contentType = request.headers.get('content-type') || '';
            if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
                const formData = await request.formData();
                formData.forEach((value, key) => {
                    params[key] = value.toString();
                });
            } else if (contentType.includes('application/json')) {
                const json = await request.json();
                Object.entries(json).forEach(([k, v]) => {
                    if (v !== undefined && v !== null) params[k] = String(v);
                });
            } else {
                const rawText = await request.text();
                const searchParams = new URLSearchParams(rawText);
                searchParams.forEach((value, key) => {
                    params[key] = value;
                });
            }
        } catch (e) {
            console.error('[AI Entry] Param extraction error:', e);
        }
    }
    return params;
}

import { getPublicAppUrl } from '@/lib/url';

export async function POST(request: NextRequest) {
    return handleEntry(request);
}

export async function GET(request: NextRequest) {
    return handleEntry(request);
}

async function handleEntry(request: NextRequest): Promise<NextResponse> {
    try {
        const params = await extractParams(request);
        console.log('[AI Entry] Initiating AI call with params:', JSON.stringify(params));

        const from = params['From'] || '';
        // agentUserId is the Twilio Client identity (Supabase user UUID) that the transfer
        // will dial into. It's passed as a query param on the webhook URL we built in
        // /api/twilio/ai-call/start — must be read as 'agentUserId', not 'userId'.
        const agentUserId = from.startsWith('client:')
            ? from.replace('client:', '')
            : (params['agentUserId'] || params['userId'] || 'user');
        const callerId = params['callerId'] || process.env.TWILIO_DEFAULT_NUMBER || '+13072076444';
        const leadName = params['leadName'] || '';

        // Base URL for callback
        const appUrl = await getPublicAppUrl(request);

        // Look up this user's saved AI settings (greeting, voice, custom script) from Supabase
        let greeting = generateInitialGreeting();
        let aiVoice = 'Polly.Joanna';
        if (agentUserId && agentUserId !== 'user') {
            try {
                const { createSupabaseAdmin } = await import('@/lib/supabase/admin');
                const admin = createSupabaseAdmin();
                const { data: adminUser } = await admin.auth.admin.getUserById(agentUserId);
                const aiMeta = adminUser?.user?.user_metadata?.ai_settings;
                if (aiMeta) {
                    if (aiMeta.ai_voice) aiVoice = aiMeta.ai_voice;
                    if (aiMeta.greeting_message) {
                        greeting = aiMeta.greeting_message;
                    } else {
                        greeting = generateInitialGreeting({ companyName: DEFAULT_AI_CONFIG.companyName });
                    }
                }
            } catch (e) {
                console.warn('[AI Entry] Could not fetch user AI settings:', e);
            }
        }

        // Personalize the greeting with the lead's name when we have one
        if (leadName) {
            greeting = `Hi, is this ${leadName}? ${greeting}`;
        }

        const turnActionUrl = `${appUrl}/api/twilio/ai-call/turn?agentUserId=${encodeURIComponent(agentUserId)}&amp;callerId=${encodeURIComponent(callerId)}&amp;leadName=${encodeURIComponent(leadName)}&amp;turnCount=1`;

        return twimlResponse(`
            <Response>
                <Gather input="speech dtmf" timeout="5" speechTimeout="auto" action="${turnActionUrl}">
                    <Say voice="${aiVoice}" language="en-US">${escapeXml(greeting)}</Say>
                </Gather>
            </Response>
        `);
    } catch (error) {
        console.error('[AI Entry] Error initializing AI call:', error);
        return twimlResponse(`
            <Response>
                <Say voice="Polly.Joanna" language="en-US">Connecting your call.</Say>
                <Dial answerOnBridge="true">
                    <Client>user</Client>
                </Dial>
            </Response>
        `);
    }
}
