// Call types
export type CallDirection = 'incoming' | 'outgoing';
export type CallStatus = 'idle' | 'connecting' | 'ringing' | 'connected' | 'disconnected';

export interface CallInfo {
    direction: CallDirection;
    phoneNumber: string;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    status: CallStatus;
}

// Call history types
export interface CallHistoryEntry {
    id: string;
    direction: CallDirection;
    phoneNumber: string;
    timestamp: Date;
    duration: number; // in seconds
    status: 'completed' | 'missed' | 'rejected';
}

export type CallHistoryFilter = 'all' | 'incoming' | 'outgoing' | 'missed';

// Device status
export type DeviceStatus = 'offline' | 'connecting' | 'ready' | 'busy' | 'error';

// Accessibility preferences
export interface AccessibilityPreferences {
    theme: 'light' | 'dark' | 'system';
    fontSize: 'small' | 'normal' | 'large' | 'extra-large';
    highContrast: boolean;
    reducedMotion: boolean;
}

// Audio settings
export interface AudioDevice {
    deviceId: string;
    label: string;
}
