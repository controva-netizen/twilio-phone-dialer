import { NextRequest } from 'next/server';

export async function getPublicAppUrl(request?: NextRequest): Promise<string> {
    // 1. Check environment variables
    if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes('localhost')) {
        return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
    }
    if (process.env.APP_URL && !process.env.APP_URL.includes('localhost')) {
        return process.env.APP_URL.replace(/\/$/, '');
    }

    // 2. Check if request came through public domain / proxy
    if (request) {
        const fwdHost = request.headers.get('x-forwarded-host');
        if (fwdHost && !fwdHost.includes('localhost')) {
            const proto = request.headers.get('x-forwarded-proto') || 'https';
            return `${proto}://${fwdHost}`;
        }
        const host = request.headers.get('host');
        if (host && !host.includes('localhost')) {
            const proto = request.headers.get('x-forwarded-proto') || 'https';
            return `${proto}://${host}`;
        }
    }

    // 3. Auto-detect active ngrok tunnel from local ngrok client
    try {
        const ngrokRes = await fetch('http://127.0.0.1:4040/api/tunnels', {
            signal: AbortSignal.timeout(1000),
        });
        if (ngrokRes.ok) {
            const ngrokData = await ngrokRes.json();
            const tunnels = ngrokData?.tunnels || [];
            const httpsTunnel = tunnels.find((t: any) => t.proto === 'https') || tunnels[0];
            if (httpsTunnel?.public_url) {
                return httpsTunnel.public_url.replace(/\/$/, '');
            }
        }
    } catch {}

    // 4. Default fallback domain
    return 'https://unflorid-overcaustically-cristiano.ngrok-free.dev';
}
