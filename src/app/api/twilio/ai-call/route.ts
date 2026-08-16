import { NextRequest, NextResponse } from 'next/server';
import { generateInitialGreeting } from '@/lib/ai/prompts';

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
        const agentUserId = from.startsWith('client:') ? from.replace('client:', '') : (params['userId'] || 'user');
        const callerId = params['callerId'] || process.env.TWILIO_DEFAULT_NUMBER || '+13072076444';

        // Base URL for callback
        const appUrl = `${request.nextUrl.protocol}//${request.headers.get('host')}`;

        // Initial Greeting from Senior Sweepstakes Recovery Script
        const greeting = generateInitialGreeting();

        const turnActionUrl = `${appUrl}/api/twilio/ai-call/turn?agentUserId=${encodeURIComponent(agentUserId)}&amp;callerId=${encodeURIComponent(callerId)}&amp;turnCount=1`;

        return twimlResponse(`
            <Response>
                <Gather input="speech dtmf" timeout="5" speechTimeout="auto" action="${turnActionUrl}">
                    <Say voice="Polly.Joanna" language="en-US">${escapeXml(greeting)}</Say>
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
