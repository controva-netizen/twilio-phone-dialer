'use client';

import React, { useState, useEffect, useRef } from 'react';
import styles from './AISimulatorModal.module.css';

interface Message {
    sender: 'user' | 'ai';
    text: string;
    shouldTransfer?: boolean;
    provider?: string;
    latencyMs?: number;
}

interface AISimulatorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStartBrowserAudioCall: () => void;
}

const SAMPLE_OBJECTIONS = [
    "I have to pay? That sounds like a scam.",
    "Why can't you deduct the fee from my winnings?",
    "I don't have $1,500 for a registration fee.",
    "Can you send me something in writing first?",
    "I want to talk to my lawyer or son first.",
    "How did you get my name and phone number?",
    "What is the claim number and deadline?",
    "Can I speak with a live senior specialist?",
];

export const AISimulatorModal: React.FC<AISimulatorModalProps> = ({
    isOpen,
    onClose,
    onStartBrowserAudioCall,
}) => {
    const [messages, setMessages] = useState<Message[]>([
        {
            sender: 'ai',
            text: "Hello! My name is Alex, and I am a Senior Recovery Specialist with the Consumer Award Resolution Bureau. I have a time-sensitive file here regarding an unclaimed sweepstakes award in your name. Do you have a quick moment to speak with me?",
        },
    ]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [autoSpeak, setAutoSpeak] = useState(true);
    const [currentlySpeakingIdx, setCurrentlySpeakingIdx] = useState<number | null>(null);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Initialize speech synthesis voices
    useEffect(() => {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

        const updateVoices = () => {
            const available = window.speechSynthesis.getVoices();
            if (available.length > 0) {
                setVoices(available);
            }
        };

        updateVoices();
        window.speechSynthesis.onvoiceschanged = updateVoices;

        return () => {
            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
            }
        };
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    if (!isOpen) return null;

    const playVoice = (text: string, msgIdx?: number) => {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

        window.speechSynthesis.cancel();

        const cleanText = text
            .replace(/\[TRANSFER\]/gi, '')
            .replace(/[*_#]/g, '')
            .trim();

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.05;
        utterance.pitch = 1.0;

        // Try to pick the best natural English voice
        if (voices.length > 0) {
            const preferredVoice =
                voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Google') || v.name.includes('Jenny') || v.name.includes('Zira') || v.name.includes('Samantha'))) ||
                voices.find(v => v.lang.startsWith('en')) ||
                voices[0];
            if (preferredVoice) utterance.voice = preferredVoice;
        }

        if (msgIdx !== undefined) setCurrentlySpeakingIdx(msgIdx);

        utterance.onend = () => setCurrentlySpeakingIdx(null);
        utterance.onerror = () => setCurrentlySpeakingIdx(null);

        window.speechSynthesis.resume();
        window.speechSynthesis.speak(utterance);
    };

    const stopSpeaking = () => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            setCurrentlySpeakingIdx(null);
        }
    };

    const handleSend = async (textToSend?: string) => {
        const query = (textToSend || inputText).trim();
        if (!query || loading) return;

        stopSpeaking();

        const userMsg: Message = { sender: 'user', text: query };
        const newHistory = [...messages, userMsg];
        setMessages(newHistory);
        setInputText('');
        setLoading(true);

        try {
            const res = await fetch('/api/ai/simulate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: query,
                    history: newHistory.map(m => ({
                        role: m.sender === 'user' ? 'user' : 'assistant',
                        content: m.text,
                    })),
                }),
            });

            const data = await res.json();
            const aiMsg: Message = {
                sender: 'ai',
                text: data.reply || "Let me connect you directly with our senior specialist right now.",
                shouldTransfer: data.shouldTransfer,
                provider: data.provider,
                latencyMs: data.latencyMs,
            };

            const updatedHistory = [...newHistory, aiMsg];
            setMessages(updatedHistory);

            if (autoSpeak) {
                playVoice(aiMsg.text, updatedHistory.length - 1);
            }
        } catch (err) {
            console.error('Simulation error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        stopSpeaking();
        setMessages([
            {
                sender: 'ai',
                text: "Hi, this is Alex calling from our company. I'm reaching out regarding your recent inquiry. Do you have a moment to talk?",
            },
        ]);
    };

    return (
        <div className={styles.backdrop} onClick={() => { stopSpeaking(); onClose(); }}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.titleInfo}>
                        <div className={styles.titleRow}>
                            <h2 className={styles.title}>🧪 Marvik AI Voice Simulator Studio</h2>
                            <span className={styles.liveBadge}>● LIVE SPEAKER READY</span>
                        </div>
                        <span className={styles.subtitle}>Test objections, AI voice audio, and live transfer triggers instantly</span>
                    </div>
                    <div className={styles.headerActions}>
                        <label className={styles.autoSpeakToggle} title="Automatically play AI voice out loud">
                            <input
                                type="checkbox"
                                checked={autoSpeak}
                                onChange={(e) => setAutoSpeak(e.target.checked)}
                            />
                            <span>🔊 Auto-Speak</span>
                        </label>
                        <button className={styles.closeBtn} onClick={() => { stopSpeaking(); onClose(); }}>×</button>
                    </div>
                </div>

                {/* Body */}
                <div className={styles.body}>
                    {/* Live In-Browser Call Action Banner */}
                    <div className={styles.audioTestBanner}>
                        <div className={styles.audioBannerInfo}>
                            <strong>🎧 Speak via Your Computer Microphone (*99)</strong>
                            <span>Start a 100% free live 2-way WebRTC voice conversation with the AI.</span>
                        </div>
                        <button
                            className={styles.startAudioCallBtn}
                            onClick={() => {
                                stopSpeaking();
                                onClose();
                                onStartBrowserAudioCall();
                            }}
                        >
                            📞 Connect Mic & Speak Live (*99)
                        </button>
                    </div>

                    {/* Quick Objection Chips */}
                    <div className={styles.chipsSection}>
                        <span className={styles.chipsLabel}>Quick Objection Test Chips:</span>
                        <div className={styles.chipsGrid}>
                            {SAMPLE_OBJECTIONS.map((obj, i) => (
                                <button
                                    key={i}
                                    className={styles.chip}
                                    onClick={() => handleSend(obj)}
                                    disabled={loading}
                                >
                                    💬 {obj}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Chat Conversation History */}
                    <div className={styles.chatBox}>
                        {messages.map((m, idx) => (
                            <div
                                key={idx}
                                className={`${styles.messageRow} ${m.sender === 'user' ? styles.userRow : styles.aiRow}`}
                            >
                                <div className={styles.avatarRow}>
                                    <span className={styles.avatar}>
                                        {m.sender === 'user' ? '👤 Caller' : '🤖 AI Voice Agent'}
                                    </span>
                                    {m.sender === 'ai' && (
                                        <button
                                            className={`${styles.playAudioBtn} ${currentlySpeakingIdx === idx ? styles.speakingActive : ''}`}
                                            onClick={() => currentlySpeakingIdx === idx ? stopSpeaking() : playVoice(m.text, idx)}
                                            title="Listen to AI voice"
                                        >
                                            {currentlySpeakingIdx === idx ? '⏹️ Stop' : '🔊 Listen Voice'}
                                        </button>
                                    )}
                                </div>
                                <div className={`${styles.bubble} ${m.sender === 'user' ? styles.userBubble : styles.aiBubble}`}>
                                    <p className={styles.messageText}>{m.text}</p>
                                    {m.sender === 'ai' && (
                                        <div className={styles.metaRow}>
                                            {m.shouldTransfer && (
                                                <span className={styles.transferTag}>
                                                    🔁 Live Softphone Transfer Triggered
                                                </span>
                                            )}
                                            {m.provider && (
                                                <span className={styles.providerTag}>
                                                    ⚡ {m.provider.toUpperCase()} ({m.latencyMs}ms)
                                                </span>
                                            )}
                                            {currentlySpeakingIdx === idx && (
                                                <span className={styles.speakingIndicator}>
                                                    <span className={styles.soundWave}></span>
                                                    <span>Speaking aloud...</span>
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className={`${styles.messageRow} ${styles.aiRow}`}>
                                <div className={styles.avatar}>🤖 AI Voice Agent</div>
                                <div className={`${styles.bubble} ${styles.aiBubble}`}>
                                    <span className={styles.typingDot}>AI is reasoning & formulating speech...</span>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>
                </div>

                {/* Footer Input */}
                <div className={styles.footer}>
                    <button className={styles.resetBtn} onClick={handleReset} title="Reset Conversation">
                        🔄 Reset
                    </button>
                    <input
                        type="text"
                        className={styles.input}
                        placeholder="Type what the customer says (e.g. 'Is this a scam? Why do I pay?')..."
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        disabled={loading}
                    />
                    <button
                        className={styles.sendBtn}
                        onClick={() => handleSend()}
                        disabled={loading || !inputText.trim()}
                    >
                        {loading ? 'Sending...' : 'Test Speech & Response'}
                    </button>
                </div>
            </div>
        </div>
    );
};
