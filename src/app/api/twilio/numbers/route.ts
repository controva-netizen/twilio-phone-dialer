import { NextResponse } from 'next/server'

export async function GET() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN

    if (!accountSid || !authToken) {
        return NextResponse.json(
            { error: 'Twilio credentials not configured' },
            { status: 500 }
        )
    }

    try {
        // Fetch incoming phone numbers from Twilio API
        const response = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json`,
            {
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
                },
            }
        )

        if (!response.ok) {
            throw new Error('Failed to fetch numbers from Twilio')
        }

        const data = await response.json()

        // Map to simplified format
        const numbers = data.incoming_phone_numbers.map((num: {
            sid: string
            phone_number: string
            friendly_name: string
        }) => ({
            sid: num.sid,
            phoneNumber: num.phone_number,
            friendlyName: num.friendly_name,
        }))

        return NextResponse.json({ numbers })
    } catch (error) {
        console.error('Error fetching Twilio numbers:', error)
        return NextResponse.json(
            { error: 'Failed to fetch phone numbers' },
            { status: 500 }
        )
    }
}
