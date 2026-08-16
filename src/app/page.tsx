'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { AppLayout } from '@/components/Layout';
import { CallHistoryList, RichDialer } from '@/components/Calls';
import { AutoDialer } from '@/components/AutoDialer';
import { AccessibilityPanel } from '@/components/AccessibilityPanel';
import { AISimulatorModal } from '@/components/AISimulatorModal';
import { useTwilio } from '@/contexts/TwilioContext';
import { useCallHistory, createCallHistoryEntry } from '@/hooks/useCallHistory';
import styles from './page.module.css';

type CallFilter = 'all' | 'incoming' | 'outgoing' | 'missed';

interface PhoneNumber {
    id: string;
    phone_number: string;
    friendly_name: string | null;
    is_default: boolean;
}

export default function Home() {
    const twilio = useTwilio();
    const { history, filter, setFilter, addEntry, clearHistory } = useCallHistory();

    const [callFilter, setCallFilter] = useState<CallFilter>('all');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [showAccessibility, setShowAccessibility] = useState(false);
    const [showAutoDialer, setShowAutoDialer] = useState(false);
    const [user, setUser] = useState<{ email?: string | null } | null>(null);
    const [assignedNumbers, setAssignedNumbers] = useState<PhoneNumber[]>([]);
    const [selectedCallerId, setSelectedCallerId] = useState<string>('');
    const [balance, setBalance] = useState<number>(25.00);
    const [showTopUpModal, setShowTopUpModal] = useState(false);
    const [topUpAmount, setTopUpAmount] = useState(10);
    const [voiceSettings, setVoiceSettings] = useState<{ call_recording_enabled: boolean; voicemail_enabled: boolean }>({
        call_recording_enabled: false,
        voicemail_enabled: false,
    });

    const dialedNumberRef = useRef<string>('');

    // Fetch user and actual phone numbers & settings from backend
    useEffect(() => {
        const fetchInitialData = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);

            // Fetch numbers
            try {
                const res = await fetch('/api/user/numbers');
                if (res.ok) {
                    const data = await res.json();
                    if (data.numbers && data.numbers.length > 0) {
                        setAssignedNumbers(data.numbers);
                        const defaultNum = data.numbers.find((n: PhoneNumber) => n.is_default);
                        setSelectedCallerId(defaultNum?.phone_number || data.numbers[0].phone_number);
                    }
                }
            } catch { }

            // Fetch voice settings
            try {
                const res = await fetch('/api/user/voice-settings');
                if (res.ok) {
                    const data = await res.json();
                    if (!data.error) {
                        setVoiceSettings({
                            call_recording_enabled: !!data.call_recording_enabled,
                            voicemail_enabled: !!data.voicemail_enabled,
                        });
                    }
                }
            } catch { }
        };

        fetchInitialData();
    }, []);

    const isOnCall = twilio.callStatus === 'connected' || twilio.callStatus === 'connecting' || twilio.callStatus === 'ringing';

    // Handle filter change
    const handleFilterChange = (newFilter: CallFilter) => {
        setCallFilter(newFilter);
        setFilter(newFilter);
    };

    // Filter history based on selected filter
    const getFilteredHistory = () => {
        if (callFilter === 'all') return history;
        if (callFilter === 'missed') return history.filter(e => e.status === 'missed');
        if (callFilter === 'incoming') return history.filter(e => e.direction === 'incoming');
        if (callFilter === 'outgoing') return history.filter(e => e.direction === 'outgoing');
        return history;
    };

    // Call Strategy / Mode: direct | script | ai_agent
    const [callMode, setCallMode] = useState<'direct' | 'script' | 'ai_agent'>('direct');
    const [selectedCampaign, setSelectedCampaign] = useState('Senior Sweepstakes Recovery (15 Rebuttals)');
    const [showAISimulator, setShowAISimulator] = useState(false);

    // Make Call
    const handleCall = async (numberToCallParam?: string) => {
        const numberToCall = numberToCallParam || phoneNumber;
        if (!numberToCall.trim()) return;

        dialedNumberRef.current = numberToCall;

        const effectiveMode = numberToCall === '*99' ? 'test' : callMode;

        const call = await twilio.makeCall(numberToCall, selectedCallerId, {
            callMode: effectiveMode,
            customGreeting: callMode === 'ai_agent' ? undefined : undefined,
        });
        if (call) {
            twilio.setActiveCall(call, 'outgoing', numberToCall);
            setPhoneNumber('');
        }
    };

    // Handle incoming call disconnect -> add to history
    useEffect(() => {
        if (!twilio.incomingCall) return;

        const handleDisconnect = () => {
            if (!twilio.activeCall) {
                const params = twilio.incomingCall!.parameters as { From?: string };
                addEntry(createCallHistoryEntry(
                    'incoming',
                    params.From || 'Unknown',
                    0,
                    'missed'
                ));
            }
        };

        twilio.incomingCall.on('disconnect', handleDisconnect);
        twilio.incomingCall.on('cancel', handleDisconnect);

        return () => {
            twilio.incomingCall?.off('disconnect', handleDisconnect);
            twilio.incomingCall?.off('cancel', handleDisconnect);
        };
    }, [twilio.incomingCall, twilio.activeCall, addEntry]);

    // Handle remote disconnect -> add to history
    useEffect(() => {
        if (!twilio.activeCall) return;

        const handleRemoteDisconnect = () => {
            const numberForHistory = dialedNumberRef.current || twilio.remoteNumber || 'Unknown';
            addEntry(createCallHistoryEntry(
                twilio.direction || 'outgoing',
                numberForHistory,
                twilio.duration,
                'completed'
            ));
            dialedNumberRef.current = '';
        };

        twilio.activeCall.on('disconnect', handleRemoteDisconnect);

        return () => {
            twilio.activeCall?.off('disconnect', handleRemoteDisconnect);
        };
    }, [twilio.activeCall, twilio.direction, twilio.remoteNumber, twilio.duration, addEntry]);

    const handleAddFunds = (amt: number) => {
        setBalance(prev => prev + amt);
        setShowTopUpModal(false);
    };

    return (
        <AppLayout
            onAccessibilityClick={() => setShowAccessibility(true)}
            callFilter={callFilter}
            onCallFilterChange={handleFilterChange}
            deviceStatus={twilio.deviceStatus}
            error={twilio.deviceError}
            user={user || undefined}
        >
            {/* Accessibility Modal */}
            {showAccessibility && (
                <AccessibilityPanel onClose={() => setShowAccessibility(false)} />
            )}

            <div className={styles.workspace}>
                {/* Top Summary Bar */}
                <div className={styles.statsBar}>
                    {/* Balance Card Feature */}
                    <div className={styles.statCard}>
                        <div className={styles.statIconWallet}>
                            <WalletIcon />
                        </div>
                        <div className={styles.statInfo}>
                            <span className={styles.statLabel}>Available Balance</span>
                            <span className={styles.statValue}>${balance.toFixed(2)}</span>
                        </div>
                        <button className={styles.statActionBtn} onClick={() => setShowTopUpModal(true)}>
                            + Top Up
                        </button>
                    </div>

                    {/* Active Caller ID */}
                    <div className={styles.statCard}>
                        <div className={styles.statIconPhone}>
                            <LineIcon />
                        </div>
                        <div className={styles.statInfo}>
                            <span className={styles.statLabel}>Outbound Caller ID</span>
                            <span className={styles.statValueSmall}>
                                {selectedCallerId || (assignedNumbers[0]?.phone_number) || 'Default Twilio Number'}
                            </span>
                        </div>
                    </div>

                    {/* Recording Status */}
                    <div className={styles.statCard}>
                        <div className={styles.statIconMic}>
                            <RecordingIcon />
                        </div>
                        <div className={styles.statInfo}>
                            <span className={styles.statLabel}>Call Recording</span>
                            <span className={styles.statValueSmall}>
                                {voiceSettings.call_recording_enabled ? 'Enabled (Auto)' : 'Disabled'}
                            </span>
                        </div>
                    </div>

                    {/* Voicemail Status */}
                    <div className={styles.statCard}>
                        <div className={styles.statIconVoicemail}>
                            <VoicemailIcon />
                        </div>
                        <div className={styles.statInfo}>
                            <span className={styles.statLabel}>Voicemail Inbox</span>
                            <span className={styles.statValueSmall}>
                                {voiceSettings.voicemail_enabled ? 'Active (Greeting set)' : 'Disabled'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Main 2-Column Dialer & Call Log Layout */}
                <div className={styles.mainColumns}>
                    {/* Left: Softphone Keypad */}
                    <div className={styles.leftColumn}>
                        <div className={styles.dialerContainer}>
                            <div className={styles.dialerHeader}>
                                <h2 className={styles.dialerTitle}>Marvik Softphone</h2>
                                <button
                                    className={`${styles.autoDialBtn} ${showAutoDialer ? styles.autoDialBtnActive : ''}`}
                                    onClick={() => setShowAutoDialer(!showAutoDialer)}
                                    title="Auto Dialer Campaign"
                                >
                                    <ListIcon />
                                    <span>{showAutoDialer ? 'Close Campaign' : 'Auto Dialer'}</span>
                                </button>
                            </div>

                            {/* Call Strategy Selector Tabs */}
                            <div className={styles.strategyTabs}>
                                <button
                                    className={`${styles.strategyBtn} ${callMode === 'direct' ? styles.strategyActive : ''}`}
                                    onClick={() => setCallMode('direct')}
                                >
                                    ⚡ Direct Call
                                </button>
                                <button
                                    className={`${styles.strategyBtn} ${callMode === 'script' ? styles.strategyActive : ''}`}
                                    onClick={() => setCallMode('script')}
                                >
                                    🎙️ Intro Script
                                </button>
                                <button
                                    className={`${styles.strategyBtn} ${callMode === 'ai_agent' ? styles.strategyActiveAI : ''}`}
                                    onClick={() => setCallMode('ai_agent')}
                                >
                                    🤖 AI Voice Agent
                                </button>
                            </div>

                            {/* Active AI Mode Banner */}
                            {callMode === 'ai_agent' && (
                                <div className={styles.aiBadge}>
                                    <div className={styles.aiBadgeHeader}>
                                        <div className={styles.aiPulseDot}></div>
                                        <div className={styles.aiBadgeText}>
                                            <span className={styles.aiBadgeTitle}>AI Agent Armed (Replicate / Cerebras)</span>
                                            <span className={styles.aiBadgeSub}>Senior Sweepstakes Recovery (15 Rebuttals)</span>
                                        </div>
                                    </div>
                                    <div className={styles.aiActions}>
                                        <button
                                            className={styles.aiTestCallBtn}
                                            onClick={() => handleCall('*99')}
                                            title="Speak directly to AI via computer microphone (*99)"
                                        >
                                            🎧 Test Voice in Mic (*99)
                                        </button>
                                        <button
                                            className={styles.aiSimulateBtn}
                                            onClick={() => setShowAISimulator(true)}
                                            title="Open Interactive AI Chat Simulator"
                                        >
                                            🧪 Simulator Studio
                                        </button>
                                    </div>
                                </div>
                            )}

                            {callMode === 'script' && (
                                <div className={styles.scriptBadge}>
                                    <span>🎙️ Intro announcement plays on answer, then bridges to you.</span>
                                </div>
                            )}

                            {/* Auto Dialer Panel */}
                            {showAutoDialer ? (
                                <div className={styles.autoDialerWrapper}>
                                    <AutoDialer />
                                </div>
                            ) : (
                                /* Interactive Rich Keypad */
                                <div className={styles.keypadWrapper}>
                                    <RichDialer
                                        phoneNumber={phoneNumber}
                                        onPhoneNumberChange={setPhoneNumber}
                                        onCall={() => handleCall()}
                                        isReady={twilio.deviceStatus === 'ready'}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Real Call History */}
                    <div className={styles.rightColumn}>
                        <div className={styles.historyContainer}>
                            <div className={styles.historyHeader}>
                                <div className={styles.filterTabs}>
                                    {(['all', 'incoming', 'outgoing', 'missed'] as CallFilter[]).map((tab) => (
                                        <button
                                            key={tab}
                                            className={`${styles.tabBtn} ${callFilter === tab ? styles.tabActive : ''}`}
                                            onClick={() => handleFilterChange(tab)}
                                        >
                                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                        </button>
                                    ))}
                                </div>

                                {history.length > 0 && (
                                    <button className={styles.clearBtn} onClick={clearHistory}>
                                        Clear History
                                    </button>
                                )}
                            </div>

                            <div className={styles.historyBody}>
                                <CallHistoryList
                                    entries={getFilteredHistory()}
                                    filter={callFilter}
                                    onFilterChange={() => { }}
                                    onCall={(num) => handleCall(num)}
                                    onClear={clearHistory}
                                    hideFilters={true}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Up Modal */}
            {showTopUpModal && (
                <div className={styles.modalBackdrop} onClick={() => setShowTopUpModal(false)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3 className={styles.modalTitle}>Add Calling Balance</h3>
                            <button className={styles.modalClose} onClick={() => setShowTopUpModal(false)}>×</button>
                        </div>
                        <div className={styles.modalBody}>
                            <p className={styles.modalDesc}>Current balance: <strong>${balance.toFixed(2)}</strong></p>
                            <label className={styles.amountLabel}>Choose top-up amount:</label>
                            <div className={styles.amountGrid}>
                                {[10, 25, 50, 100].map(amt => (
                                    <button
                                        key={amt}
                                        className={`${styles.amountOption} ${topUpAmount === amt ? styles.amountSelected : ''}`}
                                        onClick={() => setTopUpAmount(amt)}
                                    >
                                        ${amt}.00
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={styles.cancelBtn} onClick={() => setShowTopUpModal(false)}>Cancel</button>
                            <button className={styles.confirmBtn} onClick={() => handleAddFunds(topUpAmount)}>Add ${topUpAmount}.00</button>
                        </div>
                    </div>
                </div>
            )}
            {/* AI Simulator Modal */}
            <AISimulatorModal
                isOpen={showAISimulator}
                onClose={() => setShowAISimulator(false)}
                onStartBrowserAudioCall={() => handleCall('*99')}
            />
        </AppLayout>
    );
}

// Icons
function WalletIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
            <circle cx="16" cy="15" r="1" fill="currentColor" />
        </svg>
    );
}

function LineIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
    );
}

function RecordingIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
        </svg>
    );
}

function VoicemailIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="5.5" cy="11.5" r="4.5" />
            <circle cx="18.5" cy="11.5" r="4.5" />
            <line x1="5.5" y1="16" x2="18.5" y2="16" />
        </svg>
    );
}

function ListIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
    );
}
