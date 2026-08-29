'use client';

import React, { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { GlobalDialerFAB } from './GlobalDialerFAB';
import { IncomingCallBanner, ActiveCallPopup } from '@/components/Calls';
import { useTwilio } from '@/contexts/TwilioContext';
import styles from './AppLayout.module.css';

type CallFilter = 'all' | 'incoming' | 'outgoing' | 'missed';

interface AppLayoutProps {
    children: ReactNode;
    onAccessibilityClick?: () => void;
    callFilter?: CallFilter;
    onCallFilterChange?: (filter: CallFilter) => void;
    // These are now optional — falls back to context
    deviceStatus?: 'offline' | 'connecting' | 'ready' | 'busy' | 'error';
    error?: string | null;
    user?: { email?: string | null };
}

export function AppLayout({ children, onAccessibilityClick, callFilter, onCallFilterChange, deviceStatus: propDeviceStatus, error: propError, user }: AppLayoutProps) {
    const twilio = useTwilio();

    // Use props if provided, otherwise fall back to context
    const deviceStatus = propDeviceStatus || twilio.deviceStatus;
    const error = propError !== undefined ? propError : twilio.deviceError;

    const isOnCall = twilio.callStatus === 'connected' || twilio.callStatus === 'connecting' || twilio.callStatus === 'ringing';
    const displayNumber = twilio.remoteNumber || 'Unknown';

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

                {/* Global Incoming Call Banner */}
                {twilio.incomingCall && !twilio.activeCall && (
                    <IncomingCallBanner
                        callerNumber={
                            twilio.incomingCallInfo?.customerNumber
                            || (twilio.incomingCall.parameters as { From?: string }).From
                            || 'Unknown'
                        }
                        leadName={twilio.incomingCallInfo?.leadName}
                        onAccept={twilio.acceptIncomingCall}
                        onReject={twilio.rejectIncomingCall}
                    />
                )}

                {/* Global Active Call Popup */}
                {isOnCall && (
                    <ActiveCallPopup
                        remoteNumber={displayNumber}
                        displayName={twilio.callerDisplayName || undefined}
                        duration={twilio.duration}
                        isMuted={twilio.isMuted}
                        onMuteToggle={twilio.toggleMute}
                        onHangup={twilio.hangup}
                        onDigit={twilio.sendDTMF}
                    />
                )}

                <main className={styles.content}>
                    {children}
                </main>
                
                {/* Global FAB Dialer */}
                <GlobalDialerFAB />
            </div>
        </div>
    );
}
