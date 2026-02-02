'use client';

import React, { useState, useCallback, useEffect } from 'react';
import styles from './DialerBar.module.css';

interface DialerBarProps {
    onCall: (phoneNumber: string) => void;
    isOnCall: boolean;
    isReady: boolean;
    isMuted?: boolean;
    duration?: number;
    remoteNumber?: string;
    onHangup?: () => void;
    onMuteToggle?: () => void;
}

export function DialerBar({
    onCall,
    isOnCall,
    isReady,
    isMuted = false,
    duration = 0,
    remoteNumber = '',
    onHangup,
    onMuteToggle,
}: DialerBarProps) {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [showDialpad, setShowDialpad] = useState(false);

    const handleCall = useCallback(() => {
        if (phoneNumber.trim()) {
            onCall(phoneNumber);
            setPhoneNumber('');
        }
    }, [phoneNumber, onCall]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && isReady && phoneNumber.trim()) {
            handleCall();
        }
    }, [handleCall, isReady, phoneNumber]);

    const handleDigitPress = useCallback((digit: string) => {
        setPhoneNumber((prev) => prev + digit);
    }, []);

    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Close dialpad on escape
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setShowDialpad(false);
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, []);

    if (isOnCall) {
        return (
            <div className={`${styles.bar} ${styles.onCall}`}>
                <div className={styles.callInfo}>
                    <div className={styles.callStatus}>
                        <span className={styles.statusDot} />
                        <span className={styles.callNumber}>{remoteNumber}</span>
                    </div>
                    <span className={styles.callDuration}>{formatDuration(duration)}</span>
                </div>

                <div className={styles.callControls}>
                    <button
                        className={`${styles.controlBtn} ${isMuted ? styles.muted : ''}`}
                        onClick={onMuteToggle}
                        aria-label={isMuted ? 'Unmute' : 'Mute'}
                        title={isMuted ? 'Unmute' : 'Mute'}
                    >
                        {isMuted ? <MicOffIcon /> : <MicIcon />}
                    </button>

                    <button
                        className={`${styles.controlBtn} ${styles.dialpadBtn}`}
                        onClick={() => setShowDialpad(!showDialpad)}
                        aria-label="Show dialpad"
                        title="Dialpad"
                    >
                        <DialpadIcon />
                    </button>

                    <button
                        className={`${styles.hangupBtn}`}
                        onClick={onHangup}
                        aria-label="End call"
                        title="End call"
                    >
                        <HangupIcon />
                    </button>
                </div>

                {/* Dialpad Popup */}
                {showDialpad && (
                    <div className={styles.dialpadPopup}>
                        <DialpadGrid onDigitPress={handleDigitPress} />
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={styles.bar}>
            <div className={styles.inputWrapper}>
                <PhoneIcon />
                <input
                    type="tel"
                    className={styles.input}
                    placeholder="Enter phone number"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    onKeyDown={handleKeyDown}
                    aria-label="Phone number"
                />
                {phoneNumber && (
                    <button
                        className={styles.clearBtn}
                        onClick={() => setPhoneNumber('')}
                        aria-label="Clear"
                    >
                        <CloseIcon />
                    </button>
                )}
            </div>

            <button
                className={styles.dialpadToggle}
                onClick={() => setShowDialpad(!showDialpad)}
                aria-label="Show dialpad"
                title="Dialpad"
            >
                <DialpadIcon />
            </button>

            <button
                className={`${styles.callBtn} ${isReady && phoneNumber.trim() ? styles.ready : ''}`}
                onClick={handleCall}
                disabled={!isReady || !phoneNumber.trim()}
                aria-label="Start call"
            >
                <CallIcon />
                <span>Call</span>
            </button>

            {/* Dialpad Popup */}
            {showDialpad && (
                <div className={styles.dialpadPopup}>
                    <DialpadGrid onDigitPress={handleDigitPress} />
                </div>
            )}
        </div>
    );
}

// Dialpad Grid
function DialpadGrid({ onDigitPress }: { onDigitPress: (digit: string) => void }) {
    const dialpadButtons = [
        { digit: '1', letters: '' },
        { digit: '2', letters: 'ABC' },
        { digit: '3', letters: 'DEF' },
        { digit: '4', letters: 'GHI' },
        { digit: '5', letters: 'JKL' },
        { digit: '6', letters: 'MNO' },
        { digit: '7', letters: 'PQRS' },
        { digit: '8', letters: 'TUV' },
        { digit: '9', letters: 'WXYZ' },
        { digit: '*', letters: '' },
        { digit: '0', letters: '+' },
        { digit: '#', letters: '' },
    ];

    return (
        <div className={styles.dialpadGrid}>
            {dialpadButtons.map(({ digit, letters }) => (
                <button
                    key={digit}
                    className={styles.dialpadKey}
                    onClick={() => onDigitPress(digit)}
                    aria-label={digit}
                >
                    <span className={styles.keyDigit}>{digit}</span>
                    {letters && <span className={styles.keyLetters}>{letters}</span>}
                </button>
            ))}
        </div>
    );
}

// Icons
function PhoneIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
    );
}

function CallIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
        </svg>
    );
}

function HangupIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71s-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 0 0-2.67-1.85.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
        </svg>
    );
}

function MicIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
    );
}

function MicOffIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
    );
}

function DialpadIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="4" cy="4" r="1.5" fill="currentColor" />
            <circle cx="12" cy="4" r="1.5" fill="currentColor" />
            <circle cx="20" cy="4" r="1.5" fill="currentColor" />
            <circle cx="4" cy="12" r="1.5" fill="currentColor" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            <circle cx="20" cy="12" r="1.5" fill="currentColor" />
            <circle cx="4" cy="20" r="1.5" fill="currentColor" />
            <circle cx="12" cy="20" r="1.5" fill="currentColor" />
            <circle cx="20" cy="20" r="1.5" fill="currentColor" />
        </svg>
    );
}

function CloseIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    );
}
