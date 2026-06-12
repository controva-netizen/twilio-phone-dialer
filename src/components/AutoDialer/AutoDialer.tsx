'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTwilio } from '@/contexts/TwilioContext';
import styles from './AutoDialer.module.css';

type DialStatus = 'pending' | 'dialing' | 'connected' | 'completed' | 'no-answer' | 'failed';
type RunState = 'idle' | 'running' | 'paused' | 'done';

interface DialEntry {
    id: string;
    number: string;
    status: DialStatus;
    duration?: number;
}

export function AutoDialer() {
    const twilio = useTwilio();
    const [entries, setEntries] = useState<DialEntry[]>([]);
    const [runState, setRunState] = useState<RunState>('idle');
    const [currentIdx, setCurrentIdx] = useState(-1);

    // Refs so callbacks always see fresh values
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

    // Parse phone numbers from CSV/TSV text
    const parseNumbers = (text: string): string[] => {
        const numbers: string[] = [];
        const lines = text.split(/[\r\n]+/);
        for (const line of lines) {
            if (!line.trim()) continue;
            const cells = line.split(/[,\t;]/);
            for (const cell of cells) {
                const raw = cell.trim().replace(/^["']|["']$/g, '');
                // Match strings that look like phone numbers
                if (/^[+\d][\d\s\-(). ]{5,}$/.test(raw) && raw.replace(/\D/g, '').length >= 7) {
                    numbers.push(raw.trim());
                    break;
                }
            }
        }
        return numbers;
    };

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            const text = ev.target?.result as string;
            const nums = parseNumbers(text);
            if (!nums.length) {
                alert('No phone numbers found. Make sure each row has a number like +13072075599 or 3072075599.');
                return;
            }
            setEntries(nums.map((n, i) => ({ id: String(i), number: n, status: 'pending' })));
            setRunState('idle');
            setCurrentIdx(-1);
            isDialingRef.current = false;
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // Dial a number at a given index — stable reference via refs
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

        const call = await twilioRef.current.makeCall(entry.number);
        if (call) {
            twilioRef.current.setActiveCall(call, 'outgoing', entry.number);
        } else {
            // Device not ready or call failed immediately
            isDialingRef.current = false;
            setEntries(prev => prev.map((e, i) => i === idx ? { ...e, status: 'failed' } : e));
            if (runStateRef.current === 'running') {
                nextTimerRef.current = setTimeout(() => {
                    if (runStateRef.current === 'running') dialAt(idx + 1);
                }, 2000);
            }
        }
    }, []);

    // Watch callStatus changes to detect call end and auto-advance
    useEffect(() => {
        const prev = prevStatusRef.current;
        prevStatusRef.current = twilio.callStatus;

        if (!isDialingRef.current) return;

        if (twilio.callStatus === 'connected') {
            wasConnectedRef.current = true;
            setEntries(p => p.map((e, i) =>
                i === currentIdxRef.current ? { ...e, status: 'connected' } : e
            ));
        }

        // Call ended: status went from something to 'idle'
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
                    }, 2000);
                }
            }
        }
    }, [twilio.callStatus, dialAt]);

    // Cleanup timer on unmount
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
        if (twilio.callStatus === 'idle' && !isDialingRef.current) {
            const next = entriesRef.current.findIndex((e, i) => i > currentIdxRef.current && e.status === 'pending');
            if (next >= 0) dialAt(next);
            else setRunState('done');
        }
    };

    const handleStop = () => {
        if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
        isDialingRef.current = false;
        twilio.hangup();
        setEntries(prev => prev.map((e, i) =>
            i === currentIdxRef.current && (e.status === 'dialing' || e.status === 'connected')
                ? { ...e, status: 'failed' }
                : e
        ));
        setRunState('idle');
    };

    const handleClear = () => {
        if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
        isDialingRef.current = false;
        setEntries([]);
        setRunState('idle');
        setCurrentIdx(-1);
    };

    const completed = entries.filter(e => ['completed', 'no-answer', 'failed'].includes(e.status)).length;
    const isReady = twilio.deviceStatus === 'ready';

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <span className={styles.title}>Auto Dialer</span>
                {entries.length > 0 && (
                    <span className={styles.progress}>{completed} / {entries.length}</span>
                )}
            </div>

            {entries.length === 0 ? (
                <div className={styles.uploadZone} onClick={() => fileInputRef.current?.click()}>
                    <svg className={styles.uploadIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <span className={styles.uploadText}>Upload CSV file</span>
                    <span className={styles.uploadHint}>One phone number per row — export any spreadsheet as CSV</span>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.txt,.tsv"
                        onChange={handleFile}
                        className={styles.fileInput}
                    />
                </div>
            ) : (
                <>
                    <div className={styles.controls}>
                        {runState === 'idle' && (
                            <button
                                className={`${styles.btn} ${styles.btnStart}`}
                                onClick={handleStart}
                                disabled={!isReady}
                                title={!isReady ? 'Device not ready' : ''}
                            >
                                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                                    <path d="M8 5v14l11-7z" />
                                </svg>
                                Start
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
                            <span className={styles.doneTag}>All done</span>
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
                            Clear
                        </button>
                    </div>

                    <div className={styles.list}>
                        {entries.map((entry, i) => (
                            <div
                                key={entry.id}
                                className={`${styles.row} ${i === currentIdx ? styles.rowActive : ''}`}
                            >
                                <span className={styles.rowIndex}>{i + 1}</span>
                                <span className={styles.rowNumber}>{entry.number}</span>
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
    pending: '—',
    dialing: 'Dialing...',
    connected: 'Connected',
    completed: 'Completed',
    'no-answer': 'No answer',
    failed: 'Failed',
};
