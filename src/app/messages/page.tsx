import { AppLayout } from '@/components/Layout';
import styles from './page.module.css';

export default function MessagesPage() {
    return (
        <AppLayout>
            <div className={styles.container}>
                <div className={styles.comingSoon}>
                    <div className={styles.icon}>
                        <MessageIcon />
                    </div>
                    <h1 className={styles.title}>Messages</h1>
                    <p className={styles.description}>
                        SMS and chat messaging is coming soon. Stay tuned for updates!
                    </p>
                    <div className={styles.badge}>Coming Soon</div>
                </div>
            </div>
        </AppLayout>
    );
}

function MessageIcon() {
    return (
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
    );
}
