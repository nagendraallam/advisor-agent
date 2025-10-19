-- Migration: Add Chats and Ongoing Tasks
-- This enables multi-chat support and task tracking

-- 1. Create chats table
CREATE TABLE IF NOT EXISTS chats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) DEFAULT 'New Chat',
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chats_user_id ON chats(user_id);
CREATE INDEX idx_chats_last_activity ON chats(user_id, last_activity DESC);

-- 2. Create ongoing_tasks table
CREATE TABLE IF NOT EXISTS ongoing_tasks (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Task details
    task_type VARCHAR(50) NOT NULL DEFAULT 'email_response',
    status VARCHAR(50) NOT NULL DEFAULT 'waiting',
    description TEXT,
    
    -- Who/what we're waiting for
    expected_sender_email VARCHAR(255),
    expected_sender_name VARCHAR(255),
    related_email_id INTEGER REFERENCES emails(id),
    
    -- Additional context
    context JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ongoing_tasks_status ON ongoing_tasks(status) WHERE status = 'waiting';
CREATE INDEX idx_ongoing_tasks_user_id ON ongoing_tasks(user_id);
CREATE INDEX idx_ongoing_tasks_chat_id ON ongoing_tasks(chat_id);
CREATE INDEX idx_ongoing_tasks_sender ON ongoing_tasks(expected_sender_email) WHERE status = 'waiting';

-- 3. Add chat_id to chat_messages table (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='chat_messages' AND column_name='chat_id'
    ) THEN
        ALTER TABLE chat_messages ADD COLUMN chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE;
        CREATE INDEX idx_chat_messages_chat_id ON chat_messages(chat_id);
    END IF;
END $$;

-- 4. Create default chat for existing messages
DO $$
DECLARE
    user_record RECORD;
    default_chat_id INTEGER;
BEGIN
    -- For each user that has messages without a chat_id
    FOR user_record IN 
        SELECT DISTINCT user_id 
        FROM chat_messages 
        WHERE chat_id IS NULL
    LOOP
        -- Create a default chat for this user
        INSERT INTO chats (user_id, name, created_at)
        VALUES (user_record.user_id, 'Default Chat', 
                (SELECT MIN(created_at) FROM chat_messages WHERE user_id = user_record.user_id))
        RETURNING id INTO default_chat_id;
        
        -- Assign all existing messages to this chat
        UPDATE chat_messages
        SET chat_id = default_chat_id
        WHERE user_id = user_record.user_id AND chat_id IS NULL;
    END LOOP;
END $$;

-- 5. Add email_monitoring_status table for tracking last check
CREATE TABLE IF NOT EXISTS email_monitoring_status (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    last_check_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_email_processed VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_monitoring_user_id ON email_monitoring_status(user_id);

-- Comments for documentation
COMMENT ON TABLE chats IS 'Individual chat sessions, each can have multiple messages and ongoing tasks';
COMMENT ON TABLE ongoing_tasks IS 'Tasks waiting for completion (e.g., email responses, meeting confirmations)';
COMMENT ON TABLE email_monitoring_status IS 'Tracks last email check time per user for monitoring service';

