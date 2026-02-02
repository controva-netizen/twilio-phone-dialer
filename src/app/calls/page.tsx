'use client';

import React, { useState, useRef } from 'react';
import { AppLayout } from '@/components/Layout';
import { CallHistoryList, IncomingCallBanner, ActiveCallPopup, RichDialer } from '@/components/Calls';
import { AccessibilityPanel } from '@/components/AccessibilityPanel';
import { useTwilioDevice } from '@/hooks/useTwilioDevice';
import { useCallState } from '@/hooks/useCallState';
import { useCallHistory, createCallHistoryEntry } from '@/hooks/useCallHistory';
import styles from './page.module.css';

type CallFilter = 'all' | 'incoming' | 'outgoing' | 'missed';

export default function CallsPage() {
    const { device, status: deviceStatus, error, incomingCall, makeCall, acceptIncomingCall, rejectIncomingCall } = useTwilioDevice();
    const { activeCall, callStatus, isMuted, duration, direction, remoteNumber, setActiveCall, hangup, toggleMute, sendDTMF } = useCallState();
    const { history, filteredHistory, filter, setFilter, addEntry, clearHistory } = useCallHistory();

    const [callFilter, setCallFilter] = useState<CallFilter>('all');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [showAccessibility, setShowAccessibility] = useState(false);

    // Track the number being called for history
    const dialedNumberRef = useRef<string>('');

    const isOnCall = callStatus === 'connected' || callStatus === 'connecting' || callStatus === 'ringing';

    // Handle filter change from sidebar
    const handleFilterChange = (newFilter: CallFilter) => {
        setCallFilter(newFilter);
        // Map to useCallHistory filter
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

        // Store the dialed number before making the call
        dialedNumberRef.current = numberToCall;

        const call = await makeCall(numberToCall);
        if (call) {
            setActiveCall(call, 'outgoing', numberToCall);
            setPhoneNumber('');
        }
    };

    // Handle hangup - just disconnect, history is logged by disconnect listener
    const handleHangup = () => {
        hangup();
    };

    // Handle accepting incoming call
    const handleAcceptIncoming = () => {
        if (incomingCall) {
            const params = incomingCall.parameters as { From?: string };
            const callerNumber = params.From || 'Unknown';
            acceptIncomingCall();
            setActiveCall(incomingCall, 'incoming', callerNumber);
        }
    };

    // Handle rejecting incoming call
    const handleRejectIncoming = () => {
        if (incomingCall) {
            const params = incomingCall.parameters as { From?: string };
            addEntry(createCallHistoryEntry(
                'incoming',
                params.From || 'Unknown',
                0,
                'rejected'
            ));
        }
        rejectIncomingCall();
    };

    // Handle missed call (when incoming call times out or caller hangs up)
    React.useEffect(() => {
        if (!incomingCall) return;

        // Listen for disconnect while ringing (missed call)
        const handleDisconnect = () => {
            if (!activeCall) {
                const params = incomingCall.parameters as { From?: string };
                addEntry(createCallHistoryEntry(
                    'incoming',
                    params.From || 'Unknown',
                    0,
                    'missed'
                ));
            }
        };

        incomingCall.on('disconnect', handleDisconnect);
        incomingCall.on('cancel', handleDisconnect);

        return () => {
            incomingCall.off('disconnect', handleDisconnect);
            incomingCall.off('cancel', handleDisconnect);
        };
    }, [incomingCall, activeCall, addEntry]);

    // Handle remote party hanging up - log to history
    React.useEffect(() => {
        if (!activeCall) return;

        const handleRemoteDisconnect = () => {
            // Log the call when it disconnects
            const numberForHistory = dialedNumberRef.current || remoteNumber || 'Unknown';
            addEntry(createCallHistoryEntry(
                direction || 'outgoing',
                numberForHistory,
                duration,
                'completed'
            ));
            dialedNumberRef.current = '';
        };

        activeCall.on('disconnect', handleRemoteDisconnect);

        return () => {
            activeCall.off('disconnect', handleRemoteDisconnect);
        };
    }, [activeCall, direction, remoteNumber, duration, addEntry]);

    // Handle redial from history
    const handleRedial = (number: string) => {
        handleCall(number);
    };

    // Status display
    const getStatusText = () => {
        switch (deviceStatus) {
            case 'ready': return 'Ready';
            case 'connecting': return 'Connecting...';
            case 'busy': return 'On Call';
            case 'error': return 'Error';
            default: return 'Offline';
        }
    };

    // Get display number for active call
    const displayNumber = remoteNumber || dialedNumberRef.current || 'Unknown';

    // Get filter label for header
    const getFilterLabel = () => {
        switch (callFilter) {
            case 'all': return 'All calls';
            case 'incoming': return 'Incoming calls';
            case 'outgoing': return 'Outgoing calls';
            case 'missed': return 'Missed calls';
            default: return 'All calls';
        }
    };

    return (
        <AppLayout
            onAccessibilityClick={() => setShowAccessibility(true)}
            callFilter={callFilter}
            onCallFilterChange={handleFilterChange}
            deviceStatus={deviceStatus}
            error={error}
        >
            {/* Accessibility Panel */}
            {showAccessibility && (
                <AccessibilityPanel onClose={() => setShowAccessibility(false)} />
            )}

            {/* Non-blocking Incoming Call Banner */}
            {incomingCall && !activeCall && (
                <IncomingCallBanner
                    callerNumber={(incomingCall.parameters as { From?: string }).From || 'Unknown'}
                    onAccept={handleAcceptIncoming}
                    onReject={handleRejectIncoming}
                />
            )}

            {/* Floating Active Call Popup */}
            {isOnCall && (
                <ActiveCallPopup
                    remoteNumber={displayNumber}
                    duration={duration}
                    isMuted={isMuted}
                    onMuteToggle={toggleMute}
                    onHangup={handleHangup}
                    onDigit={sendDTMF}
                />
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
                            isReady={deviceStatus === 'ready'}
                        />
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
