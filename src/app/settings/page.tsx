'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { AppLayout } from '@/components/Layout';
import styles from './page.module.css';

interface PhoneNumber {
    id: string;
    phone_number: string;
    friendly_name: string | null;
    is_default: boolean;
}

export default function SettingsPage() {
    const [user, setUser] = useState<{ email?: string | null } | null>(null);
    const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
    const [selectedNumber, setSelectedNumber] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Fetch user and their phone numbers
    useEffect(() => {
        async function fetchData() {
            const supabase = createClient();

            // Get user
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);

            // Fetch phone numbers
            try {
                const res = await fetch('/api/user/numbers');
                const data = await res.json();

                if (data.numbers) {
                    setNumbers(data.numbers);
                    const defaultNum = data.numbers.find((n: PhoneNumber) => n.is_default);
                    setSelectedNumber(defaultNum?.phone_number || data.numbers[0]?.phone_number || '');
                }
            } catch (err) {
                console.error('Failed to fetch numbers:', err);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, []);

    // Update default number
    const handleNumberChange = async (phoneNumber: string) => {
        setSelectedNumber(phoneNumber);
        setSaving(true);

        try {
            await fetch('/api/user/numbers', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber }),
            });
        } catch (err) {
            console.error('Failed to update default:', err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <AppLayout user={user || undefined}>
            <div className={styles.container}>
                <div className={styles.header}>
                    <h1 className={styles.title}>Settings</h1>
                </div>

                <div className={styles.sections}>
                    {/* Phone Number Settings */}
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Phone Number</h2>
                        <div className={styles.card}>
                            <div className={styles.setting}>
                                <div className={styles.settingInfo}>
                                    <span className={styles.settingLabel}>Default Caller ID</span>
                                    <span className={styles.settingDesc}>Number used for outgoing calls</span>
                                </div>
                                {loading ? (
                                    <span className={styles.loading}>Loading...</span>
                                ) : numbers.length === 0 ? (
                                    <span className={styles.noNumbers}>No numbers assigned</span>
                                ) : (
                                    <select
                                        className={styles.select}
                                        value={selectedNumber}
                                        onChange={(e) => handleNumberChange(e.target.value)}
                                        disabled={saving}
                                    >
                                        {numbers.map((num) => (
                                            <option key={num.id} value={num.phone_number}>
                                                {num.friendly_name || num.phone_number}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* Audio Settings */}
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Audio</h2>
                        <div className={styles.card}>
                            <div className={styles.setting}>
                                <div className={styles.settingInfo}>
                                    <span className={styles.settingLabel}>Speaker</span>
                                    <span className={styles.settingDesc}>Select your audio output device</span>
                                </div>
                                <select className={styles.select}>
                                    <option>Default Speaker</option>
                                </select>
                            </div>
                            <div className={styles.setting}>
                                <div className={styles.settingInfo}>
                                    <span className={styles.settingLabel}>Microphone</span>
                                    <span className={styles.settingDesc}>Select your audio input device</span>
                                </div>
                                <select className={styles.select}>
                                    <option>Default Microphone</option>
                                </select>
                            </div>
                        </div>
                    </section>

                    {/* Appearance */}
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Appearance</h2>
                        <div className={styles.card}>
                            <div className={styles.setting}>
                                <div className={styles.settingInfo}>
                                    <span className={styles.settingLabel}>Theme</span>
                                    <span className={styles.settingDesc}>Choose your preferred color theme</span>
                                </div>
                                <select className={styles.select}>
                                    <option value="dark">Dark</option>
                                    <option value="light">Light</option>
                                    <option value="system">System</option>
                                </select>
                            </div>
                        </div>
                    </section>

                    {/* About */}
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>About</h2>
                        <div className={styles.card}>
                            <div className={styles.about}>
                                <p>TwilioPhone v1.0.0</p>
                                <p className={styles.aboutDesc}>Browser-based calling powered by Twilio Voice SDK</p>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </AppLayout>
    );
}
