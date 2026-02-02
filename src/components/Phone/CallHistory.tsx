'use client';

import React from 'react';
import type { CallHistoryEntry, CallHistoryFilter } from '@/types';
import styles from './CallHistory.module.css';

interface CallHistoryProps {
    entries: CallHistoryEntry[];
    filter: CallHistoryFilter;
    onFilterChange: (filter: CallHistoryFilter) => void;
    onCall: (phoneNumber: string) => void;
    onClear: () => void;
    onClose: () => void;
}

const filterOptions: { value: CallHistoryFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'incoming', label: 'Incoming' },
    { value: 'outgoing', label: 'Outgoing' },
    { value: 'missed', label: 'Missed' },
];

export function CallHistory({ entries, filter, onFilterChange, onCall, onClear, onClose }: CallHistoryProps) {
    const formatDuration = (seconds: number): string => {
        if (seconds === 0) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatTimestamp = (date: Date): string => {
        const now = new Date();
        const diff = now.getTime() - new Date(date).getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (days === 1) {
            return 'Yesterday';
        } else if (days < 7) {
            return new Date(date).toLocaleDateString([], { weekday: 'short' });
        }
        return new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <h3 className={styles.title}>Call History</h3>
                <button className={styles.closeButton} onClick={onClose} aria-label="Close history">
                    <CloseIcon />
                </button>
            </div>

            {/* Filters */}
            <div className={styles.filters} role="tablist" aria-label="Filter history">
                {filterOptions.map((option) => (
                    <button
                        key={option.value}
                        className={`${styles.filterButton} ${filter === option.value ? styles.active : ''}`}
                        onClick={() => onFilterChange(option.value)}
                        role="tab"
                        aria-selected={filter === option.value}
                    >
                        {option.label}
                    </button>
                ))}
            </div>

            {/* List */}
            <div className={styles.list} role="list">
                {entries.length === 0 ? (
                    <div className={styles.empty}>
                        <p>No calls yet</p>
                    </div>
                ) : (
                    entries.map((entry) => (
                        <button
                            key={entry.id}
                            className={styles.entry}
                            onClick={() => onCall(entry.phoneNumber)}
                            role="listitem"
                            aria-label={`Call ${entry.phoneNumber}`}
                        >
                            <div className={styles.entryIcon}>
                                {entry.direction === 'incoming' ? (
                                    <IncomingIcon missed={entry.status === 'missed'} />
                                ) : (
                                    <OutgoingIcon />
                                )}
                            </div>
                            <div className={styles.entryInfo}>
                                <span className={styles.entryNumber}>{entry.phoneNumber}</span>
                                <span className={styles.entryTime}>{formatTimestamp(entry.timestamp)}</span>
                            </div>
                            <div className={styles.entryDuration}>
                                {entry.status === 'missed' ? (
                                    <span className={styles.missed}>Missed</span>
                                ) : entry.status === 'rejected' ? (
                                    <span className={styles.missed}>Rejected</span>
                                ) : (
                                    formatDuration(entry.duration)
                                )}
                            </div>
                        </button>
                    ))
                )}
            </div>

            {/* Footer */}
            {entries.length > 0 && (
                <div className={styles.footer}>
                    <button className={styles.clearButton} onClick={onClear}>
                        Clear History
                    </button>
                </div>
            )}
        </div>
    );
}

function IncomingIcon({ missed }: { missed: boolean }) {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke={missed ? 'var(--color-danger)' : 'var(--color-success)'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
        </svg>
    );
}

function OutgoingIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 18 10.5 8.5 15.5 13.5 23 6" />
            <polyline points="17 6 23 6 23 12" />
        </svg>
    );
}

function CloseIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    );
}
