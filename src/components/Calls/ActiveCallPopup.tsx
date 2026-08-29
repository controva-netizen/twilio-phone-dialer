'use client';

import React, { useState, useRef, useEffect } from 'react';
import styles from './ActiveCallPopup.module.css';

interface ActiveCallPopupProps {
    remoteNumber: string;
    displayName?: string;
    duration: number;
    isMuted: boolean;
    onMuteToggle: () => void;
    onHangup: () => void;
    onDigit: (digit: string) => void;
}

export function ActiveCallPopup({
    remoteNumber,
    displayName,
    duration,
    isMuted,
    onMuteToggle,
    onHangup,
    onDigit,
}: ActiveCallPopupProps) {
    const [showKeypad, setShowKeypad] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const popupRef = useRef<HTMLDivElement>(null);

    // Center popup on mount
    useEffect(() => {
        if (popupRef.current) {
            const rect = popupRef.current.getBoundingClientRect();
            setPosition({
                x: (window.innerWidth - rect.width) / 2,
                y: (window.innerHeight - rect.height) / 2
            });
        }
    }, []);

    // Handle dragging
    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;
        setIsDragging(true);
        setDragOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            setPosition({
                x: e.clientX - dragOffset.x,
                y: e.clientY - dragOffset.y
            });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragOffset]);

    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const getInitials = (phoneNumber: string): string => {
        const hash = phoneNumber.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        return letters[hash % 26] + letters[(hash * 7) % 26];
    };

    const dialpadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
    const dialpadLetters: Record<string, string> = {
        '2': 'ABC', '3': 'DEF', '4': 'GHI', '5': 'JKL',
        '6': 'MNO', '7': 'PQRS', '8': 'TUV', '9': 'WXYZ', '0': '+'
    };

    // Minimized view
    if (isMinimized) {
        return (
            <div
                className={styles.minimized}
                style={{ left: position.x, top: position.y }}
                onMouseDown={handleMouseDown}
            >
                <div className={styles.minimizedContent}>
                    <div className={styles.statusDot} />
                    <span className={styles.minimizedNumber}>{displayName || remoteNumber}</span>
                    <span className={styles.minimizedDuration}>{formatDuration(duration)}</span>
                </div>
                <div className={styles.minimizedActions}>
                    <button className={styles.minimizedBtn} onClick={() => setIsMinimized(false)} title="Expand">
                        <ExpandIcon />
                    </button>
                    <button
                        className={`${styles.minimizedBtn} ${isMuted ? styles.muted : ''}`}
                        onClick={onMuteToggle}
                        title={isMuted ? 'Unmute' : 'Mute'}
                    >
                        {isMuted ? <MicOffIcon /> : <MicIcon />}
                    </button>
                    <button className={styles.minimizedHangup} onClick={onHangup} title="End call">
                        <HangupIcon />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={popupRef}
            className={`${styles.popup} ${isDragging ? styles.dragging : ''}`}
            style={{ left: position.x, top: position.y }}
            onMouseDown={handleMouseDown}
        >
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.statusBadge}>
                    <span className={styles.statusDot} />
                    <span>On call</span>
                </div>
                <button
                    className={styles.minimizeBtn}
                    onClick={() => setIsMinimized(true)}
                    title="Minimize"
                >
                    <MinimizeIcon />
                </button>
            </div>

            {/* Contact */}
            <div className={styles.contact}>
                <div className={styles.avatar}>
                    {getInitials(displayName || remoteNumber)}
                </div>
                <div className={styles.contactInfo}>
                    <span className={styles.name}>{displayName || remoteNumber}</span>
                    {displayName && <span className={styles.duration}>{remoteNumber}</span>}
                    <span className={styles.duration}>{formatDuration(duration)}</span>
                </div>
            </div>

            {/* Keypad (if visible) */}
            {showKeypad && (
                <div className={styles.keypad}>
                    {dialpadKeys.map((key) => (
                        <button
                            key={key}
                            className={styles.keypadKey}
                            onClick={() => onDigit(key)}
                        >
                            <span className={styles.keyDigit}>{key}</span>
                            {dialpadLetters[key] && (
                                <span className={styles.keyLetters}>{dialpadLetters[key]}</span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* Controls Row 1 */}
            <div className={styles.controls}>
                <button
                    className={`${styles.controlBtn} ${isMuted ? styles.active : ''}`}
                    onClick={onMuteToggle}
                    title={isMuted ? 'Unmute' : 'Mute'}
                >
                    {isMuted ? <MicOffIcon /> : <MicIcon />}
                    <span>Mute</span>
                </button>
                <button
                    className={`${styles.controlBtn} ${showKeypad ? styles.active : ''}`}
                    onClick={() => setShowKeypad(!showKeypad)}
                    title="Keypad"
                >
                    <KeypadIcon />
                    <span>Keypad</span>
                </button>
                <button className={styles.controlBtn} title="Speaker">
                    <SpeakerIcon />
                    <span>Speaker</span>
                </button>
            </div>

            {/* Controls Row 2 */}
            <div className={styles.controls}>
                <button className={styles.controlBtn} title="Add call">
                    <AddIcon />
                    <span>Add</span>
                </button>
                <button className={styles.controlBtn} title="Transfer">
                    <TransferIcon />
                    <span>Video</span>
                </button>
                <button className={styles.controlBtn} title="More options">
                    <MoreIcon />
                    <span>More</span>
                </button>
            </div>

            {/* Hangup */}
            <button className={styles.hangupBtn} onClick={onHangup}>
                <HangupIcon />
            </button>

            {/* Drag hint */}
            <div className={styles.dragHint}>Drag to move</div>
        </div>
    );
}

// Icons
function MinimizeIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    );
}

function ExpandIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
    );
}

function MicIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
    );
}

function MicOffIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
    );
}

function KeypadIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="4" cy="4" r="2" />
            <circle cx="12" cy="4" r="2" />
            <circle cx="20" cy="4" r="2" />
            <circle cx="4" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="20" cy="12" r="2" />
            <circle cx="4" cy="20" r="2" />
            <circle cx="12" cy="20" r="2" />
            <circle cx="20" cy="20" r="2" />
        </svg>
    );
}

function SpeakerIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
    );
}

function AddIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    );
}

function TransferIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
    );
}

function MoreIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="2" />
            <circle cx="20" cy="12" r="2" />
            <circle cx="4" cy="12" r="2" />
        </svg>
    );
}

function HangupIcon() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71s-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 0 0-2.67-1.85.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
        </svg>
    );
}
