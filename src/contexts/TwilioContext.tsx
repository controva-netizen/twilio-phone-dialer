'use client';

import React, { createContext, useContext, ReactNode, useCallback } from 'react';
import { Call } from '@twilio/voice-sdk';
import { useTwilioDevice } from '@/hooks/useTwilioDevice';
import { useCallState } from '@/hooks/useCallState';
import type { DeviceStatus, CallStatus, CallDirection } from '@/types';

import { CallOptions } from '@/hooks/useTwilioDevice';

interface TwilioContextValue {
    // Device
    device: ReturnType<typeof useTwilioDevice>['device'];
    deviceStatus: DeviceStatus;
    deviceError: string | null;
    incomingCall: Call | null;
    makeCall: (phoneNumber: string, callerId?: string, options?: CallOptions) => Promise<Call | null>;
    acceptIncomingCall: () => void;
    rejectIncomingCall: () => void;

    // Call state
    activeCall: Call | null;
    callStatus: CallStatus;
    isMuted: boolean;
    duration: number;
    direction: CallDirection | null;
    remoteNumber: string | null;
    setActiveCall: (call: Call | null, direction: CallDirection, explicitNumber?: string) => void;
    hangup: () => void;
    toggleMute: () => void;
    sendDTMF: (digit: string) => void;
}

const TwilioContext = createContext<TwilioContextValue | null>(null);

export function useTwilio(): TwilioContextValue {
    const context = useContext(TwilioContext);
    if (!context) {
        throw new Error('useTwilio must be used within a TwilioProvider');
    }
    return context;
}

export function TwilioProvider({ children }: { children: ReactNode }) {
    const {
        device,
        status: deviceStatus,
        error: deviceError,
        incomingCall,
        makeCall,
        acceptIncomingCall: rawAccept,
        rejectIncomingCall: rawReject,
    } = useTwilioDevice();

    const {
        activeCall,
        callStatus,
        isMuted,
        duration,
        direction,
        remoteNumber,
        setActiveCall,
        hangup,
        toggleMute,
        sendDTMF,
    } = useCallState();

    // Wrap accept to also set call state
    const acceptIncomingCall = useCallback(() => {
        if (incomingCall) {
            const params = incomingCall.parameters as { From?: string };
            const callerNumber = params.From || 'Unknown';
            rawAccept();
            setActiveCall(incomingCall, 'incoming', callerNumber);
        }
    }, [incomingCall, rawAccept, setActiveCall]);

    // Wrap reject (just pass through)
    const rejectIncomingCall = useCallback(() => {
        rawReject();
    }, [rawReject]);

    const value: TwilioContextValue = {
        device,
        deviceStatus,
        deviceError,
        incomingCall,
        makeCall,
        acceptIncomingCall,
        rejectIncomingCall,
        activeCall,
        callStatus,
        isMuted,
        duration,
        direction,
        remoteNumber,
        setActiveCall,
        hangup,
        toggleMute,
        sendDTMF,
    };

    return (
        <TwilioContext.Provider value={value}>
            {children}
        </TwilioContext.Provider>
    );
}
