// SETUP
import * as dotenv from "dotenv";
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

import spicedPg from "spiced-pg";
const db = spicedPg(DATABASE_URL);

// FUNCTIONS

// REGISTRATION
// Check if username or email already exist, and the user id they belong
function checkUsernameAndEmail(username, email) {
    const sql = `
    SELECT id, username, email
    FROM users
    WHERE username = $1 OR email = $2
    ;`;
    return db
        .query(sql, [username, email])
        .then((result) => result.rows)
        .catch((error) =>
            console.log("Error in checkUsernameAndEmail:", error)
        );
}

// Create user
function createUser(username, email, password) {
    const sql = `
        INSERT INTO users (username, email, password)
        VALUES ($1, $2, $3)
        RETURNING id, username, email, bio, picture, created_at
        ;`;
    return db
        .query(sql, [username, email, password])
        .then((result) => result.rows)
        .catch((error) => console.log("Error in createUser:", error));
}

function getUserByEmail(email) {
    const sql = `
    SELECT *
    FROM users
    WHERE email = $1
    ;`;
    return db
        .query(sql, [email])
        .then((result) => result.rows)
        .catch((error) => console.log("Error in getUser:", error));
}

// User info
function getUserById(id) {
    const sql = `
    SELECT id, username, email, bio, picture, created_at
    FROM users
    WHERE id = $1
    ;`;
    return db
        .query(sql, [id])
        .then((result) => result.rows)
        .catch((error) => console.log("Error in getUser:", error));
}

// Password reset
function storeCode(email, code) {
    const sql = `
    INSERT INTO codes (email, code)
    VALUES ($1, $2)
    RETURNING *
    ;`;
    return db
        .query(sql, [email, code])
        .then((result) => result.rows)
        .catch((error) => console.log("Error in storeCode:", error));
}

function checkCode(email) {
    const sql = `
    SELECT code
    FROM codes
    WHERE email = $1 AND CURRENT_TIMESTAMP - created_at < INTERVAL '10 minutes'
    ORDER BY created_at DESC
    ;`;
    return db
        .query(sql, [email])
        .then((result) => result.rows)
        .catch((error) => console.log("Error in checkCode:", error));
}

function resetPassword(email, password) {
    const sql = `
    UPDATE users SET password = $2
    WHERE email = $1
    ;`;
    return db
        .query(sql, [email, password])
        .then((result) => result.rows)
        .catch((error) => console.log("Error in resetPassword:", error));
}

// // Profile
function updateProfile(id, username, email, bio) {
    const sql = `
    UPDATE users SET username = $2, email = $3, bio = $4
    WHERE id = $1
    RETURNING id, username, email, bio, picture, created_at
    ;`;
    return db
        .query(sql, [id, username, email, bio])
        .then((result) => result.rows)
        .catch((error) => console.log("Error in updateProfile:", error));
}

function updateProfileAndPic(id, username, email, bio, picture) {
    const sql = `
    UPDATE users SET username = $2, email = $3, bio = $4, picture = $5
    WHERE id = $1
    RETURNING id, username, email, bio, picture, created_at
    ;`;
    return db
        .query(sql, [id, username, email, bio, picture])
        .then((result) => result.rows)
        .catch((error) => console.log("Error in updateProfileAndPic:", error));
}

// DELETE
function deleteMessages(id) {
    const sql = `
    DELETE FROM messages
    WHERE sender_id = $1 OR receiver_id = $1
    ;`;
    return db
        .query(sql, [id])
        .then((result) => result.rows)
        .catch((error) => console.log("Error in deleteAccount:", error));
}

function deleteRequests(id) {
    const sql = `
    DELETE FROM requests
    WHERE sender_id = $1 OR receiver_id = $1
    ;`;
    return db
        .query(sql, [id])
        .then((result) => result.rows)
        .catch((error) => console.log("Error in deleteAccount:", error));
}

function deleteCodes(email) {
    const sql = `
    DELETE FROM codes
    WHERE email = $1
    ;`;
    return db
        .query(sql, [email])
        .then((result) => result.rows)
        .catch((error) => console.log("Error in deleteCodes:", error));
}

function deleteAccount(id, email) {
    const sql = `
    DELETE FROM users
    WHERE id = $1 AND email = $2
    ;`;
    return db
        .query(sql, [id, email])
        .then((result) => result.rows)
        .catch((error) => console.log("Error in deleteAccount:", error));
}

// SEARCH USER
function searchUser(name) {
    const sql = `
    SELECT id, username, picture
    FROM users
    WHERE username ILIKE $1
    ORDER BY username ASC
    ;`;
    return db
        .query(sql, [name])
        .then((result) => result.rows)
        .catch((error) => console.log("Error in searchUser:", error));
}

// FRIENDSHIP
// finds friendship status between two people
function getFriendshipStatus(user1, user2) {
    const sql = `
    SELECT *
    FROM requests
    WHERE (sender_id = $1 AND receiver_id = $2)
    OR (sender_id = $2 AND receiver_id = $1)
    ORDER BY created_at DESC
    LIMIT 1
    `;
    return db
        .query(sql, [user1, user2])
        .then((result) => result.rows)
        .catch((error) => console.log("Error in getFriendshipStatus:", error));
}

// creates a friendship request to database
function askFriendship(user1, user2) {
    const sql = `
    INSERT INTO requests (sender_id, receiver_id)
    VALUES ($1, $2)
    RETURNING status
    ;`;
    return db
        .query(sql, [user1, user2])
        .then((result) => result.rows)
        .catch((error) => console.log("Error in askFriendship:", error));
}

