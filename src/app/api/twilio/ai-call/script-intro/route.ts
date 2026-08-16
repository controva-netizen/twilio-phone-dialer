import { NextRequest, NextResponse } from 'next/server';

function twimlResponse(twiml: string): NextResponse {
    return new NextResponse(twiml, {
        headers: { 'Content-Type': 'text/xml' },
    });
}

export async function POST(request: NextRequest) {
    return handleScript(request);
}

export async function GET(request: NextRequest) {
    return handleScript(request);
}

async function handleScript(request: NextRequest): Promise<NextResponse> {
    const script = `Hello! Thank you for taking our call regarding your inquiry. Please hold for one second while I connect you directly with our senior specialist.`;
    return twimlResponse(`
        <Response>
            <Say voice="Polly.Danielle-Neural">${script}</Say>
        </Response>
    `);
}
