-- Runs once, only when the postgres data volume is first initialized.
-- POSTGRES_DB already creates the dev database; the test database needs
-- creating separately since Postgres only supports one DB via env vars.
CREATE DATABASE booking_test;
