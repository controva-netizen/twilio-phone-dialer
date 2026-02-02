'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Device } from '@twilio/voice-sdk';
import type { AudioDevice } from '@/types';
import styles from './AudioSettings.module.css';

interface AudioSettingsProps {
    device: Device | null;
    onClose: () => void;
}

export function AudioSettings({ device, onClose }: AudioSettingsProps) {
    const [outputDevices, setOutputDevices] = useState<AudioDevice[]>([]);
    const [selectedOutput, setSelectedOutput] = useState<string>('');
    const [isTestingSound, setIsTestingSound] = useState(false);

    // Load audio devices
    useEffect(() => {
        const loadDevices = async () => {
            try {
                // Request microphone permission to get device labels
                await navigator.mediaDevices.getUserMedia({ audio: true });

                const devices = await navigator.mediaDevices.enumerateDevices();
                const outputs = devices
                    .filter((d) => d.kind === 'audiooutput')
                    .map((d) => ({
                        deviceId: d.deviceId,
                        label: d.label || `Speaker ${d.deviceId.slice(0, 8)}`,
                    }));

                setOutputDevices(outputs);

                // Set default selection
                if (outputs.length > 0 && !selectedOutput) {
                    setSelectedOutput(outputs[0].deviceId);
                }
            } catch (err) {
                console.error('Failed to enumerate devices:', err);
            }
        };

        loadDevices();
    }, [selectedOutput]);

    // Handle output device change
    const handleOutputChange = useCallback(async (deviceId: string) => {
        setSelectedOutput(deviceId);

        if (device) {
            try {
                await device.audio?.speakerDevices.set(deviceId);
            } catch (err) {
                console.error('Failed to set speaker device:', err);
            }
        }
    }, [device]);

    // Test sound
    const handleTestSound = useCallback(async () => {
        setIsTestingSound(true);

        try {
            // Create a simple test tone
            const audioContext = new AudioContext();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 440; // A4 note
            oscillator.type = 'sine';
            gainNode.gain.value = 0.5;

            oscillator.start();

            // Fade out
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            setTimeout(() => {
                oscillator.stop();
                audioContext.close();
                setIsTestingSound(false);
            }, 500);
        } catch (err) {
            console.error('Failed to play test sound:', err);
            setIsTestingSound(false);
        }
    }, []);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h3 className={styles.title}>Audio Settings</h3>
                <button className={styles.closeButton} onClick={onClose} aria-label="Close settings">
                    <CloseIcon />
                </button>
            </div>

            <div className={styles.content}>
                {/* Output Device */}
                <div className={styles.section}>
                    <label htmlFor="output-device" className={styles.label}>
                        Speaker / Output
                    </label>
                    <select
                        id="output-device"
                        className={styles.select}
                        value={selectedOutput}
                        onChange={(e) => handleOutputChange(e.target.value)}
                    >
                        {outputDevices.map((d) => (
                            <option key={d.deviceId} value={d.deviceId}>
                                {d.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Test Sound */}
                <div className={styles.section}>
                    <button
                        className={styles.testButton}
                        onClick={handleTestSound}
                        disabled={isTestingSound}
                    >
                        {isTestingSound ? (
                            <>
                                <SoundWaveIcon /> Playing...
                            </>
                        ) : (
                            <>
                                <SpeakerIcon /> Test Sound
                            </>
                        )}
                    </button>
                </div>

                {/* Info */}
                <p className={styles.info}>
                    Microphone access is required for calls. Your browser will prompt for permission when needed.
                </p>
            </div>
        </div>
    );
}

function CloseIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    );
}

function SpeakerIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
    );
}

function SoundWaveIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 10v4" />
            <path d="M6 6v12" />
            <path d="M10 8v8" />
            <path d="M14 4v16" />
            <path d="M18 8v8" />
            <path d="M22 10v4" />
        </svg>
    );
}
