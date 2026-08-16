'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { useTwilio } from '@/contexts/TwilioContext';
import styles from './AutoDialer.module.css';

type DialStatus = 'pending' | 'dialing' | 'connected' | 'completed' | 'no-answer' | 'failed';
type RunState = 'idle' | 'running' | 'paused' | 'done';
type AutoDialMode = 'direct' | 'ai_agent';

interface DialEntry {
    id: string;
    number: string;
    name?: string;
    status: DialStatus;
    duration?: number;
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
    const [currentIdx, setCurrentIdx] = useState(-1);
    const [dialMode, setDialMode] = useState<AutoDialMode>('ai_agent');
    const [delaySeconds, setDelaySeconds] = useState(3);
    const [fileName, setFileName] = useState('');

    // Refs for real-time tracking in async callbacks
    const runStateRef = useRef<RunState>('idle');
    const currentIdxRef = useRef(-1);
    const entriesRef = useRef<DialEntry[]>([]);
    const twilioRef = useRef(twilio);
    const wasConnectedRef = useRef(false);
    const isDialingRef = useRef(false);
    const prevStatusRef = useRef(twilio.callStatus);
    const nextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    runStateRef.current = runState;
    currentIdxRef.current = currentIdx;
    entriesRef.current = entries;
    twilioRef.current = twilio;

    // Universal Excel / CSV / TXT Parser
    const parseFile = async (file: File) => {
        try {
            setFileName(file.name);
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });

            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            // Convert worksheet to array of rows
            const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

            const parsedLeads: DialEntry[] = [];
            const seenNumbers = new Set<string>();

