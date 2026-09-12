-- ==============================================================================
-- PACHAS MIGRATION 17: CLEANUP DEMO & TEST NOTIFICATIONS
-- ==============================================================================
-- Safely cleans up any legacy, simulated or seeded demo notifications, 
-- demo support inquiries, and fake test subscriptions from the database.
-- ==============================================================================

DO $$
BEGIN
    -- 1. If a public.notifications table exists in any environment, purge all demo entries
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'notifications'
    ) THEN
        DELETE FROM public.notifications
        WHERE id::text LIKE 'notif-demo-%'
           OR group_name = 'Vacaciones Playa'
           OR title LIKE '%Restaurante El Faro%'
           OR title LIKE '%Paella%'
           OR message LIKE '%Vacaciones Playa%';
    END IF;

    -- 2. Clean up any demo / mock push subscriptions
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'push_subscriptions'
    ) THEN
        DELETE FROM public.push_subscriptions
        WHERE endpoint LIKE '%demo%'
           OR endpoint LIKE '%test-endpoint%'
           OR endpoint LIKE '%example.com%';
    END IF;

    -- 3. Clean up any demo support messages if present
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'support_messages'
    ) THEN
        DELETE FROM public.support_messages
        WHERE id::text LIKE '%demo%'
           OR message LIKE '%demo-message%'
           OR message LIKE '%Mensaje de prueba demo%';
    END IF;
END $$;
