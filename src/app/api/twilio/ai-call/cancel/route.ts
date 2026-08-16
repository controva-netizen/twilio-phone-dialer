import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const callSid = body.callSid || '';

        if (!callSid) {
            return NextResponse.json({ error: 'callSid is required' }, { status: 400 });
        }

        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const apiKey = process.env.TWILIO_API_KEY;
        const apiSecret = process.env.TWILIO_API_SECRET;

        if (!accountSid || !apiKey || !apiSecret) {
            return NextResponse.json({ error: 'Twilio credentials not configured' }, { status: 500 });
        }

        const client = twilio(apiKey, apiSecret, { accountSid });

        await client.calls(callSid).update({ status: 'completed' });

        console.log(`[Campaign Cancel] Terminated call ${callSid}`);
        return NextResponse.json({ success: true, callSid });
    } catch (error: any) {
        console.error('[Campaign Cancel] Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to cancel call',
        }, { status: 500 });
    }
}
