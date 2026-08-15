import { NextRequest, NextResponse } from 'next/server';
import { generateAIResponse, ChatMessage } from '@/lib/ai/llm';
import { SENIOR_SWEEPSTAKES_SYSTEM_PROMPT } from '@/lib/ai/prompts';

function twimlResponse(twiml: string): NextResponse {
    console.log(`[Twilio AI Turn Response]\n${twiml}`);
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
            console.error('[AI Turn] Param extraction error:', e);
        }
    }
    return params;
}

export async function POST(request: NextRequest) {
    return handleTurn(request);
}

export async function GET(request: NextRequest) {
    return handleTurn(request);
}

async function handleTurn(request: NextRequest): Promise<NextResponse> {
    try {
        const params = await extractParams(request);
        console.log('[AI Turn] Received turn params:', JSON.stringify(params));

        // Customer's transcribed speech from Twilio Speech Recognition or Deepgram
        const speechResult = (params['SpeechResult'] || params['speech'] || params['Digits'] || '').trim();
        const agentUserId = params['agentUserId'] || params['userId'] || 'user';
        const callerId = params['callerId'] || process.env.TWILIO_DEFAULT_NUMBER || '+13072076444';
        const turnCount = parseInt(params['turnCount'] || '1', 10);
        const historyEncoded = params['history'] || '';

        let history: ChatMessage[] = [];
        try {
            if (historyEncoded) {
                history = JSON.parse(decodeURIComponent(historyEncoded));
            }
        } catch {}

        // Base URL for callback
        const appUrl = `${request.nextUrl.protocol}//${request.headers.get('host')}`;

        // 1. If customer was silent or no speech was recognized
        if (!speechResult) {
            if (turnCount >= 4) {
                // Max silence turns reached, transfer to human agent
                return twimlResponse(`
                    <Response>
                        <Say voice="Polly.Danielle-Neural">Let me connect you directly with our senior specialist right now.</Say>
                        <Dial answerOnBridge="true" callerId="${callerId}">
                            <Client>${agentUserId}</Client>
                        </Dial>
                    </Response>
                `);
            }

            return twimlResponse(`
                <Response>
                    <Gather input="speech dtmf" timeout="4" action="${appUrl}/api/twilio/ai-call/turn?agentUserId=${encodeURIComponent(agentUserId)}&amp;callerId=${encodeURIComponent(callerId)}&amp;turnCount=${turnCount + 1}&amp;history=${encodeURIComponent(JSON.stringify(history))}">
                        <Say voice="Polly.Danielle-Neural">I am still on the line. Are you ready to proceed with your award verification, or would you like me to connect you with an officer?</Say>
                    </Gather>
                </Response>
            `);
        }

        // 2. Add customer message to history
        history.push({ role: 'user', content: speechResult });

        // 3. Prepare full messages array for LLM
        const systemPrompt = SENIOR_SWEEPSTAKES_SYSTEM_PROMPT;
        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            ...history.slice(-8) // keep last 8 turns for context window speed
        ];

        // 4. Generate AI reply via Multi-Provider Fallback Engine (Cerebras -> Replicate -> DeepSeek -> Rule)
        const aiResponse = await generateAIResponse(messages);
        console.log(`[AI Turn] AI generated response (via ${aiResponse.provider}):`, aiResponse.text, 'shouldTransfer:', aiResponse.shouldTransfer);

        // Add assistant response to history
        history.push({ role: 'assistant', content: aiResponse.text });

        // 5. If AI or customer triggered transfer to human agent
        if (aiResponse.shouldTransfer || turnCount >= 6) {
            return twimlResponse(`
                <Response>
                    <Say voice="Polly.Danielle-Neural">${aiResponse.text}</Say>
                    <Dial answerOnBridge="true" callerId="${callerId}">
                        <Client>${agentUserId}</Client>
                    </Dial>
                </Response>
            `);
        }

        // 6. Otherwise, speak the response and gather the customer's next reply
        const nextTurn = turnCount + 1;
        const nextActionUrl = `${appUrl}/api/twilio/ai-call/turn?agentUserId=${encodeURIComponent(agentUserId)}&amp;callerId=${encodeURIComponent(callerId)}&amp;turnCount=${nextTurn}&amp;history=${encodeURIComponent(JSON.stringify(history))}`;

        return twimlResponse(`
            <Response>
                <Gather input="speech dtmf" timeout="4" speechTimeout="auto" action="${nextActionUrl}">
                    <Say voice="Polly.Danielle-Neural">${aiResponse.text}</Say>
                </Gather>
            </Response>
        `);
    } catch (error) {
        console.error('[AI Turn] Fatal error in turn handler:', error);
        const callerId = process.env.TWILIO_DEFAULT_NUMBER || '+13072076444';
        return twimlResponse(`
            <Response>
                <Say voice="Polly.Danielle-Neural">Please hold while I connect you with our senior specialist.</Say>
                <Dial answerOnBridge="true" callerId="${callerId}">
                    <Client>user</Client>
                </Dial>
            </Response>
        `);
    }
}
