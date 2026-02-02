'use client';

import React, { useEffect } from 'react';
import styles from './IncomingCall.module.css';

interface IncomingCallProps {
    callerNumber: string;
    onAccept: () => void;
    onReject: () => void;
}

export function IncomingCall({ callerNumber, onAccept, onReject }: IncomingCallProps) {
    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                onAccept();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                onReject();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onAccept, onReject]);

    return (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="incoming-call-title">
            <div className={styles.modal}>
                {/* Animated rings */}
                <div className={styles.rings}>
                    <div className={styles.ring} />
                    <div className={styles.ring} />
                    <div className={styles.ring} />
                </div>

                {/* Avatar */}
                <div className={styles.avatar}>
                    <PhoneIcon />
                </div>

                {/* Caller info */}
                <h2 id="incoming-call-title" className={styles.title}>Incoming Call</h2>
                <p className={styles.callerNumber}>{callerNumber}</p>

                {/* Action buttons */}
                <div className={styles.actions}>
                    <button
                        className={`${styles.button} ${styles.rejectButton}`}
                        onClick={onReject}
                        aria-label="Reject call"
                    >
                        <HangupIcon />
                    </button>
                    <button
                        className={`${styles.button} ${styles.acceptButton}`}
                        onClick={onAccept}
                        aria-label="Accept call"
                    >
                        <CallIcon />
                    </button>
                </div>

                {/* Keyboard hints */}
                <p className={styles.hint}>
                    Press <kbd>Enter</kbd> to accept or <kbd>Esc</kbd> to reject
                </p>
            </div>
        </div>
    );
}

function PhoneIcon() {
    return (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
        </svg>
    );
}

function CallIcon() {
    return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
        </svg>
    );
}

function HangupIcon() {
    return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71s-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 0 0-2.67-1.85.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
        </svg>
    );
}
