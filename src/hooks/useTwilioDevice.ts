'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Device, Call } from '@twilio/voice-sdk';
import { fetchToken } from '@/lib/api';
import { config } from '@/lib/config';
import type { DeviceStatus } from '@/types';

interface UseTwilioDeviceReturn {
    device: Device | null;
    status: DeviceStatus;
    error: string | null;
    incomingCall: Call | null;
    makeCall: (phoneNumber: string) => Promise<Call | null>;
    acceptIncomingCall: () => void;
    rejectIncomingCall: () => void;
}

export function useTwilioDevice(): UseTwilioDeviceReturn {
    const [device, setDevice] = useState<Device | null>(null);
    const [status, setStatus] = useState<DeviceStatus>('offline');
    const [error, setError] = useState<string | null>(null);
    const [incomingCall, setIncomingCall] = useState<Call | null>(null);

    const deviceRef = useRef<Device | null>(null);
    const tokenRefreshTimeout = useRef<NodeJS.Timeout | null>(null);

    // Initialize device with token
    const initializeDevice = useCallback(async () => {
        try {
            setStatus('connecting');
            setError(null);

            const { token } = await fetchToken();

            // Create new device or update token
            if (deviceRef.current) {
                await deviceRef.current.updateToken(token);
            } else {
                const newDevice = new Device(token, {
                    codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
                    allowIncomingWhileBusy: false,
                });

                // Register device event listeners
                newDevice.on('registered', () => {
                    setStatus('ready');
                    setError(null);
                });

                newDevice.on('error', (deviceError) => {
                    console.error('Device error:', deviceError);
                    setError(deviceError.message || 'Device error occurred');
                    setStatus('error');
                });

                newDevice.on('incoming', (call: Call) => {
                    setIncomingCall(call);
                    setStatus('busy');

                    call.on('cancel', () => {
                        setIncomingCall(null);
                        setStatus('ready');
                    });

                    call.on('disconnect', () => {
                        setIncomingCall(null);
                        setStatus('ready');
                    });
                });

                newDevice.on('unregistered', () => {
                    setStatus('offline');
                });

                // Register the device
                await newDevice.register();

                deviceRef.current = newDevice;
                setDevice(newDevice);
            }

            // Schedule token refresh
            if (tokenRefreshTimeout.current) {
                clearTimeout(tokenRefreshTimeout.current);
            }
            tokenRefreshTimeout.current = setTimeout(() => {
                initializeDevice();
            }, config.tokenRefreshInterval);

        } catch (err) {
            console.error('Failed to initialize device:', err);
            setError(err instanceof Error ? err.message : 'Failed to initialize device');
            setStatus('error');
        }
    }, []);

    // Make outgoing call
    const makeCall = useCallback(async (phoneNumber: string): Promise<Call | null> => {
        if (!deviceRef.current || status !== 'ready') {
            setError('Device not ready');
            return null;
        }

        try {
            setStatus('busy');
            const call = await deviceRef.current.connect({
                params: { To: phoneNumber },
            });

            call.on('disconnect', () => {
                setStatus('ready');
            });

            call.on('cancel', () => {
                setStatus('ready');
            });

            return call;
        } catch (err) {
            console.error('Failed to make call:', err);
            setError(err instanceof Error ? err.message : 'Failed to make call');
            setStatus('ready');
            return null;
        }
    }, [status]);

    // Accept incoming call
    const acceptIncomingCall = useCallback(() => {
        if (incomingCall) {
            incomingCall.accept();
        }
    }, [incomingCall]);

    // Reject incoming call
    const rejectIncomingCall = useCallback(() => {
        if (incomingCall) {
            incomingCall.reject();
            setIncomingCall(null);
            setStatus('ready');
        }
    }, [incomingCall]);

    // Initialize on mount
    useEffect(() => {
        if (config.twilioFunctionUrl) {
            initializeDevice();
        } else {
            setError('Twilio Function URL not configured');
            setStatus('error');
        }

        return () => {
            if (tokenRefreshTimeout.current) {
                clearTimeout(tokenRefreshTimeout.current);
            }
            if (deviceRef.current) {
                deviceRef.current.destroy();
            }
        };
    }, [initializeDevice]);

    return {
        device,
        status,
        error,
        incomingCall,
        makeCall,
        acceptIncomingCall,
        rejectIncomingCall,
    };
}
