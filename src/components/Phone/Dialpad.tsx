'use client';

import React, { useCallback } from 'react';
import styles from './Dialpad.module.css';

interface DialpadProps {
    onDigitPress: (digit: string) => void;
    onBackspace: () => void;
}

const dialpadButtons = [
    { digit: '1', letters: '' },
    { digit: '2', letters: 'ABC' },
    { digit: '3', letters: 'DEF' },
    { digit: '4', letters: 'GHI' },
    { digit: '5', letters: 'JKL' },
    { digit: '6', letters: 'MNO' },
    { digit: '7', letters: 'PQRS' },
    { digit: '8', letters: 'TUV' },
    { digit: '9', letters: 'WXYZ' },
    { digit: '*', letters: '' },
    { digit: '0', letters: '+' },
    { digit: '#', letters: '' },
];

export function Dialpad({ onDigitPress, onBackspace }: DialpadProps) {
    const handleClick = useCallback((digit: string) => {
        onDigitPress(digit);
    }, [onDigitPress]);

    return (
        <div className={styles.dialpad} role="group" aria-label="Dialpad">
            {dialpadButtons.map(({ digit, letters }) => (
                <button
                    key={digit}
                    className={styles.button}
                    onClick={() => handleClick(digit)}
                    aria-label={`${digit}${letters ? `, ${letters.split('').join(' ')}` : ''}`}
                >
                    <span className={styles.digit}>{digit}</span>
                    {letters && <span className={styles.letters}>{letters}</span>}
                    <span className={styles.ripple} aria-hidden="true" />
                </button>
            ))}

            {/* Backspace button */}
            <button
                className={`${styles.button} ${styles.backspace}`}
                onClick={onBackspace}
                aria-label="Backspace"
            >
                <BackspaceIcon />
            </button>
        </div>
    );
}

function BackspaceIcon() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
            <line x1="18" y1="9" x2="12" y2="15" />
            <line x1="12" y1="9" x2="18" y2="15" />
        </svg>
    );
}
