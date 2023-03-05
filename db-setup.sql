DROP TABLE IF EXISTS characters;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS requests;
DROP TABLE IF EXISTS codes;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR NOT NULL UNIQUE,
    email VARCHAR NOT NULL UNIQUE,
    password VARCHAR NOT NULL,
    picture VARCHAR,
    bio VARCHAR,
    online BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE codes (
    id SERIAL PRIMARY KEY,
    email VARCHAR NOT NULL REFERENCES users (email),
    code VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE requests (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL REFERENCES users (id),
    receiver_id INTEGER NOT NULL REFERENCES users (id),
    status BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL REFERENCES users (id),
    receiver_id INTEGER NOT NULL,
    text VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE characters (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users (id),
    first_name VARCHAR NOT NULL,
    last_name VARCHAR NOT NULL,
    image VARCHAR,
    tribe VARCHAR NOT NULL,
    role VARCHAR NOT NULL,
    strength INTEGER NOT NULL,
    dexterity INTEGER NOT NULL,
    intellect INTEGER NOT NULL,
    location VARCHAR NOT NULL,
    health DECIMAL(3,2) DEFAULT 1.00,
    thirst DECIMAL(3,2) DEFAULT 0.50,
    hunger DECIMAL(3,2) DEFAULT 0.50,
    warmth DECIMAL(3,2) DEFAULT 0.70,
    stamina DECIMAL(3,2) DEFAULT 0.80,
    morale DECIMAL(3,2) DEFAULT 0.70,
    knife VARCHAR DEFAULT NULL,
    primary_weapon VARCHAR DEFAULT NULL,
    side_weapon VARCHAR DEFAULT NULL,
    clothing VARCHAR DEFAULT NULL,
    alive BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


