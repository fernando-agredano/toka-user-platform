-- One database per service (bounded context). Runs once, on first container start.
CREATE DATABASE auth_db;
CREATE DATABASE user_db;
CREATE DATABASE role_db;
