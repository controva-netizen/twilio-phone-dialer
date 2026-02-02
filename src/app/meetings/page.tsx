import { AppLayout } from '@/components/Layout';
import styles from './page.module.css';

export default function MeetingsPage() {
    return (
        <AppLayout>
            <div className={styles.container}>
                <div className={styles.comingSoon}>
                    <div className={styles.icon}>
                        <VideoIcon />
                    </div>
                    <h1 className={styles.title}>Meetings</h1>
                    <p className={styles.description}>
                        Video meetings and conferencing are coming soon. Stay tuned for updates!
                    </p>
                    <div className={styles.badge}>Coming Soon</div>
                </div>
            </div>
        </AppLayout>
    );
}

function VideoIcon() {
    return (
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
    );
}