// cancel friendship request and unfriend
function cancelFriendshipRequest(user1, user2) {
    const sql = `
    UPDATE requests
    SET status = NULL
    WHERE (sender_id = $1 AND receiver_id = $2)
    OR (sender_id = $2 AND receiver_id = $1)
    RETURNING status
    ;`;
    return db
        .query(sql, [user1, user2])
        .then((result) => result.rows)
        .catch((error) =>
            console.log("Error in cancelFriendshipRequest:", error)
        );
}

// accept friendship request
function acceptFriendshipRequest(user1, user2) {
    const sql = `
    UPDATE requests
    SET status = true
    WHERE (sender_id = $2 AND receiver_id = $1 AND status = false)
    RETURNING status
    ;`;
    return db
        .query(sql, [user1, user2])
        .then((result) => result.rows)
        .catch((error) =>
            console.log("Error in acceptFriendshipRequest:", error)
        );
}

// get friendships
function getFriendships(id) {
    const sql = `
    SELECT users.id, username, picture, status, online
    FROM users JOIN requests
    ON (status = false AND receiver_id = $1 AND users.id = requests.sender_id)
    OR (status = true AND receiver_id = $1 AND users.id = requests.sender_id)
    OR (status = true AND sender_id = $1 AND users.id = requests.receiver_id)
    ;`;
    return db
        .query(sql, [id])
        .then((result) => result.rows)
        .catch((error) => console.log("Error in getFriendships:", error));
}

function getFriendsId(id) {
    const sql = `
    SELECT users.id
    FROM users JOIN requests
    ON (status = true AND receiver_id = $1 AND users.id = requests.sender_id)
    OR (status = true AND sender_id = $1 AND users.id = requests.receiver_id)
    ;`;
    return db
        .query(sql, [id])
        .then((result) => result.rows)
        .catch((error) => console.log("Error in getFriendsId:", error));
}

// get messages
function getMessages(user1, user2, limit) {
    const sql = `
    SELECT messages.id, sender_id, receiver_id, username, picture, text, messages.created_at
    FROM messages JOIN users
    ON (users.id = messages.sender_id AND sender_id = $1 AND receiver_id = $2)
    OR (users.id = messages.sender_id AND sender_id = $2 AND receiver_id = $1)
    ORDER BY messages.created_at ASC
    LIMIT $3
    ;`;
    return db
        .query(sql, [user1, user2, limit])
        .then((result) => result.rows)
        .catch((error) => console.log("Error in getMessages:", error));
}

function getMessagesGlobal(limit) {
    const sql = `
    SELECT messages.id, sender_id, receiver_id, username, picture, text, messages.created_at
    FROM messages JOIN users
    ON (users.id = messages.sender_id AND receiver_id = 0)
    ORDER BY messages.created_at ASC
    LIMIT $1
    ;`;
    return db
        .query(sql, [limit])
        .then((result) => result.rows)
        .catch((error) => console.log("Error in getMessages:", error));
}

// add new message
function addMessage(user1, user2, text) {
    const sql = `
        INSERT INTO messages (sender_id, receiver_id, text)
        VALUES ($1, $2, $3)
        RETURNING id
        ;`;
    return db
        .query(sql, [user1, user2, text])
        .then((result) => result.rows)
        .catch((error) => console.log("Error in addMessage:", error));
}

// get sigle message by message id
function getMessage(messageId) {
    const sql = `
        SELECT messages.id, sender_id, receiver_id, username, picture, text, messages.created_at, sender_id, receiver_id
        FROM messages JOIN users
        ON sender_id = users.id
        WHERE messages.id = $1
        ;`;
    return db
        .query(sql, [messageId])
        .then((result) => result.rows)
        .catch((error) => console.log("Error in getMessage:", error));
}

// ONLINE STATUS
function setUserOnlineStatus(id, boolean) {
    const sql = `
    UPDATE users
    SET online = $2
    WHERE id = $1
    ;`;
    return db
        .query(sql, [id, boolean])
        .then((result) => result.rows)
        .catch((error) => console.log("Error in setUserOnlineStatus:", error));
}

// CHARACTER
function getAllCharacters(id) {
    const sql = `
    SELECT *
    FROM characters
    WHERE user_id = $1
    ORDER BY created_at DESC
    `;
    return db
        .query(sql, [id])
        .then((result) => result.rows)
        .catch((error) => console.log("Error in getAllCharacters:", error));
}

function createCharacter(
    user_id,
    first_name,
    last_name,
    image,
    tribe,
    role,
    strength,
    dexterity,
    intellect,
    location
) {
    const sql = `
        INSERT INTO characters (user_id, first_name, last_name, image, tribe, role, strength, dexterity, intellect, location)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
        ;`;
    return db
        .query(sql, [
            user_id,
            first_name,
            last_name,
            image,
            tribe,
            role,
            strength,
            dexterity,
            intellect,
            location,
        ])
        .then((result) => result.rows)
        .catch((error) => console.log("Error in createCharacter:", error));
}

// EXPORTS
export default {
    checkUsernameAndEmail,
    createUser,
    getUserByEmail,
    getUserById,
    storeCode,
    checkCode,
    resetPassword,
    updateProfile,
    updateProfileAndPic,
    deleteMessages,
    deleteRequests,
    deleteCodes,
    deleteAccount,
    searchUser,
    getFriendshipStatus,
    askFriendship,
    cancelFriendshipRequest,
    acceptFriendshipRequest,
    getFriendships,
    getFriendsId,
    getMessages,
    getMessagesGlobal,
    addMessage,
    getMessage,
    setUserOnlineStatus,
    getAllCharacters,
    createCharacter,
};
