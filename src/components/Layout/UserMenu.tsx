'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase';
import styles from './UserMenu.module.css';

interface UserMenuProps {
    user?: {
        email?: string | null;
    };
}

export function UserMenu({ user }: UserMenuProps) {
    const [showMenu, setShowMenu] = useState(false);

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    const initials = user?.email?.[0]?.toUpperCase() || 'U';

    return (
        <div className={styles.container}>
            <button
                className={styles.avatar}
                onClick={() => setShowMenu(!showMenu)}
                aria-label="User menu"
            >
                <span>{initials}</span>
            </button>

            {showMenu && (
                <>
                    <div className={styles.overlay} onClick={() => setShowMenu(false)} />
                    <div className={styles.menu}>
                        <div className={styles.userInfo}>
                            <div className={styles.userDetails}>
                                <span className={styles.userEmail}>{user?.email || 'User'}</span>
                            </div>
                        </div>
                        <div className={styles.divider} />
                        <button className={styles.menuItem} onClick={handleLogout}>
                            <LogoutIcon />
                            <span>Sign out</span>
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

function LogoutIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
    );
}
