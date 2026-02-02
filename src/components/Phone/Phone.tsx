'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useTwilioDevice } from '@/hooks/useTwilioDevice';
import { useCallState } from '@/hooks/useCallState';
import { useCallHistory, createCallHistoryEntry } from '@/hooks/useCallHistory';
import { Dialpad } from './Dialpad';
import { CallControls } from './CallControls';
import { CallStatus } from './CallStatus';
import { IncomingCall } from './IncomingCall';
import { CallHistory } from './CallHistory';
import { AudioSettings } from './AudioSettings';
import styles from './Phone.module.css';

export function Phone() {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [showHistory, setShowHistory] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    const { device, status: deviceStatus, error, incomingCall, makeCall, acceptIncomingCall, rejectIncomingCall } = useTwilioDevice();
    const { activeCall, callStatus, isMuted, duration, direction, remoteNumber, setActiveCall, hangup, toggleMute, sendDTMF } = useCallState();
    const { filteredHistory, filter, setFilter, addEntry, clearHistory } = useCallHistory();

    // Handle dial input
    const handleDigitPress = useCallback((digit: string) => {
        if (callStatus === 'connected') {
            sendDTMF(digit);
        } else {
            setPhoneNumber((prev) => prev + digit);
        }
    }, [callStatus, sendDTMF]);

    // Handle backspace
    const handleBackspace = useCallback(() => {
        setPhoneNumber((prev) => prev.slice(0, -1));
    }, []);

    // Handle call button
    const handleCall = useCallback(async () => {
        if (!phoneNumber.trim()) return;

        const call = await makeCall(phoneNumber);
        if (call) {
            setActiveCall(call, 'outgoing');
        }
    }, [phoneNumber, makeCall, setActiveCall]);

    // Handle hangup
    const handleHangup = useCallback(() => {
        if (activeCall) {
            // Add to history
            addEntry(createCallHistoryEntry(
                direction || 'outgoing',
                remoteNumber || phoneNumber,
                duration,
                'completed'
            ));
        }
        hangup();
        setPhoneNumber('');
    }, [activeCall, hangup, addEntry, direction, remoteNumber, phoneNumber, duration]);

    // Handle accepting incoming call
    const handleAcceptIncoming = useCallback(() => {
        if (incomingCall) {
            acceptIncomingCall();
            setActiveCall(incomingCall, 'incoming');
        }
    }, [incomingCall, acceptIncomingCall, setActiveCall]);

    // Handle rejecting incoming call
    const handleRejectIncoming = useCallback(() => {
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
    }, [incomingCall, rejectIncomingCall, addEntry]);

    // Handle history item click (redial)
    const handleHistoryCall = useCallback((number: string) => {
        setPhoneNumber(number);
        setShowHistory(false);
    }, []);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input
            if (e.target instanceof HTMLInputElement) return;

            // Number keys
            if (/^[0-9*#]$/.test(e.key)) {
                handleDigitPress(e.key);
            }
            // Backspace
            if (e.key === 'Backspace') {
                handleBackspace();
            }
            // Enter to call
            if (e.key === 'Enter' && deviceStatus === 'ready' && phoneNumber) {
                handleCall();
            }
            // Escape to hangup
            if (e.key === 'Escape' && activeCall) {
                handleHangup();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleDigitPress, handleBackspace, handleCall, handleHangup, deviceStatus, phoneNumber, activeCall]);

    // Status indicator
    const getStatusIndicator = () => {
        switch (deviceStatus) {
            case 'ready':
                return { color: 'var(--color-success)', text: 'Ready' };
            case 'connecting':
                return { color: 'var(--color-warning)', text: 'Connecting...' };
            case 'busy':
                return { color: 'var(--color-primary)', text: 'On Call' };
            case 'error':
                return { color: 'var(--color-danger)', text: 'Error' };
            default:
                return { color: 'var(--color-text-tertiary)', text: 'Offline' };
        }
    };

    const statusIndicator = getStatusIndicator();
    const isOnCall = callStatus === 'connected' || callStatus === 'connecting' || callStatus === 'ringing';

    return (
        <div className={styles.phoneContainer}>
            {/* Incoming Call Modal */}
            {incomingCall && !activeCall && (
                <IncomingCall
                    callerNumber={(incomingCall.parameters as { From?: string }).From || 'Unknown'}
                    onAccept={handleAcceptIncoming}
                    onReject={handleRejectIncoming}
                />
            )}

            {/* Phone Card */}
            <div className={`${styles.phone} glass`}>
                {/* Header */}
                <header className={styles.header}>
                    <div className={styles.headerLeft}>
                        <div
                            className={styles.statusDot}
                            style={{ backgroundColor: statusIndicator.color }}
                            aria-label={`Status: ${statusIndicator.text}`}
                        />
                        <span className={styles.statusText}>{statusIndicator.text}</span>
                    </div>
                    <div className={styles.headerRight}>
                        <button
                            className={styles.iconButton}
                            onClick={() => setShowHistory(!showHistory)}
                            aria-label="Call history"
                            title="Call history"
                        >
                            <HistoryIcon />
                        </button>
                        <button
                            className={styles.iconButton}
                            onClick={() => setShowSettings(!showSettings)}
                            aria-label="Audio settings"
                            title="Audio settings"
                        >
                            <SettingsIcon />
                        </button>
                    </div>
                </header>

                {/* Error Display */}
                {error && (
                    <div className={styles.error} role="alert">
                        {error}
                    </div>
                )}

                {/* Call Status Display */}
                {isOnCall && (
                    <CallStatus
                        status={callStatus}
                        duration={duration}
                        remoteNumber={remoteNumber || ''}
                        direction={direction || 'outgoing'}
                    />
                )}

                {/* Phone Number Display */}
                {!isOnCall && (
                    <div className={styles.display}>
                        <input
                            type="tel"
                            className={styles.numberInput}
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="Enter number"
                            aria-label="Phone number"
                        />
                        {phoneNumber && (
                            <button
                                className={styles.clearButton}
                                onClick={() => setPhoneNumber('')}
                                aria-label="Clear number"
                            >
                                ×
                            </button>
                        )}
                    </div>
                )}

                {/* Dialpad */}
                <Dialpad onDigitPress={handleDigitPress} onBackspace={handleBackspace} />

                {/* Call Controls */}
                <CallControls
                    isOnCall={isOnCall}
                    isReady={deviceStatus === 'ready'}
                    isMuted={isMuted}
                    onCall={handleCall}
                    onHangup={handleHangup}
                    onMuteToggle={toggleMute}
                    disabled={!phoneNumber.trim() && !isOnCall}
                />

                {/* Audio Settings Panel */}
                {showSettings && (
                    <div className={styles.panel}>
                        <AudioSettings device={device} onClose={() => setShowSettings(false)} />
                    </div>
                )}

                {/* Call History Panel */}
                {showHistory && (
                    <div className={styles.panel}>
                        <CallHistory
                            entries={filteredHistory}
                            filter={filter}
                            onFilterChange={setFilter}
                            onCall={handleHistoryCall}
                            onClear={clearHistory}
                            onClose={() => setShowHistory(false)}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

// Icons
function HistoryIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    );
}

function SettingsIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
    );
}
