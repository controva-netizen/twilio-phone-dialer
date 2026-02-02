'use client';

import { useState, useCallback, useEffect } from 'react';
import type { CallHistoryEntry, CallHistoryFilter, CallDirection } from '@/types';

const STORAGE_KEY = 'twilio-phone-call-history';
const MAX_HISTORY_ENTRIES = 100;

interface UseCallHistoryReturn {
    history: CallHistoryEntry[];
    filteredHistory: CallHistoryEntry[];
    filter: CallHistoryFilter;
    setFilter: (filter: CallHistoryFilter) => void;
    addEntry: (entry: Omit<CallHistoryEntry, 'id'>) => void;
    clearHistory: () => void;
    getEntryById: (id: string) => CallHistoryEntry | undefined;
}

export function useCallHistory(): UseCallHistoryReturn {
    const [history, setHistory] = useState<CallHistoryEntry[]>([]);
    const [filter, setFilter] = useState<CallHistoryFilter>('all');

    // Load history from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Convert timestamp strings back to Date objects
                const entries = parsed.map((entry: CallHistoryEntry) => ({
                    ...entry,
                    timestamp: new Date(entry.timestamp),
                }));
                setHistory(entries);
            }
        } catch (err) {
            console.error('Failed to load call history:', err);
        }
    }, []);

    // Save history to localStorage when it changes
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        } catch (err) {
            console.error('Failed to save call history:', err);
        }
    }, [history]);

    // Add new entry
    const addEntry = useCallback((entry: Omit<CallHistoryEntry, 'id'>) => {
        const newEntry: CallHistoryEntry = {
            ...entry,
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };

        setHistory((prev) => {
            const updated = [newEntry, ...prev];
            // Limit to max entries
            return updated.slice(0, MAX_HISTORY_ENTRIES);
        });
    }, []);

    // Clear all history
    const clearHistory = useCallback(() => {
        setHistory([]);
        localStorage.removeItem(STORAGE_KEY);
    }, []);

    // Get entry by ID
    const getEntryById = useCallback((id: string) => {
        return history.find((entry) => entry.id === id);
    }, [history]);

    // Filter history based on current filter
    const filteredHistory = history.filter((entry) => {
        switch (filter) {
            case 'incoming':
                return entry.direction === 'incoming';
            case 'outgoing':
                return entry.direction === 'outgoing';
            case 'missed':
                return entry.status === 'missed';
            default:
                return true;
        }
    });

    return {
        history,
        filteredHistory,
        filter,
        setFilter,
        addEntry,
        clearHistory,
        getEntryById,
    };
}

// Helper function to create a call history entry
export function createCallHistoryEntry(
    direction: CallDirection,
    phoneNumber: string,
    duration: number,
    status: 'completed' | 'missed' | 'rejected'
): Omit<CallHistoryEntry, 'id'> {
    return {
        direction,
        phoneNumber,
        timestamp: new Date(),
        duration,
        status,
    };
}
