import { AppLayout } from '@/components/Layout';
import styles from './page.module.css';

export default function SettingsPage() {
    return (
        <AppLayout>
            <div className={styles.container}>
                <div className={styles.header}>
                    <h1 className={styles.title}>Settings</h1>
                </div>

                <div className={styles.sections}>
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
