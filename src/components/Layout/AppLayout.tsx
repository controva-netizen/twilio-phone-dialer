'use client';

import React, { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import styles from './AppLayout.module.css';

type CallFilter = 'all' | 'incoming' | 'outgoing' | 'missed';
type DeviceStatus = 'offline' | 'connecting' | 'ready' | 'busy' | 'error';

interface AppLayoutProps {
    children: ReactNode;
    onAccessibilityClick?: () => void;
    callFilter?: CallFilter;
    onCallFilterChange?: (filter: CallFilter) => void;
    deviceStatus?: DeviceStatus;
    error?: string | null;
    user?: { email?: string | null };
}

export function AppLayout({ children, onAccessibilityClick, callFilter, onCallFilterChange, deviceStatus, error, user }: AppLayoutProps) {
    return (
        <div className="app">
            <Sidebar callFilter={callFilter} onCallFilterChange={onCallFilterChange} />
            <div className="main-content">
                <Header
                    onAccessibilityClick={onAccessibilityClick}
                    callFilter={callFilter}
                    deviceStatus={deviceStatus}
                    error={error}
                    user={user}
                />
                <main className={styles.content}>
                    {children}
                </main>
            </div>
        </div>
    );
}
