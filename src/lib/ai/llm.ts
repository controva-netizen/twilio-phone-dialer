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

// 4. Rule-Based Fallback Engine (guarantees call stays alive and transfers if needed)
function generateRuleFallback(userMessage: string): string {
    const text = userMessage.toLowerCase();
    
    if (text.includes('scam') || text.includes('pay') || text.includes('fee')) {
        return "I understand your caution completely. This is a federally regulated unclaimed asset recovery held in escrow. The registration fee is legally required for IRS tax-exempt filing. Let me connect you directly with our senior specialist right now to walk you through it. [TRANSFER]";
    }
    if (text.includes('human') || text.includes('person') || text.includes('agent') || text.includes('specialist') || text.includes('talk to someone')) {
        return "Of course! Let me connect you directly with our senior claims officer right now. [TRANSFER]";
    }
    if (text.includes('yes') || text.includes('ready') || text.includes('sure') || text.includes('ok') || text.includes('okay')) {
        return "Wonderful. Let me connect you right now with our senior specialist at our desk to finalize your claim. [TRANSFER]";
    }
    if (text.includes('no') || text.includes('stop') || text.includes('not interested') || text.includes('bye')) {
        return "I understand. If you change your mind before the Friday deadline, you can call us back with your claim number. Have a great day.";
    }

    return "Thank you for sharing that. To make sure everything is handled transparently and securely for your $950,000 claim, let me connect you with our senior claims specialist right now. [TRANSFER]";
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
