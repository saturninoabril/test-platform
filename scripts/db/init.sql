-- PostgreSQL initialization script
-- This script runs when the PostgreSQL container starts for the first time

-- Enable UUID extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_trgm extension for text search optimizations
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create additional user for testing (optional)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_user WHERE usename = 'change_user') THEN
        CREATE USER change_user WITH PASSWORD 'change_password';
    END IF;
END
$$;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE change_db TO change_user;
GRANT CONNECT ON DATABASE change_db TO change_user;

-- Create test database for running tests
SELECT 'CREATE DATABASE change_db_test' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'change_db_test')\gexec
GRANT ALL PRIVILEGES ON DATABASE change_db_test TO change_user;
GRANT CONNECT ON DATABASE change_db_test TO change_user;

-- Set up connection limits and performance tunings
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;

-- Apply the configuration changes
SELECT pg_reload_conf();
