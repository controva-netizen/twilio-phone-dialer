// App configuration
export const config = {
    // URL to your Twilio Function for token generation
    twilioFunctionUrl: process.env.NEXT_PUBLIC_TWILIO_FUNCTION_URL || '',

    // Token refresh interval (in ms) - refresh 5 minutes before expiry
    tokenRefreshInterval: 55 * 60 * 1000, // 55 minutes

    // Default client identity
    clientIdentity: 'user',
};

// Validate configuration
export function validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.twilioFunctionUrl) {
        errors.push('NEXT_PUBLIC_TWILIO_FUNCTION_URL is not set');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}
