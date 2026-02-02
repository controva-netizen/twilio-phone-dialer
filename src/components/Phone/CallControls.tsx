'use client';

import React from 'react';
import styles from './CallControls.module.css';

interface CallControlsProps {
    isOnCall: boolean;
    isReady: boolean;
    isMuted: boolean;
    onCall: () => void;
    onHangup: () => void;
    onMuteToggle: () => void;
    disabled?: boolean;
}

export function CallControls({
    isOnCall,
    isReady,
    isMuted,
    onCall,
    onHangup,
    onMuteToggle,
    disabled = false,
}: CallControlsProps) {
    return (
        <div className={styles.controls}>
            {isOnCall ? (
                <>
                    {/* Mute Button */}
                    <button
                        className={`${styles.button} ${styles.muteButton} ${isMuted ? styles.muted : ''}`}
                        onClick={onMuteToggle}
                        aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                        aria-pressed={isMuted}
                    >
                        {isMuted ? <MicOffIcon /> : <MicIcon />}
                    </button>

                    {/* Hangup Button */}
                    <button
                        className={`${styles.button} ${styles.hangupButton}`}
                        onClick={onHangup}
                        aria-label="End call"
                    >
                        <HangupIcon />
                    </button>
                </>
            ) : (
                /* Call Button */
                <button
                    className={`${styles.button} ${styles.callButton} ${isReady && !disabled ? styles.ready : ''}`}
                    onClick={onCall}
                    disabled={!isReady || disabled}
                    aria-label="Start call"
                >
                    <CallIcon />
                </button>
            )}
        </div>
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

function MicIcon() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
    );
}

function MicOffIcon() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
    );
}
