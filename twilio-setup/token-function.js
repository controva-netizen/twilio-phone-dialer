/**
 * Twilio Function: Token Generator
 * 
 * Deploy this to Twilio Functions to generate access tokens
 * without needing a custom backend server.
 * 
 * SETUP:
 * 1. Go to Twilio Console > Functions and Assets > Services
 * 2. Create a new Service (e.g., "twilio-phone-tokens")
 * 3. Add a new Function with path "/token"
 * 4. Paste this code
 * 5. In Environment Variables, add:
 *    - ACCOUNT_SID (your Account SID)
 *    - API_KEY (your API Key SID, starts with SK)
 *    - API_SECRET (your API Key Secret)
 *    - TWIML_APP_SID (your TwiML App SID, starts with AP)
 * 6. Deploy the Service
 * 7. Make the Function "Public" and copy the URL
 */

exports.handler = function(context, event, callback) {
  // Enable CORS for browser access
  const response = new Twilio.Response();
  response.appendHeader('Access-Control-Allow-Origin', '*');
  response.appendHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.appendHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.appendHeader('Content-Type', 'application/json');

  // Handle CORS preflight
  if (event.request && event.request.method === 'OPTIONS') {
    callback(null, response);
    return;
  }

  try {
    const AccessToken = Twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    // Create access token with credentials from environment
    const token = new AccessToken(
      context.ACCOUNT_SID,
      context.API_KEY,
      context.API_SECRET,
      { 
        identity: 'user',
        ttl: 3600 // 1 hour expiry
      }
    );

    // Create Voice grant
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: context.TWIML_APP_SID,
      incomingAllow: true
    });

    token.addGrant(voiceGrant);

    response.setBody({ 
      token: token.toJwt(), 
      identity: 'user',
      expiresIn: 3600
    });

    callback(null, response);
  } catch (error) {
    console.error('Token generation error:', error);
    response.setStatusCode(500);
    response.setBody({ error: 'Failed to generate token' });
    callback(null, response);
  }
};
