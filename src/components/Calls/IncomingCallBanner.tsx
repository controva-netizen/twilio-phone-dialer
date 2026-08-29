'use client';

import React, { useEffect, useRef } from 'react';
import styles from './IncomingCallBanner.module.css';

interface IncomingCallBannerProps {
    callerNumber: string;
    leadName?: string;
    onAccept: () => void;
    onReject: () => void;
}

export function IncomingCallBanner({ callerNumber, leadName, onAccept, onReject }: IncomingCallBannerProps) {
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Play ringtone
    useEffect(() => {
        // Create ringtone using Web Audio API
        const audioContext = new AudioContext();
        let isPlaying = true;

        const playRingtone = async () => {
            while (isPlaying) {
                // Ring pattern: two short beeps
                for (let i = 0; i < 2 && isPlaying; i++) {
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();

                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);

                    oscillator.frequency.value = 440;
                    oscillator.type = 'sine';
                    gainNode.gain.value = 0.3;

                    oscillator.start();

                    await new Promise(resolve => setTimeout(resolve, 200));
                    oscillator.stop();

                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                // Pause between ring sets
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        };

        playRingtone();

        return () => {
            isPlaying = false;
            audioContext.close();
        };
    }, []);

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

    const getInitials = (phoneNumber: string): string => {
        const hash = phoneNumber.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        return letters[hash % 26] + letters[(hash * 7) % 26];
    };

    return (
        <div className={styles.banner} role="alert" aria-live="assertive">
            <div className={styles.content}>
                {/* Ringing indicator */}
                <div className={styles.ringIndicator}>
                    <div className={styles.pulse} />
                    <div className={styles.pulse} />
                    <PhoneRingIcon />
                </div>

                {/* Avatar */}
                <div className={styles.avatar}>
                    {getInitials(leadName || callerNumber)}
                </div>

                {/* Info */}
                <div className={styles.info}>
                    <span className={styles.label}>{leadName ? 'Transfer from AI Agent' : 'Incoming call'}</span>
                    <span className={styles.number}>{leadName || callerNumber}</span>
                    {leadName && <span className={styles.number} style={{ fontSize: '0.8em', opacity: 0.75 }}>{callerNumber}</span>}
                </div>

                {/* Actions */}
                <div className={styles.actions}>
                    <button
                        className={`${styles.btn} ${styles.rejectBtn}`}
                        onClick={onReject}
                        aria-label="Decline call"
                        title="Decline (Esc)"
                    >
                        <DeclineIcon />
                        <span>Decline</span>
                    </button>
                    <button
                        className={`${styles.btn} ${styles.acceptBtn}`}
                        onClick={onAccept}
                        aria-label="Accept call"
                        title="Accept (Enter)"
                    >
                        <AcceptIcon />
                        <span>Accept</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

function PhoneRingIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
    );
}

function AcceptIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
        </svg>
    );
}

function DeclineIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71s-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 0 0-2.67-1.85.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
        </svg>
    );
}
