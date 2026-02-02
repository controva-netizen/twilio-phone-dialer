'use client';

import React, { useState, useRef, useEffect } from 'react';
import styles from './RichDialer.module.css';

interface RichDialerProps {
    phoneNumber: string;
    onPhoneNumberChange: (value: string) => void;
    onCall: () => void;
    isReady: boolean;
}

export function RichDialer({ phoneNumber, onPhoneNumberChange, onCall, isReady }: RichDialerProps) {
    const [showKeypad, setShowKeypad] = useState(false);
    const keypadBtnRef = useRef<HTMLButtonElement>(null);
    const keypadRef = useRef<HTMLDivElement>(null);

    // Close keypad when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                keypadRef.current &&
                !keypadRef.current.contains(e.target as Node) &&
                keypadBtnRef.current &&
                !keypadBtnRef.current.contains(e.target as Node)
            ) {
                setShowKeypad(false);
            }
        };

        if (showKeypad) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showKeypad]);

    const handleKeypadDigit = (digit: string) => {
        onPhoneNumberChange(phoneNumber + digit);
        // Brief DTMF tone
        try {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 350 + (parseInt(digit) || 5) * 50;
            gain.gain.value = 0.08;
            osc.start();
            setTimeout(() => osc.stop(), 40);
        } catch { }
    };

    const handleBackspace = () => {
        onPhoneNumberChange(phoneNumber.slice(0, -1));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && phoneNumber.trim() && isReady) {
            onCall();
        }
    };

    const dialpadKeys = [
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
        <div className={styles.dialerBar}>
            {/* Keypad Button */}
            <div className={styles.keypadWrapper}>
                <button
                    ref={keypadBtnRef}
                    className={`${styles.iconBtn} ${showKeypad ? styles.active : ''}`}
                    onClick={() => setShowKeypad(!showKeypad)}
                    aria-label="Toggle keypad"
                    title="Open keypad"
                >
                    <KeypadIcon />
                </button>

                {/* Floating Keypad Popover */}
                {showKeypad && (
                    <div ref={keypadRef} className={styles.keypadPopover}>
                        <div className={styles.keypadHeader}>
                            <span className={styles.keypadTitle}>Keypad</span>
                            <button
                                className={styles.keypadClose}
                                onClick={() => setShowKeypad(false)}
                            >
                                ×
                            </button>
                        </div>

                        {phoneNumber && (
                            <div className={styles.keypadDisplay}>
                                <span>{phoneNumber}</span>
                                <button onClick={handleBackspace} className={styles.backspace}>
                                    <BackspaceIcon />
                                </button>
                            </div>
                        )}

                        <div className={styles.keypadGrid}>
                            {dialpadKeys.map((key) => (
                                <button
                                    key={key.digit}
                                    className={styles.key}
                                    onClick={() => handleKeypadDigit(key.digit)}
                                >
                                    <span className={styles.keyDigit}>{key.digit}</span>
                                    {key.letters && <span className={styles.keyLetters}>{key.letters}</span>}
                                </button>
                            ))}
                        </div>

                        <button
                            className={`${styles.keypadCall} ${phoneNumber && isReady ? styles.active : ''}`}
                            onClick={() => {
                                if (phoneNumber && isReady) {
                                    onCall();
                                    setShowKeypad(false);
                                }
                            }}
                            disabled={!phoneNumber || !isReady}
                        >
                            <CallIcon /> Call
                        </button>
                    </div>
                )}
            </div>

            {/* Input Field */}
            <input
                type="tel"
                className={styles.input}
                placeholder="Enter phone number..."
                value={phoneNumber}
                onChange={(e) => onPhoneNumberChange(e.target.value)}
                onKeyDown={handleKeyDown}
            />

            {/* Call Button */}
            <button
                className={`${styles.callBtn} ${phoneNumber && isReady ? styles.ready : ''}`}
                onClick={onCall}
                disabled={!phoneNumber.trim() || !isReady}
                title={isReady ? 'Make call' : 'Connecting...'}
            >
                <CallIcon />
                <span>Call</span>
            </button>
        </div>
    );
}

function KeypadIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="5" r="2" />
            <circle cx="12" cy="5" r="2" />
            <circle cx="19" cy="5" r="2" />
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
            <circle cx="5" cy="19" r="2" />
            <circle cx="12" cy="19" r="2" />
            <circle cx="19" cy="19" r="2" />
        </svg>
    );
}

function CallIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
        </svg>
    );
}

function BackspaceIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
            <line x1="18" y1="9" x2="12" y2="15" />
            <line x1="12" y1="9" x2="18" y2="15" />
        </svg>
    );
}
