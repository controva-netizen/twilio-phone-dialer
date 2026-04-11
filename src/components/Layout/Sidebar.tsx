'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Sidebar.module.css';

type CallFilter = 'all' | 'incoming' | 'outgoing' | 'missed';

interface SidebarProps {
    callFilter?: CallFilter;
    onCallFilterChange?: (filter: CallFilter) => void;
}

export function Sidebar({ callFilter = 'all', onCallFilterChange }: SidebarProps) {
    const pathname = usePathname();
    const [expandedSections, setExpandedSections] = useState<string[]>(['calls', 'recordings', 'messages', 'meetings']);
    const [unreadVoicemails, setUnreadVoicemails] = useState(0);

    const isRecordingsPage = pathname === '/recordings' || pathname.startsWith('/recordings/');

    // Fetch unread voicemail count
    useEffect(() => {
        const fetchUnread = async () => {
            try {
                const res = await fetch('/api/user/recordings?type=voicemail');
                if (res.ok) {
                    const data = await res.json();
                    setUnreadVoicemails(data.unreadVoicemails || 0);
                }
            } catch { /* ignore */ }
        };
        fetchUnread();
        // Refresh every 30 seconds
        const interval = setInterval(fetchUnread, 30000);
        return () => clearInterval(interval);
    }, []);

    const toggleSection = (section: string) => {
        setExpandedSections(prev =>
            prev.includes(section)
                ? prev.filter(s => s !== section)
                : [...prev, section]
        );
    };

    const isCallsPage = pathname === '/calls' || pathname.startsWith('/calls/');

    const handleFilterClick = (filter: CallFilter) => {
        onCallFilterChange?.(filter);
    };

    return (
        <aside className={styles.sidebar}>
            {/* Logo Header */}
            <div className={styles.header}>
                <div className={styles.logo}>
                    <LogoIcon />
                    <span className={styles.logoText}>TwilioPhone</span>
                </div>
            </div>

            {/* Navigation */}
            <nav className={styles.nav}>
                {/* CALL HISTORY Section */}
                <div className={styles.section}>
                    <button
                        className={styles.sectionHeader}
                        onClick={() => toggleSection('calls')}
                        aria-expanded={expandedSections.includes('calls')}
                    >
                        <ChevronIcon expanded={expandedSections.includes('calls')} />
                        <span>CALL HISTORY</span>
                    </button>

                    {expandedSections.includes('calls') && (
                        <div className={styles.sectionItems}>
                            <Link
                                href="/calls"
                                className={`${styles.navItem} ${isCallsPage && callFilter === 'all' ? styles.active : ''}`}
                                onClick={() => handleFilterClick('all')}
                            >
                                <AllCallsIcon />
                                <span>All calls</span>
                            </Link>
                            <button
                                className={`${styles.navItem} ${isCallsPage && callFilter === 'incoming' ? styles.active : ''}`}
                                onClick={() => handleFilterClick('incoming')}
                            >
                                <IncomingIcon />
                                <span>Incoming</span>
                            </button>
                            <button
                                className={`${styles.navItem} ${isCallsPage && callFilter === 'outgoing' ? styles.active : ''}`}
                                onClick={() => handleFilterClick('outgoing')}
                            >
                                <OutgoingIcon />
                                <span>Outgoing</span>
                            </button>
                            <button
                                className={`${styles.navItem} ${isCallsPage && callFilter === 'missed' ? styles.active : ''}`}
                                onClick={() => handleFilterClick('missed')}
                            >
                                <MissedIcon />
                                <span>Missed</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* RECORDINGS Section */}
                <div className={styles.section}>
                    <button
                        className={styles.sectionHeader}
                        onClick={() => toggleSection('recordings')}
                        aria-expanded={expandedSections.includes('recordings')}
                    >
                        <ChevronIcon expanded={expandedSections.includes('recordings')} />
                        <span>RECORDINGS</span>
                    </button>

                    {expandedSections.includes('recordings') && (
                        <div className={styles.sectionItems}>
                            <Link
                                href="/recordings?tab=voicemail"
                                className={`${styles.navItem} ${isRecordingsPage && pathname === '/recordings' ? styles.active : ''}`}
                            >
                                <VoicemailNavIcon />
                                <span>Voicemails</span>
                                {unreadVoicemails > 0 && (
                                    <span className={styles.badgeCount}>{unreadVoicemails}</span>
                                )}
                            </Link>
                            <Link
                                href="/recordings?tab=call"
                                className={`${styles.navItem} ${isRecordingsPage && pathname.includes('tab=call') ? styles.active : ''}`}
                            >
                                <RecordNavIcon />
                                <span>Call recordings</span>
                            </Link>
                        </div>
                    )}
                </div>

                {/* MESSAGES Section */}
                <div className={styles.section}>
                    <button
                        className={styles.sectionHeader}
                        onClick={() => toggleSection('messages')}
                        aria-expanded={expandedSections.includes('messages')}
                    >
                        <ChevronIcon expanded={expandedSections.includes('messages')} />
                        <span>MESSAGES</span>
                    </button>

                    {expandedSections.includes('messages') && (
                        <div className={styles.sectionItems}>
                            <Link href="/messages" className={styles.navItem}>
                                <MessageIcon />
                                <span>All messages</span>
                                <span className={styles.badge}>Soon</span>
                            </Link>
                        </div>
                    )}
                </div>

                {/* MEETINGS Section */}
                <div className={styles.section}>
                    <button
                        className={styles.sectionHeader}
                        onClick={() => toggleSection('meetings')}
                        aria-expanded={expandedSections.includes('meetings')}
                    >
                        <ChevronIcon expanded={expandedSections.includes('meetings')} />
                        <span>MEETINGS</span>
                    </button>

                    {expandedSections.includes('meetings') && (
                        <div className={styles.sectionItems}>
                            <Link href="/meetings" className={styles.navItem}>
                                <VideoIcon />
                                <span>Video meetings</span>
                                <span className={styles.badge}>Soon</span>
                            </Link>
                        </div>
                    )}
                </div>
            </nav>

            {/* Bottom */}
            <div className={styles.bottom}>
                <Link href="/settings" className={styles.navItem}>
                    <SettingsIcon />
                    <span>Settings</span>
                </Link>
            </div>
        </aside>
    );
}

// Icons
function LogoIcon() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
    );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
        >
            <polyline points="9 18 15 12 9 6" />
        </svg>
    );
}

function AllCallsIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
    );
}

function IncomingIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 3 21 3 21 8" />
            <line x1="4" y1="20" x2="21" y2="3" />
            <path d="M21 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-3.12-.8" />
            <path d="M6.72 6.72A2 2 0 0 1 4.11 4h3" />
        </svg>
    );
}

function OutgoingIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="8 21 3 21 3 16" />
            <line x1="20" y1="4" x2="3" y2="21" />
            <path d="M21 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-3.12-.8" />
            <path d="M6.72 6.72A2 2 0 0 1 4.11 4h3" />
        </svg>
    );
}

function MissedIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    );
}

function MessageIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
    );
}

function VideoIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
    );
}

function VoicemailNavIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="5.5" cy="11.5" r="4.5" />
            <circle cx="18.5" cy="11.5" r="4.5" />
            <line x1="5.5" y1="16" x2="18.5" y2="16" />
        </svg>
    );
}

function RecordNavIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
        </svg>
    );
}

function SettingsIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
    );
}
