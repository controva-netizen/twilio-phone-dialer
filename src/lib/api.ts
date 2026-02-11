import { config } from './config';

export interface TokenResponse {
    token: string;
    identity: string;
    expiresIn?: number;
}

export async function fetchToken(): Promise<TokenResponse> {
    const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch token: ${response.status} ${response.statusText}`);
    }

    return response.json();
}
