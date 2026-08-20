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
    makeCall: (phoneNumber: string, callerId?: string) => Promise<Call | null>;
    acceptIncomingCall: () => void;
    rejectIncomingCall: () => void;
}

export function useTwilioDevice(): UseTwilioDeviceReturn {
    const [device, setDevice] = useState<Device | null>(null);
    const [status, setStatus] = useState<DeviceStatus>('offline');
    const [error, setError] = useState<string | null>(null);
    const [incomingCall, setIncomingCall] = useState<Call | null>(null);

    const deviceRef = useRef<Device | null>(null);
    const tokenRefreshTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isDestroyed = useRef(false);

    // Initialize device with token
    const initializeDevice = useCallback(async () => {
        // Don't initialize if component is being destroyed
        if (isDestroyed.current) return;

        try {
            setStatus('connecting');
            setError(null);

            const { token } = await fetchToken();

            // Check again after async operation
            if (isDestroyed.current) return;

            // Create new device or update token
            // Check if device exists and is not destroyed before updating token
            if (deviceRef.current && deviceRef.current.state !== 'destroyed') {
                await deviceRef.current.updateToken(token);
            } else {
                // Clean up any existing destroyed device reference
                deviceRef.current = null;

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

                // Check again after async operation
                if (isDestroyed.current) {
                    newDevice.destroy();
                    return;
                }

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
            if (!isDestroyed.current) {
                setError(err instanceof Error ? err.message : 'Failed to initialize device');
                setStatus('error');
            }
        }
    }, []);

    // Make outgoing call
    const makeCall = useCallback(async (phoneNumber: string, callerId?: string): Promise<Call | null> => {
        if (!deviceRef.current || status !== 'ready') {
            setError('Device not ready');
            return null;
        }

        try {
            setStatus('busy');
            const cleanNumber = phoneNumber.trim().replace(/[\s()-]/g, '');
            console.log('[Twilio Device] Connecting outbound call to:', cleanNumber, 'callerId:', callerId);
            const call = await deviceRef.current.connect({
                params: {
                    ToNumber: cleanNumber,
                    To: cleanNumber,
                    phoneNumber: cleanNumber,
                    destination: cleanNumber,
                    called: cleanNumber,
                    callerId: callerId ? callerId.trim().replace(/[\s()-]/g, '') : '',
                    CallerId: callerId ? callerId.trim().replace(/[\s()-]/g, '') : '',
                },
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
        isDestroyed.current = false;

        if (config.tokenUrl) {
            initializeDevice();
        } else {
            setError('Token URL not configured');
            setStatus('error');
        }

        return () => {
            isDestroyed.current = true;
            if (tokenRefreshTimeout.current) {
                clearTimeout(tokenRefreshTimeout.current);
            }
            if (deviceRef.current) {
                deviceRef.current.destroy();
                deviceRef.current = null;
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
