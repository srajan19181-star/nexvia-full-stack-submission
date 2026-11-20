SELECT 'CREATE DATABASE nexvia_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'nexvia_test')\gexec
