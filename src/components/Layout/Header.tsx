'use client';

import React, { useState } from 'react';
import { UserMenu } from './UserMenu';
import styles from './Header.module.css';

type CallFilter = 'all' | 'incoming' | 'outgoing' | 'missed';
type DeviceStatus = 'offline' | 'connecting' | 'ready' | 'busy' | 'error';

interface HeaderProps {
    onAccessibilityClick?: () => void;
    callFilter?: CallFilter;
    deviceStatus?: DeviceStatus;
    error?: string | null;
    user?: { email?: string | null };
}

export function Header({ onAccessibilityClick, callFilter, deviceStatus = 'offline', error, user }: HeaderProps) {
    const [showErrorTooltip, setShowErrorTooltip] = useState(false);

    // Get display label for current filter
    const getFilterLabel = () => {
        switch (callFilter) {
            case 'all': return 'All calls';
            case 'incoming': return 'Incoming calls';
            case 'outgoing': return 'Outgoing calls';
            case 'missed': return 'Missed calls';
            default: return 'All calls';
        }
    };

    // Get status text
    const getStatusText = () => {
        switch (deviceStatus) {
            case 'ready': return 'Ready';
            case 'connecting': return 'Connecting...';
            case 'busy': return 'On Call';
            case 'error': return 'Error';
            default: return 'Offline';
        }
    };

    const handleStatusClick = () => {
        if (error) {
            setShowErrorTooltip(!showErrorTooltip);
        }
    };

    return (
        <header className={styles.header}>
            {/* Left: Category Title */}
            <div className={styles.left}>
                <h1 className={styles.title}>{getFilterLabel()}</h1>
            </div>

            {/* Right: Actions */}
            <div className={styles.right}>
                {/* Connection Status */}
                <div className={styles.statusWrapper}>
                    <button
                        className={`${styles.status} ${styles[deviceStatus]} ${error ? styles.clickable : ''}`}
                        onClick={handleStatusClick}
                        title={error ? 'Click to see error details' : getStatusText()}
                    >
                        <span className={styles.statusDot} />
                        {getStatusText()}
                    </button>

                    {/* Error Tooltip */}
                    {showErrorTooltip && error && (
                        <div className={styles.errorTooltip}>
                            <div className={styles.errorTooltipHeader}>
                                <span>Connection Error</span>
                                <button
                                    className={styles.errorTooltipClose}
                                    onClick={() => setShowErrorTooltip(false)}
                                    aria-label="Close"
                                >
                                    ×
                                </button>
                            </div>
                            <p className={styles.errorTooltipMessage}>{error}</p>
                        </div>
                    )}
                </div>

                <button
                    className={styles.iconButton}
                    onClick={onAccessibilityClick}
                    aria-label="Accessibility settings"
                    title="Accessibility"
                >
                    <AccessibilityIcon />
                </button>

                <UserMenu user={user} />
            </div>
        </header>
    );
}

// Icons

function AccessibilityIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="7" r="1" fill="currentColor" />
            <path d="M9 12h6" />
            <path d="M12 12v5" />
            <path d="M9 17l3-5 3 5" />
        </svg>
    );
}
