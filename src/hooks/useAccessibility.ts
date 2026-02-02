'use client';

import { useState, useCallback, useEffect } from 'react';
import type { AccessibilityPreferences } from '@/types';

const STORAGE_KEY = 'twilio-phone-accessibility';

const defaultPreferences: AccessibilityPreferences = {
    theme: 'system',
    fontSize: 'normal',
    highContrast: false,
    reducedMotion: false,
};

interface UseAccessibilityReturn {
    preferences: AccessibilityPreferences;
    setTheme: (theme: AccessibilityPreferences['theme']) => void;
    setFontSize: (size: AccessibilityPreferences['fontSize']) => void;
    setHighContrast: (enabled: boolean) => void;
    setReducedMotion: (enabled: boolean) => void;
    resetPreferences: () => void;
}

export function useAccessibility(): UseAccessibilityReturn {
    const [preferences, setPreferences] = useState<AccessibilityPreferences>(defaultPreferences);

    // Load preferences from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                setPreferences({ ...defaultPreferences, ...parsed });
            }
        } catch (err) {
            console.error('Failed to load accessibility preferences:', err);
        }
    }, []);

    // Apply preferences to document
    useEffect(() => {
        const root = document.documentElement;

        // Apply theme
        let effectiveTheme = preferences.theme;
        if (preferences.theme === 'system') {
            effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        root.setAttribute('data-theme', effectiveTheme);

        // Apply font size
        root.setAttribute('data-font-size', preferences.fontSize);

        // Apply high contrast
        root.setAttribute('data-high-contrast', String(preferences.highContrast));

        // Apply reduced motion
        root.setAttribute('data-reduced-motion', String(preferences.reducedMotion));
    }, [preferences]);

    // Listen for system theme changes
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const handleChange = () => {
            if (preferences.theme === 'system') {
                const root = document.documentElement;
                root.setAttribute('data-theme', mediaQuery.matches ? 'dark' : 'light');
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [preferences.theme]);

    // Save preferences to localStorage
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
        } catch (err) {
            console.error('Failed to save accessibility preferences:', err);
        }
    }, [preferences]);

    const setTheme = useCallback((theme: AccessibilityPreferences['theme']) => {
        setPreferences((prev) => ({ ...prev, theme }));
    }, []);

    const setFontSize = useCallback((fontSize: AccessibilityPreferences['fontSize']) => {
        setPreferences((prev) => ({ ...prev, fontSize }));
    }, []);

    const setHighContrast = useCallback((highContrast: boolean) => {
        setPreferences((prev) => ({ ...prev, highContrast }));
    }, []);

    const setReducedMotion = useCallback((reducedMotion: boolean) => {
        setPreferences((prev) => ({ ...prev, reducedMotion }));
    }, []);

    const resetPreferences = useCallback(() => {
        setPreferences(defaultPreferences);
        localStorage.removeItem(STORAGE_KEY);
    }, []);

    return {
        preferences,
        setTheme,
        setFontSize,
        setHighContrast,
        setReducedMotion,
        resetPreferences,
    };
}
