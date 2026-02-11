-- ============================================
-- Twilio Voice Recording & Voicemail Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Add voice feature columns to user_phone_numbers
ALTER TABLE user_phone_numbers
ADD COLUMN IF NOT EXISTS call_recording_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS voicemail_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS voicemail_greeting_url TEXT;

-- 2. Create call_recordings table (stores both recordings and voicemails)
CREATE TABLE IF NOT EXISTS call_recordings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    caller_number TEXT,
    recording_url TEXT NOT NULL,
    recording_sid TEXT,
    call_sid TEXT,
    duration INTEGER DEFAULT 0,
    recording_type TEXT NOT NULL DEFAULT 'recording' CHECK (recording_type IN ('recording', 'voicemail')),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Add RLS policies for call_recordings
ALTER TABLE call_recordings ENABLE ROW LEVEL SECURITY;

-- Users can only see their own recordings
CREATE POLICY "Users can view own recordings"
    ON call_recordings FOR SELECT
    USING (auth.uid() = user_id);

-- Allow inserts from service role (API routes use service role or anon with proper checks)
CREATE POLICY "Allow insert recordings"
    ON call_recordings FOR INSERT
    WITH CHECK (true);

-- Users can update their own recordings (e.g., mark as read)
CREATE POLICY "Users can update own recordings"
    ON call_recordings FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own recordings
CREATE POLICY "Users can delete own recordings"
    ON call_recordings FOR DELETE
    USING (auth.uid() = user_id);

-- 4. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_call_recordings_user_id ON call_recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_call_recordings_type ON call_recordings(recording_type);
CREATE INDEX IF NOT EXISTS idx_call_recordings_created_at ON call_recordings(created_at DESC);
