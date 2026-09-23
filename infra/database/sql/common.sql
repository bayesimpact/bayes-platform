-- CREATEROLE: the analytics migration creates the role analytics_reader.
CREATE USER connect_admin WITH PASSWORD 'passpass' CREATEROLE;
CREATE DATABASE "connect" OWNER connect_admin;
CREATE DATABASE connect_test OWNER connect_admin;
\connect connect
CREATE EXTENSION IF NOT EXISTS vector;
\connect connect_test
CREATE EXTENSION IF NOT EXISTS vector;
