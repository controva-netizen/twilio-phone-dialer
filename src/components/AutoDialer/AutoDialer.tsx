'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { useTwilio } from '@/contexts/TwilioContext';
import styles from './AutoDialer.module.css';

type DialStatus = 'pending' | 'queued' | 'dialing' | 'connected' | 'completed' | 'no-answer' | 'failed' | 'cancelled' | 'skipped';
type RunState = 'idle' | 'running' | 'paused' | 'done';
type AutoDialMode = 'direct' | 'ai_agent';

interface DialEntry {
    id: string;
    number: string;
    name?: string;
    status: DialStatus;
    callSid?: string;
    duration?: number;
    note?: string;
}

interface CampaignStats {
    pending: number;
    queued: number;
    dialing: number;
    connected: number;
    completed: number;
    noAnswer: number;
    failed: number;
    cancelled: number;
    skipped: number;
}

function cleanPhoneNumber(raw: string): string {
    const trimmed = raw.trim().replace(/^["']|["']$/g, '');
    const digitsOnly = trimmed.replace(/\D/g, '');
    if (digitsOnly.length === 10) return `+1${digitsOnly}`;
    if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) return `+${digitsOnly}`;
    if (digitsOnly.length >= 7) return trimmed.startsWith('+') ? trimmed : `+${digitsOnly}`;
    return '';
}

export function AutoDialer() {
    const twilio = useTwilio();
    const [entries, setEntries] = useState<DialEntry[]>([]);
    const [runState, setRunState] = useState<RunState>('idle');
    const [dialMode, setDialMode] = useState<AutoDialMode>('ai_agent');
    const [concurrencyLimit, setConcurrencyLimit] = useState(1);
    const [delaySeconds, setDelaySeconds] = useState(3);
    const [fileName, setFileName] = useState('');
    const [selectedEntry, setSelectedEntry] = useState<string | null>(null);

    const runStateRef = useRef<RunState>('idle');
    const entriesRef = useRef<DialEntry[]>([]);
    const twilioRef = useRef(twilio);
    const activeCallsRef = useRef<Set<string>>(new Set()); // track entry IDs currently active
    const queueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Track current softphone call status for direct mode
    const prevCallStatusRef = useRef(twilio.callStatus);
    const directActiveEntryRef = useRef<string | null>(null);

    runStateRef.current = runState;
    entriesRef.current = entries;
    twilioRef.current = twilio;

    // ── Computed stats ─────────────────────────────────────────────────────────
    const stats: CampaignStats = {
        pending: entries.filter(e => e.status === 'pending').length,
        queued: entries.filter(e => e.status === 'queued').length,
        dialing: entries.filter(e => e.status === 'dialing').length,
        connected: entries.filter(e => e.status === 'connected').length,
        completed: entries.filter(e => e.status === 'completed').length,
        noAnswer: entries.filter(e => e.status === 'no-answer').length,
        failed: entries.filter(e => e.status === 'failed').length,
        cancelled: entries.filter(e => e.status === 'cancelled').length,
        skipped: entries.filter(e => e.status === 'skipped').length,
    };
    const totalProcessed = stats.completed + stats.noAnswer + stats.failed + stats.cancelled + stats.skipped;
    const progressPct = entries.length > 0 ? Math.round((totalProcessed / entries.length) * 100) : 0;

    // ── File Parsing ────────────────────────────────────────────────────────────
    const parseFile = async (file: File) => {
        try {
            setFileName(file.name);
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

            const parsedLeads: DialEntry[] = [];
            const seenNumbers = new Set<string>();

            let phoneColIdx = -1;
            let nameColIdx = -1;

            if (rows.length > 0) {
                const headerRow = rows[0].map(c => String(c).toLowerCase().trim());
                phoneColIdx = headerRow.findIndex(h =>
                    h.includes('phone') || h.includes('tel') || h.includes('mobile') || h.includes('cell') || h.includes('number') || h.includes('contact')
                );
                nameColIdx = headerRow.findIndex(h =>
                    h.includes('name') || h.includes('first') || h.includes('lead') || h.includes('customer') || h.includes('client')
                );
            }

            const startRow = (phoneColIdx !== -1) ? 1 : 0;

            for (let r = startRow; r < rows.length; r++) {
                const row = rows[r];
                if (!row || !row.length) continue;

                let foundNumber = '';
                let foundName = '';

                if (phoneColIdx !== -1 && row[phoneColIdx] !== undefined) {
                    foundNumber = cleanPhoneNumber(String(row[phoneColIdx]));
                    if (nameColIdx !== -1 && row[nameColIdx] !== undefined) {
                        foundName = String(row[nameColIdx]).trim();
                    }
                } else {
                    for (let c = 0; c < row.length; c++) {
                        const cleaned = cleanPhoneNumber(String(row[c] || '').trim());
                        if (cleaned) {
                            foundNumber = cleaned;
                            const otherCell = row.find((val, idx) => idx !== c && String(val).trim().length > 1 && !/\d{5,}/.test(String(val)));
                            if (otherCell) foundName = String(otherCell).trim();
                            break;
                        }
                    }
                }

                if (foundNumber && !seenNumbers.has(foundNumber)) {
                    seenNumbers.add(foundNumber);
                    parsedLeads.push({
                        id: `lead-${parsedLeads.length + 1}-${Date.now()}`,
                        number: foundNumber,
                        name: foundName,
                        status: 'pending',
                    });
                }
            }

            if (!parsedLeads.length) {
                alert(`No valid phone numbers found in "${file.name}".`);
                return;
            }

            setEntries(parsedLeads);
            setRunState('idle');
            activeCallsRef.current.clear();
        } catch (err: any) {
            alert(`Error reading file: ${err.message || 'Unable to parse spreadsheet'}`);
        }
    };

    // ── Dial a single entry ────────────────────────────────────────────────────
    const dialEntry = useCallback(async (entryId: string) => {
        const all = entriesRef.current;
        const entry = all.find(e => e.id === entryId);
        if (!entry) return;

        // Mark as dialing
        setEntries(prev => prev.map(e => e.id === entryId ? { ...e, status: 'dialing', callSid: undefined } : e));
        activeCallsRef.current.add(entryId);

        if (dialMode === 'ai_agent') {
            try {
                const agentUserId = twilioRef.current.twilioIdentity
                    || (typeof window !== 'undefined' ? localStorage.getItem('twilio_identity') : null)
                    || 'user';

                const res = await fetch('/api/twilio/ai-call/start', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ to: entry.number, agentUserId }),
                });
                const data = await res.json();

                if (data.success) {
                    // Store CallSid for individual cancel
                    setEntries(prev => prev.map(e =>
                        e.id === entryId ? { ...e, status: 'connected', callSid: data.callSid } : e
                    ));
                    // AI calls auto-advance after delaySeconds (cloud-managed)
                    queueTimerRef.current = setTimeout(() => {
                        activeCallsRef.current.delete(entryId);
                        setEntries(prev => prev.map(e =>
                            e.id === entryId && (e.status === 'connected' || e.status === 'dialing')
                                ? { ...e, status: 'completed' }
                                : e
                        ));
                        if (runStateRef.current === 'running') fillQueue();
                    }, delaySeconds * 1000);
                } else {
                    activeCallsRef.current.delete(entryId);
                    setEntries(prev => prev.map(e =>
                        e.id === entryId ? { ...e, status: 'failed', note: data.error } : e
                    ));
                    if (runStateRef.current === 'running') fillQueue();
                }
            } catch (err: any) {
                activeCallsRef.current.delete(entryId);
                setEntries(prev => prev.map(e =>
                    e.id === entryId ? { ...e, status: 'failed', note: err.message } : e
                ));
                if (runStateRef.current === 'running') fillQueue();
            }
        } else {
            // Direct softphone mode
            directActiveEntryRef.current = entryId;
            const call = await twilioRef.current.makeCall(entry.number);
            if (call) {
                twilioRef.current.setActiveCall(call, 'outgoing', entry.number);
            } else {
                activeCallsRef.current.delete(entryId);
                directActiveEntryRef.current = null;
                setEntries(prev => prev.map(e =>
                    e.id === entryId ? { ...e, status: 'failed' } : e
                ));
                if (runStateRef.current === 'running') fillQueue();
            }
        }
    }, [dialMode, delaySeconds]);

    // ── Fill queue up to concurrency limit ────────────────────────────────────
    const fillQueue = useCallback(() => {
        if (runStateRef.current !== 'running') return;

        const all = entriesRef.current;
        const active = activeCallsRef.current;
        const limit = dialMode === 'direct' ? 1 : concurrencyLimit;
        const availableSlots = limit - active.size;

        if (availableSlots <= 0) return;

        const pendingEntries = all.filter(e => e.status === 'pending');

        // Mark next batch as queued
        const toQueue = pendingEntries.slice(0, availableSlots);
        if (toQueue.length === 0) {
            // No more pending — check if we're done
            if (active.size === 0) {
                setRunState('done');
            }
            return;
        }

        // Start dialing each available slot
        for (const entry of toQueue) {
            dialEntry(entry.id);
        }
    }, [dialMode, concurrencyLimit, dialEntry]);

    // ── Watch direct softphone call status changes ────────────────────────────
    useEffect(() => {
        if (dialMode !== 'direct') return;
        const prev = prevCallStatusRef.current;
        prevCallStatusRef.current = twilio.callStatus;

        const activeEntryId = directActiveEntryRef.current;
        if (!activeEntryId) return;

        if (twilio.callStatus === 'connected') {
            setEntries(p => p.map(e =>
                e.id === activeEntryId ? { ...e, status: 'connected' } : e
            ));
        }

        if (twilio.callStatus === 'idle' && prev !== 'idle') {
            const wasConnected = prev === 'connected';
            activeCallsRef.current.delete(activeEntryId);
            directActiveEntryRef.current = null;
            setEntries(p => p.map(e =>
                e.id === activeEntryId ? { ...e, status: wasConnected ? 'completed' : 'no-answer' } : e
            ));
            if (runStateRef.current === 'running') {
                setTimeout(() => fillQueue(), delaySeconds * 1000);
            }
        }
    }, [twilio.callStatus, dialMode, delaySeconds, fillQueue]);

    // Cleanup on unmount
    useEffect(() => () => {
        if (queueTimerRef.current) clearTimeout(queueTimerRef.current);
    }, []);

    // ── Campaign Actions ──────────────────────────────────────────────────────
    const handleStart = () => {
        if (!entries.length) return;
        setRunState('running');
        fillQueue();
    };

    const handlePause = () => {
        setRunState('paused');
        if (queueTimerRef.current) clearTimeout(queueTimerRef.current);
    };

    const handleResume = () => {
        setRunState('running');
        fillQueue();
    };

    const handleStopAll = async () => {
        setRunState('idle');
        if (queueTimerRef.current) clearTimeout(queueTimerRef.current);

        // Cancel all active Twilio calls
        const activeEntries = entriesRef.current.filter(
            e => (e.status === 'dialing' || e.status === 'connected') && e.callSid
        );

        for (const entry of activeEntries) {
            try {
                await fetch('/api/twilio/ai-call/cancel', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ callSid: entry.callSid }),
                });
            } catch {}
        }

        // Hang up softphone if direct mode
        if (dialMode === 'direct') {
            twilioRef.current.hangup();
        }

        activeCallsRef.current.clear();
        directActiveEntryRef.current = null;

        setEntries(prev => prev.map(e =>
            (e.status === 'dialing' || e.status === 'connected' || e.status === 'queued')
                ? { ...e, status: 'cancelled', callSid: undefined }
                : e
        ));
    };

    const handleRetryFailed = () => {
        setEntries(prev => prev.map(e =>
            (e.status === 'failed' || e.status === 'no-answer' || e.status === 'cancelled')
                ? { ...e, status: 'pending', callSid: undefined, note: undefined }
                : e
        ));
        setRunState('running');
        setTimeout(() => fillQueue(), 100);
    };

    const handleClear = () => {
        if (queueTimerRef.current) clearTimeout(queueTimerRef.current);
        activeCallsRef.current.clear();
        directActiveEntryRef.current = null;
        twilioRef.current.hangup();
        setEntries([]);
        setFileName('');
        setRunState('idle');
    };

    // ── Per-lead Actions ──────────────────────────────────────────────────────
    const handleCancelLead = async (entryId: string) => {
        const entry = entriesRef.current.find(e => e.id === entryId);
        if (!entry) return;

        if (entry.callSid) {
            try {
                await fetch('/api/twilio/ai-call/cancel', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ callSid: entry.callSid }),
                });
            } catch {}
        }

        if (dialMode === 'direct' && directActiveEntryRef.current === entryId) {
            twilioRef.current.hangup();
            directActiveEntryRef.current = null;
        }

        activeCallsRef.current.delete(entryId);
        setEntries(prev => prev.map(e =>
            e.id === entryId ? { ...e, status: 'cancelled', callSid: undefined } : e
        ));

        if (runStateRef.current === 'running') fillQueue();
    };

    const handleSkipLead = (entryId: string) => {
        setEntries(prev => prev.map(e =>
            e.id === entryId && e.status === 'pending' ? { ...e, status: 'skipped' } : e
        ));
    };

    const handleRetryLead = (entryId: string) => {
        setEntries(prev => prev.map(e =>
            e.id === entryId ? { ...e, status: 'pending', callSid: undefined, note: undefined } : e
        ));
    };

    const isReady = twilio.deviceStatus === 'ready';
    const hasActiveOrQueued = entries.some(e => ['dialing', 'connected', 'queued'].includes(e.status));
    const hasFailedOrNoAnswer = entries.some(e => ['failed', 'no-answer', 'cancelled'].includes(e.status));

    return (
        <div className={styles.container}>
            {/* ── Header ── */}
            <div className={styles.header}>
                <div className={styles.headerTitleRow}>
                    <span className={styles.title}>🚀 Campaign Dialer</span>
                    {fileName && <span className={styles.fileBadge}>📄 {fileName}</span>}
                </div>
                {entries.length > 0 && (
                    <span className={styles.progress}>{totalProcessed} / {entries.length}</span>
                )}
            </div>

            {/* ── Stats Bar ── */}
            {entries.length > 0 && (
                <div className={styles.statsBar}>
                    <StatPill label="Pending" count={stats.pending} color="muted" />
                    <StatPill label="Dialing" count={stats.dialing} color="warning" pulse />
                    <StatPill label="Live / AI" count={stats.connected} color="primary" pulse />
                    <StatPill label="Done" count={stats.completed} color="success" />
                    <StatPill label="No Answer" count={stats.noAnswer} color="muted" />
                    <StatPill label="Failed" count={stats.failed} color="danger" />
                    <StatPill label="Cancelled" count={stats.cancelled} color="muted" />
                </div>
            )}

            {/* ── Progress Bar ── */}
            {entries.length > 0 && (
                <div className={styles.progressBarWrap}>
                    <div className={styles.progressBar} style={{ width: `${progressPct}%` }} />
                    <span className={styles.progressPct}>{progressPct}%</span>
                </div>
            )}

            {/* ── Config Bar ── */}
            <div className={styles.configBar}>
                <div className={styles.modeToggleGroup}>
                    <button
                        type="button"
                        className={`${styles.modeBtn} ${dialMode === 'ai_agent' ? styles.modeBtnActiveAI : ''}`}
                        onClick={() => setDialMode('ai_agent')}
                        disabled={runState === 'running'}
                    >
                        🤖 AI Agent
                    </button>
                    <button
                        type="button"
                        className={`${styles.modeBtn} ${dialMode === 'direct' ? styles.modeBtnActive : ''}`}
                        onClick={() => setDialMode('direct')}
                        disabled={runState === 'running'}
                    >
                        ⚡ Softphone
                    </button>
                </div>

                {dialMode === 'ai_agent' && (
                    <div className={styles.configGroup}>
                        <label className={styles.configLabel}>Concurrent:</label>
                        <select
                            value={concurrencyLimit}
                            onChange={e => setConcurrencyLimit(Number(e.target.value))}
                            className={styles.configSelect}
                            disabled={runState === 'running'}
                        >
                            {[1, 2, 3, 5, 10].map(n => (
                                <option key={n} value={n}>{n} call{n !== 1 ? 's' : ''}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div className={styles.configGroup}>
                    <label className={styles.configLabel}>Delay:</label>
                    <select
                        value={delaySeconds}
                        onChange={e => setDelaySeconds(Number(e.target.value))}
                        className={styles.configSelect}
                    >
                        <option value={2}>2s</option>
                        <option value={3}>3s</option>
                        <option value={5}>5s</option>
                        <option value={10}>10s</option>
                        <option value={30}>30s</option>
                    </select>
                </div>
            </div>

            {/* ── Upload or Lead Table ── */}
            {entries.length === 0 ? (
                <div className={styles.uploadZone} onClick={() => fileInputRef.current?.click()}>
                    <svg className={styles.uploadIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <span className={styles.uploadText}>Upload your lead list</span>
                    <span className={styles.uploadHint}>Excel (.xlsx, .xls), CSV, TSV, or TXT — auto-detects phone column</span>
                    <div className={styles.supportedBadges}>
                        {['.XLSX', '.XLS', '.CSV', '.TSV', '.TXT'].map(ext => (
                            <span key={ext}>{ext}</span>
                        ))}
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                        onChange={e => { if (e.target.files?.[0]) { parseFile(e.target.files[0]); e.target.value = ''; } }}
                        className={styles.fileInput}
                    />
                </div>
            ) : (
                <>
                    {/* Campaign Controls */}
                    <div className={styles.controls}>
                        {runState === 'idle' && (
                            <button
                                className={`${styles.btn} ${styles.btnStart}`}
                                onClick={handleStart}
                                disabled={!isReady && dialMode === 'direct'}
                            >
                                <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M8 5v14l11-7z" /></svg>
                                Start Campaign
                            </button>
                        )}
                        {runState === 'running' && (
                            <button className={`${styles.btn} ${styles.btnPause}`} onClick={handlePause}>
                                <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                                Pause
                            </button>
                        )}
                        {runState === 'paused' && (
                            <button className={`${styles.btn} ${styles.btnStart}`} onClick={handleResume}>
                                <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M8 5v14l11-7z" /></svg>
                                Resume
                            </button>
                        )}
                        {runState === 'done' && (
                            <span className={styles.doneTag}>🎉 Campaign Complete!</span>
                        )}
                        {(runState === 'running' || runState === 'paused') && (
                            <button className={`${styles.btn} ${styles.btnStop}`} onClick={handleStopAll}>
                                <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><rect x="6" y="6" width="12" height="12" /></svg>
                                Stop All
                            </button>
                        )}
                        {hasFailedOrNoAnswer && runState !== 'running' && (
                            <button className={`${styles.btn} ${styles.btnRetry}`} onClick={handleRetryFailed}>
                                🔄 Retry Failed
                            </button>
                        )}
                        <button className={`${styles.btn} ${styles.btnClear}`} onClick={handleClear}>
                            Clear
                        </button>

                        {/* Upload a new list */}
                        <button
                            className={`${styles.btn} ${styles.btnUpload}`}
                            onClick={() => fileInputRef.current?.click()}
                            title="Upload a new lead list"
                        >
                            📂 New List
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv,.tsv,.txt"
                            onChange={e => { if (e.target.files?.[0]) { parseFile(e.target.files[0]); e.target.value = ''; } }}
                            className={styles.fileInput}
                        />
                    </div>

                    {/* Lead Table */}
                    <div className={styles.list}>
                        {entries.map((entry, i) => {
                            const isActive = entry.status === 'dialing' || entry.status === 'connected';
                            const isCancellable = isActive;
                            const isSkippable = entry.status === 'pending';
                            const isRetryable = ['failed', 'no-answer', 'cancelled', 'skipped'].includes(entry.status);

                            return (
                                <div
                                    key={entry.id}
                                    className={`${styles.row} ${isActive ? styles.rowActive : ''} ${selectedEntry === entry.id ? styles.rowSelected : ''}`}
                                    onClick={() => setSelectedEntry(selectedEntry === entry.id ? null : entry.id)}
                                >
                                    <span className={styles.rowIndex}>{i + 1}</span>

                                    <div className={styles.leadDetails}>
                                        <span className={styles.rowNumber}>{entry.number}</span>
                                        {entry.name && <span className={styles.leadName}>{entry.name}</span>}
                                        {entry.note && <span className={styles.leadNote} title={entry.note}>⚠ {entry.note.substring(0, 40)}</span>}
                                    </div>

                                    <span className={`${styles.rowBadge} ${styles[`badge_${entry.status.replace('-', '_')}`]}`}>
                                        {LABELS[entry.status]}
                                    </span>

                                    {/* Per-lead action buttons */}
                                    <div className={styles.rowActions}>
                                        {isCancellable && (
                                            <button
                                                className={`${styles.rowActionBtn} ${styles.rowActionCancel}`}
                                                onClick={ev => { ev.stopPropagation(); handleCancelLead(entry.id); }}
                                                title="Hang up this call"
                                            >
                                                ✕ Hang up
                                            </button>
                                        )}
                                        {isSkippable && (
                                            <button
                                                className={`${styles.rowActionBtn} ${styles.rowActionSkip}`}
                                                onClick={ev => { ev.stopPropagation(); handleSkipLead(entry.id); }}
                                                title="Skip this number"
                                            >
                                                ⏭ Skip
                                            </button>
                                        )}
                                        {isRetryable && (
                                            <button
                                                className={`${styles.rowActionBtn} ${styles.rowActionRetry}`}
                                                onClick={ev => { ev.stopPropagation(); handleRetryLead(entry.id); }}
                                                title="Retry this number"
                                            >
                                                🔄
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}

// ── Stat Pill Component ───────────────────────────────────────────────────────
function StatPill({ label, count, color, pulse }: { label: string; count: number; color: string; pulse?: boolean }) {
    if (count === 0) return null;
    return (
        <div className={`${styles.statPill} ${styles[`statPill_${color}`]} ${pulse ? styles.statPillPulse : ''}`}>
            <span className={styles.statCount}>{count}</span>
            <span className={styles.statLabel}>{label}</span>
        </div>
    );
}

const LABELS: Record<DialStatus, string> = {
    pending: 'Pending',
    queued: 'Queued',
    dialing: '📞 Dialing...',
    connected: '🤖 AI Live',
    completed: '✅ Done',
    'no-answer': '📵 No Answer',
    failed: '❌ Failed',
    cancelled: '🚫 Cancelled',
    skipped: '⏭ Skipped',
};
