'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { AppLayout } from '@/components/Layout';
import { CallHistoryList, RichDialer } from '@/components/Calls';
import { AutoDialer } from '@/components/AutoDialer';
import { AccessibilityPanel } from '@/components/AccessibilityPanel';
import { useTwilio } from '@/contexts/TwilioContext';
import { useCallHistory, createCallHistoryEntry } from '@/hooks/useCallHistory';
import styles from './page.module.css';

type CallFilter = 'all' | 'incoming' | 'outgoing' | 'missed';

export default function CallsPage() {
    const twilio = useTwilio();
    const { history, filter, setFilter, addEntry, clearHistory } = useCallHistory();

    const [callFilter, setCallFilter] = useState<CallFilter>('all');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [showAccessibility, setShowAccessibility] = useState(false);
    const [showAutoDialer, setShowAutoDialer] = useState(false);
    const [user, setUser] = useState<{ email?: string | null } | null>(null);

    // Track the number being called for history
    const dialedNumberRef = useRef<string>('');

    // Fetch user session
    useEffect(() => {
        const fetchUser = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
        };
        fetchUser();
    }, []);

    const isOnCall = twilio.callStatus === 'connected' || twilio.callStatus === 'connecting' || twilio.callStatus === 'ringing';

    // Handle filter change from sidebar
    const handleFilterChange = (newFilter: CallFilter) => {
        setCallFilter(newFilter);
        if (newFilter === 'all') {
            setFilter('all');
        } else if (newFilter === 'missed') {
            setFilter('missed');
        } else if (newFilter === 'incoming') {
            setFilter('incoming');
        } else if (newFilter === 'outgoing') {
            setFilter('outgoing');
        }
    };

    // Filter history based on selected filter
    const getFilteredHistory = () => {
        if (callFilter === 'all') return history;
        if (callFilter === 'missed') return history.filter(e => e.status === 'missed');
        if (callFilter === 'incoming') return history.filter(e => e.direction === 'incoming');
        if (callFilter === 'outgoing') return history.filter(e => e.direction === 'outgoing');
        return history;
    };

    // Handle making a call
    const handleCall = async (number?: string) => {
        const numberToCall = number || phoneNumber;
        if (!numberToCall.trim()) return;

        dialedNumberRef.current = numberToCall;

        const call = await twilio.makeCall(numberToCall);
        if (call) {
            twilio.setActiveCall(call, 'outgoing', numberToCall);
            setPhoneNumber('');
        }
    };

    // Handle hangup
    const handleHangup = () => {
        twilio.hangup();
    };

    // Handle missed call (when incoming call times out or caller hangs up)
    React.useEffect(() => {
        if (!twilio.incomingCall) return;

        const handleDisconnect = () => {
            if (!twilio.activeCall) {
                const params = twilio.incomingCall!.parameters as { From?: string };
                addEntry(createCallHistoryEntry(
                    'incoming',
                    params.From || 'Unknown',
                    0,
                    'missed'
                ));
            }
        };

        twilio.incomingCall.on('disconnect', handleDisconnect);
        twilio.incomingCall.on('cancel', handleDisconnect);

        return () => {
            twilio.incomingCall?.off('disconnect', handleDisconnect);
            twilio.incomingCall?.off('cancel', handleDisconnect);
        };
    }, [twilio.incomingCall, twilio.activeCall, addEntry]);

    // Handle remote party hanging up - log to history
    React.useEffect(() => {
        if (!twilio.activeCall) return;

        const handleRemoteDisconnect = () => {
            const numberForHistory = dialedNumberRef.current || twilio.remoteNumber || 'Unknown';
            addEntry(createCallHistoryEntry(
                twilio.direction || 'outgoing',
                numberForHistory,
                twilio.duration,
                'completed'
            ));
            dialedNumberRef.current = '';
        };

        twilio.activeCall.on('disconnect', handleRemoteDisconnect);

        return () => {
            twilio.activeCall?.off('disconnect', handleRemoteDisconnect);
        };
    }, [twilio.activeCall, twilio.direction, twilio.remoteNumber, twilio.duration, addEntry]);

    // Handle redial from history
    const handleRedial = (number: string) => {
        handleCall(number);
    };

    return (
        <AppLayout
            onAccessibilityClick={() => setShowAccessibility(true)}
            callFilter={callFilter}
            onCallFilterChange={handleFilterChange}
            deviceStatus={twilio.deviceStatus}
            error={twilio.deviceError}
            user={user || undefined}
        >
            {/* Accessibility Panel */}
            {showAccessibility && (
                <AccessibilityPanel onClose={() => setShowAccessibility(false)} />
            )}

            {/* Main Content */}
            <div className={styles.container}>
                {/* Rich Dialer - only in All Calls */}
                {callFilter === 'all' && (
                    <div className={styles.dialerSection}>
                        <RichDialer
                            phoneNumber={phoneNumber}
                            onPhoneNumberChange={setPhoneNumber}
                            onCall={() => handleCall()}
                            isReady={twilio.deviceStatus === 'ready'}
                        />
                        <button
                            className={`${styles.autoDialBtn} ${showAutoDialer ? styles.autoDialBtnActive : ''}`}
                            onClick={() => setShowAutoDialer(v => !v)}
                            title="Auto Dialer"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5M3.75 6.75h16.5M3.75 17.25h16.5" />
                            </svg>
                        </button>
                    </div>
                )}

                {/* Auto Dialer panel */}
                {callFilter === 'all' && showAutoDialer && (
                    <div className={styles.autoDialerSection}>
                        <AutoDialer />
                    </div>
                )}

                {/* Call History */}
                <div className={styles.content}>
                    <CallHistoryList
                        entries={getFilteredHistory()}
                        filter={callFilter}
                        onFilterChange={() => { }}
                        onCall={handleRedial}
                        onClear={clearHistory}
                        hideFilters={true}
                    />
                </div>
            </div>
        </AppLayout>
    );
}
