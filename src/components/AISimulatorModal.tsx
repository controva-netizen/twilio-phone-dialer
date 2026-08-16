'use client';

import React, { useState } from 'react';
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
    "Is this a scam? Why do I have to pay?",
    "I don't have the money to pay this fee.",
    "Why can't you deduct it from my winnings?",
    "I want to talk to my lawyer and family first.",
    "Can you send me something in writing first?",
    "How did you get my name and phone number?",
    "I never heard of this sweepstakes.",
    "Can I speak with a human specialist right now?",
];

export const AISimulatorModal: React.FC<AISimulatorModalProps> = ({
    isOpen,
    onClose,
    onStartBrowserAudioCall,
}) => {
    const [messages, setMessages] = useState<Message[]>([
        {
            sender: 'ai',
            text: "Hello! My name is Officer Alex Miller with the Federal Consumer Award Oversight Bureau. I'm calling regarding a time-sensitive unclaimed consumer award file for $950,000. Are you available for just a moment so I can share the details with you?",
        },
    ]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSend = async (textToSend?: string) => {
        const query = (textToSend || inputText).trim();
        if (!query || loading) return;

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

            setMessages([...newHistory, aiMsg]);

            // Play browser audio if available
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(aiMsg.text);
                utterance.rate = 1.0;
                window.speechSynthesis.speak(utterance);
            }
        } catch (err) {
            console.error('Simulation error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setMessages([
            {
                sender: 'ai',
                text: "Hello! My name is Officer Alex Miller with the Federal Consumer Award Oversight Bureau. I'm calling regarding a time-sensitive unclaimed consumer award file for $950,000. Are you available for just a moment so I can share the details with you?",
            },
        ]);
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
    };

    return (
        <div className={styles.backdrop} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.titleInfo}>
                        <h2 className={styles.title}>🧪 Marvik AI Voice Simulator Studio</h2>
                        <span className={styles.subtitle}>Test objections, responses, and live transfer logic without making a real phone call</span>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>×</button>
                </div>

                {/* Body */}
                <div className={styles.body}>
                    {/* Live In-Browser Call Action Banner */}
                    <div className={styles.audioTestBanner}>
                        <div className={styles.audioBannerInfo}>
                            <strong>🎧 Want to talk via your Computer Microphone?</strong>
                            <span>Start a 100% free in-browser WebRTC call directly to the AI agent.</span>
                        </div>
                        <button
                            className={styles.startAudioCallBtn}
                            onClick={() => {
                                onClose();
                                onStartBrowserAudioCall();
                            }}
                        >
                            📞 Connect Mic & Speak Live (*99)
                        </button>
                    </div>

                    {/* Quick Objection Chips */}
                    <div className={styles.chipsSection}>
                        <span className={styles.chipsLabel}>Test Quick Objection:</span>
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
                                <div className={styles.avatar}>
                                    {m.sender === 'user' ? '👤 Caller' : '🤖 AI Agent'}
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
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className={`${styles.messageRow} ${styles.aiRow}`}>
                                <div className={styles.avatar}>🤖 AI Agent</div>
                                <div className={`${styles.bubble} ${styles.aiBubble}`}>
                                    <span className={styles.typingDot}>AI is thinking & reasoning...</span>
                                </div>
                            </div>
                        )}
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
                        placeholder="Type what the customer says (e.g. 'Why should I pay first?')..."
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
                        {loading ? 'Sending...' : 'Test Response'}
                    </button>
                </div>
            </div>
        </div>
    );
};
