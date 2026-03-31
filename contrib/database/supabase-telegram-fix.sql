-- Fix: chat_id must be nullable (null when pending verification, set when verified)
ALTER TABLE telegram_subscriptions ALTER COLUMN chat_id DROP NOT NULL;