            // Find column indexes if header exists
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
                    // Search all columns in the row for phone number pattern
                    for (let c = 0; c < row.length; c++) {
                        const cellVal = String(row[c] || '').trim();
                        const cleaned = cleanPhoneNumber(cellVal);
                        if (cleaned) {
                            foundNumber = cleaned;
                            // Assume other cell might be name
                            const otherCell = row.find((val, idx) => idx !== c && String(val).trim().length > 1 && !/\d{5,}/.test(String(val)));
                            if (otherCell) foundName = String(otherCell).trim();
                            break;
                        }
                    }
                }

                if (foundNumber && !seenNumbers.has(foundNumber)) {
                    seenNumbers.add(foundNumber);
                    parsedLeads.push({
                        id: `lead-${parsedLeads.length + 1}`,
                        number: foundNumber,
                        name: foundName,
                        status: 'pending',
                    });
                }
            }

            if (!parsedLeads.length) {
                alert(`No valid phone numbers found in "${file.name}". Please ensure the spreadsheet has phone numbers (e.g. +13072075599 or 307-207-5599).`);
                return;
            }

            setEntries(parsedLeads);
            setRunState('idle');
            setCurrentIdx(-1);
            isDialingRef.current = false;
        } catch (err: any) {
            console.error('File parse error:', err);
            alert(`Error reading file: ${err.message || 'Unable to parse spreadsheet'}`);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        parseFile(file);
        e.target.value = '';
    };

    // Dial lead at index
    const dialAt = useCallback(async (idx: number) => {
        const all = entriesRef.current;
        if (idx >= all.length) {
            setRunState('done');
            return;
        }

        const entry = all[idx];
        setCurrentIdx(idx);
        setEntries(prev => prev.map((e, i) => i === idx ? { ...e, status: 'dialing' } : e));
        isDialingRef.current = true;
        wasConnectedRef.current = false;

        // Mode 1: AI Voice Agent Outbound Campaign (Twilio Cloud -> Customer -> AI -> Softphone Transfer)
        if (dialMode === 'ai_agent') {
            try {
                const res = await fetch('/api/twilio/ai-call/start', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ to: entry.number }),
                });
                const data = await res.json();
                if (data.success) {
                    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, status: 'connected' } : e));
                    // Auto-advance after delay
                    if (runStateRef.current === 'running') {
                        nextTimerRef.current = setTimeout(() => {
                            if (runStateRef.current === 'running') {
                                dialAt(idx + 1);
                            }
                        }, delaySeconds * 1000);
                    }
                } else {
                    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, status: 'failed' } : e));
                    if (runStateRef.current === 'running') {
                        nextTimerRef.current = setTimeout(() => {
                            if (runStateRef.current === 'running') dialAt(idx + 1);
                        }, 2000);
                    }
                }
            } catch (err) {
                setEntries(prev => prev.map((e, i) => i === idx ? { ...e, status: 'failed' } : e));
                if (runStateRef.current === 'running') {
                    nextTimerRef.current = setTimeout(() => {
                        if (runStateRef.current === 'running') dialAt(idx + 1);
                    }, 2000);
                }
            }
            return;
        }

        // Mode 2: Direct Softphone Dialing
        const call = await twilioRef.current.makeCall(entry.number);
        if (call) {
            twilioRef.current.setActiveCall(call, 'outgoing', entry.number);
        } else {
            isDialingRef.current = false;
            setEntries(prev => prev.map((e, i) => i === idx ? { ...e, status: 'failed' } : e));
            if (runStateRef.current === 'running') {
                nextTimerRef.current = setTimeout(() => {
                    if (runStateRef.current === 'running') dialAt(idx + 1);
                }, 2000);
            }
        }
    }, [dialMode, delaySeconds]);

    // Watch callStatus changes for Direct softphone mode
    useEffect(() => {
        if (dialMode === 'ai_agent') return;

        const prev = prevStatusRef.current;
        prevStatusRef.current = twilio.callStatus;

        if (!isDialingRef.current) return;

        if (twilio.callStatus === 'connected') {
            wasConnectedRef.current = true;
            setEntries(p => p.map((e, i) =>
                i === currentIdxRef.current ? { ...e, status: 'connected' } : e
            ));
        }

        if (twilio.callStatus === 'idle' && prev !== 'idle') {
            isDialingRef.current = false;
            const wasConnected = wasConnectedRef.current;
            const idx = currentIdxRef.current;

            setEntries(p => p.map((e, i) =>
                i === idx ? { ...e, status: wasConnected ? 'completed' : 'no-answer' } : e
            ));

            if (runStateRef.current === 'running') {
                const next = idx + 1;
                if (next >= entriesRef.current.length) {
                    setRunState('done');
                } else {
                    nextTimerRef.current = setTimeout(() => {
                        if (runStateRef.current === 'running') dialAt(next);
                    }, delaySeconds * 1000);
                }
            }
        }
    }, [twilio.callStatus, dialAt, dialMode, delaySeconds]);

    useEffect(() => () => {
        if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
    }, []);

    const handleStart = () => {
        if (!entries.length) return;
        setRunState('running');
        const first = entries.findIndex(e => e.status === 'pending');
        if (first >= 0) dialAt(first);
    };

    const handlePause = () => {
        setRunState('paused');
        if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
    };

    const handleResume = () => {
        setRunState('running');
        const next = entriesRef.current.findIndex((e, i) => i > currentIdxRef.current && e.status === 'pending');
        if (next >= 0) dialAt(next);
        else setRunState('done');
    };

    const handleStop = () => {
        if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
        isDialingRef.current = false;
        twilio.hangup();
        setEntries(prev => prev.map((e, i) =>
            i === currentIdxRef.current && (e.status === 'dialing' || e.status === 'connected')
                ? { ...e, status: 'completed' }
                : e
        ));
        setRunState('idle');
    };

    const handleClear = () => {
        if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
        isDialingRef.current = false;
        setEntries([]);
        setFileName('');
        setRunState('idle');
        setCurrentIdx(-1);
    };

    const completed = entries.filter(e => ['completed', 'no-answer', 'failed'].includes(e.status)).length;
    const isReady = twilio.deviceStatus === 'ready';

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerTitleRow}>
                    <span className={styles.title}>🚀 Smart Campaign Auto-Dialer</span>
                    {fileName && <span className={styles.fileBadge}>📄 {fileName}</span>}
                </div>
                {entries.length > 0 && (
                    <span className={styles.progress}>{completed} / {entries.length} Processed</span>
                )}
            </div>

            {/* Campaign Configuration Bar */}
            <div className={styles.configBar}>
                <div className={styles.modeToggleGroup}>
                    <button
                        type="button"
                        className={`${styles.modeBtn} ${dialMode === 'ai_agent' ? styles.modeBtnActiveAI : ''}`}
                        onClick={() => setDialMode('ai_agent')}
                    >
                        🤖 AI Agent + Transfer
                    </button>
                    <button
                        type="button"
                        className={`${styles.modeBtn} ${dialMode === 'direct' ? styles.modeBtnActive : ''}`}
                        onClick={() => setDialMode('direct')}
                    >
                        ⚡ Direct Softphone
                    </button>
                </div>
                <div className={styles.delaySelector}>
                    <label>Delay: </label>
                    <select
                        value={delaySeconds}
                        onChange={(e) => setDelaySeconds(Number(e.target.value))}
                        className={styles.delaySelect}
                    >
                        <option value={2}>2s</option>
                        <option value={3}>3s</option>
                        <option value={5}>5s</option>
                        <option value={10}>10s</option>
                    </select>
                </div>
            </div>

            {/* Upload Zone or Lead Table */}
            {entries.length === 0 ? (
                <div className={styles.uploadZone} onClick={() => fileInputRef.current?.click()}>
                    <svg className={styles.uploadIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <span className={styles.uploadText}>Upload Excel (.xlsx, .xls) or CSV</span>
                    <span className={styles.uploadHint}>Drag and drop or click to upload your spreadsheet or lead list</span>
                    <div className={styles.supportedBadges}>
                        <span>.XLSX</span>
                        <span>.XLS</span>
                        <span>.CSV</span>
                        <span>.TSV</span>
                        <span>.TXT</span>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                        onChange={handleFileChange}
                        className={styles.fileInput}
                    />
                </div>
            ) : (
                <>
                    {/* Controls */}
                    <div className={styles.controls}>
                        {runState === 'idle' && (
                            <button
                                className={`${styles.btn} ${styles.btnStart}`}
                                onClick={handleStart}
                                disabled={!isReady && dialMode === 'direct'}
                            >
                                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                                    <path d="M8 5v14l11-7z" />
                                </svg>
                                Launch Auto-Dialer
                            </button>
                        )}
                        {runState === 'running' && (
                            <button className={`${styles.btn} ${styles.btnPause}`} onClick={handlePause}>
                                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                                </svg>
                                Pause
                            </button>
                        )}
                        {runState === 'paused' && (
                            <button className={`${styles.btn} ${styles.btnStart}`} onClick={handleResume}>
                                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                                    <path d="M8 5v14l11-7z" />
                                </svg>
                                Resume
                            </button>
                        )}
                        {runState === 'done' && (
                            <span className={styles.doneTag}>🎉 Campaign Completed</span>
                        )}
                        {(runState === 'running' || runState === 'paused') && (
                            <button className={`${styles.btn} ${styles.btnStop}`} onClick={handleStop}>
                                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                                    <rect x="6" y="6" width="12" height="12" />
                                </svg>
                                Stop
                            </button>
                        )}
                        <button className={`${styles.btn} ${styles.btnClear}`} onClick={handleClear}>
                            Clear List
                        </button>
                    </div>

                    {/* Lead List Table */}
                    <div className={styles.list}>
                        {entries.map((entry, i) => (
                            <div
                                key={entry.id}
                                className={`${styles.row} ${i === currentIdx ? styles.rowActive : ''}`}
                            >
                                <span className={styles.rowIndex}>{i + 1}</span>
                                <div className={styles.leadDetails}>
                                    <span className={styles.rowNumber}>{entry.number}</span>
                                    {entry.name && <span className={styles.leadName}>{entry.name}</span>}
                                </div>
                                <span className={`${styles.rowBadge} ${styles[`badge_${entry.status}`]}`}>
                                    {LABELS[entry.status]}
                                </span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

const LABELS: Record<DialStatus, string> = {
    pending: 'Pending',
    dialing: 'Dialing...',
    connected: 'Connected / AI Pitch',
    completed: 'Completed',
    'no-answer': 'No answer',
    failed: 'Failed',
};
