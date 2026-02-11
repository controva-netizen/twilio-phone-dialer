// App configuration
export const config = {
    // Internal API route for token generation
    tokenUrl: '/api/twilio/token',

    // Token refresh interval (in ms) - refresh 5 minutes before expiry
    tokenRefreshInterval: 55 * 60 * 1000, // 55 minutes
};
