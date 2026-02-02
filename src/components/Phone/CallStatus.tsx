'use client';

import React from 'react';
import type { CallStatus as CallStatusType, CallDirection } from '@/types';
import styles from './CallStatus.module.css';

interface CallStatusProps {
    status: CallStatusType;
    duration: number;
    remoteNumber: string;
    direction: CallDirection;
}

export function CallStatus({ status, duration, remoteNumber, direction }: CallStatusProps) {
    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const getStatusText = (): string => {
        switch (status) {
            case 'connecting':
                return 'Connecting...';
            case 'ringing':
                return direction === 'incoming' ? 'Incoming call...' : 'Ringing...';
            case 'connected':
                return formatDuration(duration);
            case 'disconnected':
                return 'Call ended';
            default:
                return '';
        }
    };

    return (
        <div className={styles.container} role="status" aria-live="polite">
            {/* Direction Icon */}
            <div className={styles.iconWrapper}>
                {direction === 'incoming' ? <IncomingIcon /> : <OutgoingIcon />}
            </div>

            {/* Remote Number */}
            <div className={styles.number}>{remoteNumber}</div>

            {/* Status / Duration */}
            <div className={`${styles.status} ${status === 'connected' ? styles.connected : ''}`}>
                {status === 'ringing' && <span className={styles.ringingDot} />}
                {getStatusText()}
            </div>
        </div>
    );
}

function IncomingIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
            <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
    );
}

function OutgoingIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
    );
}
