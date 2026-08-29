// Multi-Provider LLM Engine with Instant Fallbacks (Cerebras -> Replicate -> DeepSeek -> Rule Engine)

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface LLMResponse {
    text: string;
    shouldTransfer: boolean;
    provider: 'cerebras' | 'replicate' | 'deepseek' | 'openai' | 'fallback_rule';
}

// 1. Call Cerebras API (Ultra-fast Llama 3.3 70B inference)
async function callCerebras(messages: ChatMessage[], apiKey: string): Promise<string | null> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000); // 4s timeout

        const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey.trim()}`
            },
            body: JSON.stringify({
                model: 'llama3.3-70b',
                messages,
                temperature: 0.6,
                max_tokens: 150,
            }),
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!res.ok) {
            console.warn(`[LLM] Cerebras returned HTTP ${res.status}`);
            return null;
        }

        const data = await res.json();
        return data.choices?.[0]?.message?.content || null;
    } catch (e) {
        console.warn('[LLM] Cerebras error/timeout:', e);
        return null;
    }
}

// 2. Call Replicate API (Llama 3 70B / Meta Llama)
async function callReplicate(messages: ChatMessage[], apiToken: string): Promise<string | null> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000); // 6s timeout

        // Convert messages to prompt format for Replicate
        const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
        const conversationTurns = messages
            .filter(m => m.role !== 'system')
            .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
            .join('\n');

        const prompt = `${conversationTurns}\nAssistant:`;

        const res = await fetch('https://api.replicate.com/v1/models/meta/meta-llama-3-70b-instruct/predictions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiToken.trim()}`,
                'Prefer': 'wait=5'
            },
            body: JSON.stringify({
                input: {
                    prompt,
                    system_prompt: systemPrompt,
                    max_new_tokens: 150,
                    temperature: 0.6,
                }
            }),
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!res.ok) {
            console.warn(`[LLM] Replicate returned HTTP ${res.status}`);
            return null;
        }

        const data = await res.json();
        if (data.output) {
            return Array.isArray(data.output) ? data.output.join('') : String(data.output);
        }
        return null;
    } catch (e) {
        console.warn('[LLM] Replicate error/timeout:', e);
        return null;
    }
}

// 3. Call DeepSeek / Groq / OpenAI compatible API
async function callOpenAICompatible(messages: ChatMessage[], apiKey: string, baseUrl: string = 'https://api.deepseek.com/v1'): Promise<string | null> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);

        const res = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey.trim()}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages,
                temperature: 0.6,
                max_tokens: 150,
            }),
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!res.ok) return null;
        const data = await res.json();
        return data.choices?.[0]?.message?.content || null;
    } catch (e) {
        return null;
    }
}

