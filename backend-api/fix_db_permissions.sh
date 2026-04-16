#!/bin/bash

# Script to fix PostgreSQL schema ownership and permissions
# Usage: ./fix_db_permissions.sh

echo "=========================================="
echo "Fixing PostgreSQL Schema Permissions"
echo "=========================================="

# Database 1: sales_dashboard_prod with prod_user
echo ""
echo "1. Fixing sales_dashboard_prod database..."
psql -h 172.31.82.254 -U postgres -d sales_dashboard_prod << EOF
-- Grant ownership of public schema to prod_user
ALTER SCHEMA public OWNER TO prod_user;

-- Grant all privileges on schema to prod_user
GRANT ALL ON SCHEMA public TO prod_user;

-- Grant all privileges on all existing tables in public schema
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO prod_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO prod_user;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO prod_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO prod_user;

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO prod_user;

-- Make prod_user able to create objects
ALTER SCHEMA public OWNER TO prod_user;

SELECT 'sales_dashboard_prod permissions fixed successfully!' AS status;
EOF

if [ $? -eq 0 ]; then
    echo "✓ sales_dashboard_prod permissions fixed!"
else
    echo "✗ Failed to fix sales_dashboard_prod permissions"
fi

# Database 2: sales_dashboard_db with sales_user
echo ""
echo "2. Fixing sales_dashboard_db database..."
psql -h 172.31.82.254 -U postgres -d sales_dashboard_db << EOF
-- Grant ownership of public schema to sales_user
ALTER SCHEMA public OWNER TO sales_user;

-- Grant all privileges on schema to sales_user
GRANT ALL ON SCHEMA public TO sales_user;

-- Grant all privileges on all existing tables in public schema
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO sales_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO sales_user;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO sales_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO sales_user;

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO sales_user;

-- Make sales_user able to create objects
ALTER SCHEMA public OWNER TO sales_user;

SELECT 'sales_dashboard_db permissions fixed successfully!' AS status;
EOF

if [ $? -eq 0 ]; then
    echo "✓ sales_dashboard_db permissions fixed!"
else
    echo "✗ Failed to fix sales_dashboard_db permissions"
fi

echo ""
echo "=========================================="
echo "Done! You can now run Django migrations."
echo "=========================================="