// 4. Rule-Based Fallback Engine (guarantees call stays alive and handles objections/transfers)
function generateRuleFallback(userMessage: string): string {
    const text = userMessage.toLowerCase();

    // 1. Transfer request
    if (text.includes('human') || text.includes('person') || text.includes('agent') || text.includes('specialist') || text.includes('talk to someone') || text.includes('representative') || text.includes('supervisor') || text.includes('transfer')) {
        return "Of course! Let me connect you directly with our senior specialist right now. [TRANSFER]";
    }

    // 2. Scam objection
    if (text.includes('scam') || text.includes('fake') || text.includes('fraud') || text.includes('legit')) {
        return "I completely understand your caution, but this is a federally regulated unclaimed asset recovery for an $850,000 certified check. The mandatory $1,500 registration fee unlocks the escrow release. Let me connect you with our officer to review the file details. [TRANSFER]";
    }

    // 3. Why pay / deduct from winnings
    if (text.includes('deduct') || text.includes('take it out') || text.includes('pay first') || text.includes('why do i have to pay') || text.includes('why pay')) {
        return "Your $850,000 prize is held in a federally locked escrow account that cannot be touched until registered. Federal regulations prohibit commingling prize funds with administrative fees. Let me connect you with our senior specialist to explain. [TRANSFER]";
    }

    // 4. Cannot afford / don't have money
    if (text.includes('afford') || text.includes("don't have") || text.includes('no money') || text.includes('too expensive')) {
        return "I hear you, and that is understandable. Putting it in perspective, a $1,500 registration fee releases a certified check for $850,000, and the claims department accepts major credit cards. Let me connect you with a specialist to discuss options. [TRANSFER]";
    }

    // 5. Send in writing / official letter
    if (text.includes('in writing') || text.includes('mail') || text.includes('letter') || text.includes('paperwork') || text.includes('send me')) {
        return "You will receive a complete physical claims package with bond documents and tax forms overnighted once your claim identity is registered. Let me connect you with our specialist to get your package moving. [TRANSFER]";
    }

    // 6. Talk to lawyer / family
    if (text.includes('lawyer') || text.includes('son') || text.includes('daughter') || text.includes('family') || text.includes('wife') || text.includes('husband') || text.includes('attorney')) {
        return "That is very smart, and I encourage you to share your Claim Number with them. Since the file closes at the end of this week, let me connect you with our specialist so you have all the exact reference details. [TRANSFER]";
    }

    // 7. How did you get my number / privacy
    if (text.includes('how did you get') || text.includes('my number') || text.includes('privacy') || text.includes('who are you')) {
        return "I am Alex from the Consumer Award Resolution Bureau. The prize administrator was legally required to surrender your winner file to our asset recovery division when they could not locate you. Let me connect you with our specialist. [TRANSFER]";
    }

    // 8. What is this call about / prize details
    if (text.includes('what is this') || text.includes('how much') || text.includes('prize') || text.includes('award') || text.includes('check')) {
        return "This is regarding an unclaimed certified check for $850,000 in your name from a national sweepstakes. The file has been flagged for final review before forfeiture. Let me connect you with our specialist right now. [TRANSFER]";
    }

    // 9. Negative / Refusal
    if (text.includes('stop calling') || text.includes('not interested') || text.includes('take me off') || text.includes('do not call')) {
        return "I understand. I will note your file accordingly. Have a great rest of your day.";
    }

    // 10. Default affirmative / conversational turn
    if (text.includes('yes') || text.includes('sure') || text.includes('okay') || text.includes('go ahead') || text.includes('tell me more')) {
        return "Wonderful. Your file shows a certified check for $850,000 waiting in escrow. Let me connect you directly with our senior specialist right now to walk you through the claim verification. [TRANSFER]";
    }

    return "Thank you for sharing that. To make sure your $850,000 claim file is handled accurately, let me connect you directly with our senior recovery specialist right now. [TRANSFER]";
}

// Master LLM Dispatcher with Multi-Provider Fallbacks
export async function generateAIResponse(
    messages: ChatMessage[],
    customKeys?: {
        cerebrasKey?: string;
        replicateToken?: string;
        deepseekKey?: string;
        openaiKey?: string;
    }
): Promise<LLMResponse> {
    const cerebrasKey = customKeys?.cerebrasKey || process.env.CEREBRAS_API_KEY || '';
    const replicateToken = customKeys?.replicateToken || process.env.REPLICATE_API_TOKEN || '';
    const deepseekKey = customKeys?.deepseekKey || process.env.DEEPSEEK_API_KEY || '';
    const openaiKey = customKeys?.openaiKey || process.env.OPENAI_API_KEY || '';

    let outputText: string | null = null;
    let provider: LLMResponse['provider'] = 'fallback_rule';

    // 1. Try Cerebras first (fastest)
    if (cerebrasKey) {
        outputText = await callCerebras(messages, cerebrasKey);
        if (outputText) provider = 'cerebras';
    }

    // 2. Fallback to Replicate
    if (!outputText && replicateToken) {
        outputText = await callReplicate(messages, replicateToken);
        if (outputText) provider = 'replicate';
    }

    // 3. Fallback to DeepSeek
    if (!outputText && deepseekKey) {
        outputText = await callOpenAICompatible(messages, deepseekKey, 'https://api.deepseek.com/v1');
        if (outputText) provider = 'deepseek';
    }

    // 4. Fallback to OpenAI
    if (!outputText && openaiKey) {
        outputText = await callOpenAICompatible(messages, openaiKey, 'https://api.openai.com/v1');
        if (outputText) provider = 'openai';
    }

    // 5. If all APIs unavailable, use Rule-Based Fallback
    if (!outputText) {
        const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || '';
        outputText = generateRuleFallback(lastUserMsg);
        provider = 'fallback_rule';
    }

    // Clean text and check transfer triggers
    const cleanText = outputText.trim();
    const shouldTransfer = cleanText.includes('[TRANSFER]') || 
                           cleanText.toLowerCase().includes('connect you directly') ||
                           cleanText.toLowerCase().includes('transfer you now');

    // Remove [TRANSFER] tag from spoken audio text
    const spokenText = cleanText.replace(/\[TRANSFER\]/gi, '').trim();

    return {
        text: spokenText,
        shouldTransfer,
        provider,
    };
}
