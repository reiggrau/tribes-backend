// import express, { static as staticServe } from "express";
import express from "express";
const app = express();
import compression from "compression";
import proxy from "express-http-proxy";

// SETUP
const PORT = process.env.PORT || 3000;

// cookies
import cookieSession from "cookie-session";

const cookieSessionMiddleware = cookieSession({
    secret: process.env.SESSION_SECRET,
    maxAge: 1000 * 60 * 60 * 24 * 1, // miliseconds * seconds * minutes * hours * days // currently: 1 day
    sameSite: true,
});

// .env
import * as dotenv from "dotenv"; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config();

// Database
import db from "./db.js";

// Encryption
import bcrypt from "bcryptjs";

// Code
import cryptoRandomString from "crypto-random-string";

// Image upload
import uploader from "./uploader.js";
import fs from "fs";

/// AWS ///
import aws from "aws-sdk";
// import secrets from "./secrets.js";

const s3 = new aws.S3({
    accessKeyId: process.env.AWS_KEY,
    secretAccessKey: process.env.AWS_SECRET,
});

// socket.io
import http from "http";
const server = http.createServer(app);
import { Server } from "socket.io";

const io = new Server(server);

// const server = require("http").Server(app);

// const io = require("socket.io")(server, {
//     allowRequest: (req, callback) => {
//         callback(null, req.headers.referer.startsWith("http://localhost:3000"));
//     },
// });

// allow socket.io to use cookie session
io.use((socket, next) => {
    cookieSessionMiddleware(socket.request, socket.request.res, next);
});

// store user.id-socket.id pairs
const socketId = {};

// io
io.on("connection", async (socket) => {
    const userId = socket.request.session.id;
    socketId[userId] = socket.id;

    console.log("connection. id:", userId, "socketId:", socket.id);
    // MIDDLEWARE
    app.use(express.json()); // This is needed to read the req.body

    app.use(cookieSessionMiddleware);

    app.use(compression());

    // app.use(staticServe("public"));

    console.log("socketId:", socketId);

    db.setUserOnlineStatus(userId, true); // Update online status

    db.getFriendsId(userId).then((data) => {
        console.log("getFriendsId data:", data);
        for (const element of data) {
            const friendId = element.id;
            if (Object.prototype.hasOwnProperty.call(socketId, friendId)) {
                io.to(socketId[friendId]).emit("friendOnline", userId);
            }
        }
    });

    // db.getFriendships;

    if (!userId) {
        return socket.disconnect(true);
    }

    socket.on("disconnect", function () {
        console.log("disconnect. id:", userId);

        delete socketId[userId];
        console.log("socketId:", socketId);

        db.setUserOnlineStatus(userId, false);

        db.getFriendsId(userId).then((data) => {
            for (const element of data) {
                const friendId = element.id;
                if (Object.prototype.hasOwnProperty.call(socketId, friendId)) {
                    io.to(socketId[friendId]).emit("friendOffline", userId);
                }
            }
        });
    });

    // 2. listen for a new message event
    socket.on("sendMessage", async (message) => {
        console.log("NEW MESSAGE", message);
        const { chatId, text } = message;

        try {
            const messageId = await db.addMessage(userId, chatId, text);
            const messageData = await db.getMessage(messageId[0].id);

            messageData[0].created_at = messageData[0].created_at
                .toString()
                .split(" GMT")[0];

            if (messageData[0].receiver_id === 0) {
                io.emit("newMessage", messageData[0]); // if it's a message to the global chat, send to everyone
            } else {
                io.to(socketId[userId]).emit("newMessage", messageData[0]);
                io.to(socketId[chatId]).emit("newMessage", messageData[0]);
            }
        } catch (error) {
            console.error(error);
        }
    });
});

// MIDDLEWARE
app.use(express.json()); // This is needed to read the req.body

app.use(cookieSessionMiddleware);

app.use(compression());

// app.use(staticServe("public"));

// ROUTES
// Get user id from cookie
app.get("/user/id.json", (req, res) => {
    console.log("req.session :", req.session);
    const id = req.session.id;

    if (id) {
        db.getUserById(id)
            .then((data) => {
                data[0].created_at = data[0].created_at
                    .toString()
                    .split(" GMT")[0];

                res.json(data[0]);
            })
            .catch((error) => {
                console.log(error);
            });
    } else {
        res.json({
            id: undefined,
        });
    }
});

// REGISTRATION
app.post("/registration", (req, res) => {
    // console.log("req :", req);
    console.log("REGISTRATION. req.body :", req.body);

    const { username, email, password } = req.body;

    // Check if email already exists
    db.checkUsernameAndEmail(username, email)
        .then((data) => {
            if (data.length) {
                if (data[0].username == username) {
                    res.json({
                        success: false,
                        message: "User name already in use!",
                    });
                } else if (data[0].email == email) {
                    res.json({
                        success: false,
                        message: "Email already in use!",
                    });
                }
            } else {
                // Generate salt for password
                return bcrypt.genSalt();
            }
        })
        .then((salt) => {
            // Hash the password with the salt
            return bcrypt.hash(password, salt); // It's a promise so it must be returned
        })
        .then((hash) => {
            // Create user
            return db.createUser(username, email, hash);
        })
        .then((data) => {
            // Store user data as cookie, and send data to client
            req.session.id = data[0].id;

            data[0].created_at = data[0].created_at.toString().split(" GMT")[0]; // We can change the format of the date here

            res.json({
                success: true,
                user: data[0],
            });
        })
        .catch((error) => {
            res.json({
                success: false,
                message: "Error during registration!",
            });
            console.log(error);
        });
});

// Log in
app.post("/login", (req, res) => {
    // console.log("LOG IN. req.body:", req.body);

    const { email, password } = req.body;

    // Get user id & password from database
    db.getUserByEmail(email)
        .then((data) => {
            if (data.length) {
                // Compare passwords
                bcrypt.compare(password, data[0].password).then((match) => {
                    if (match) {
                        // Store user id to cookie
                        req.session.id = data[0].id;

                        delete data[0].password;

                        data[0].created_at = data[0].created_at
                            .toString()
                            .split(" GMT")[0];

                        res.json({
                            success: true,
                            user: data[0],
                        });
                    } else {
                        res.json({
                            success: false,
                            message: "Wrong password!",
                        });
                    }
                });
            } else {
                res.json({
                    success: false,
                    message: "No user with that email!",
                });
            }
        })
        .catch((error) => {
            res.json({
                success: false,
                message: "Error logging in!",
            });
            console.log(error);
        });
});

// get user data (own or other)
app.get("/user/:id.json", (req, res) => {
    // console.log("GET USER. id :", req.params.id);
    let userId;

    if (req.params.id == 0) {
        userId = req.session.id; // if 'id' is 0 the request comes from own Home page and wants own user data
    } else {
        userId = req.params.id; // if 'id' is another number, it comes from OtherUserPage and wants somoene else's data
    }

    Promise.all([
        db.getUserById(userId),
        db.getFriendships(userId) /*, db.getAllPostsByUserId(userId)*/,
    ])
        .then((data) => {
            // console.log("promiseall data :", data); // data[0] is user data. data[1] is friends data
            const pendingRequests = data[1].some((obj) => obj.status == false);

            // console.log("pendingRequests :", pendingRequests);

            if (pendingRequests && req.params.id == 0) {
                console.log("newRequests!");
                io.to(socketId[userId]).emit("newRequestUpdate", true);
            }

            delete data[0][0].password; // caution! Password must be deleted from data before sending it to client!

            data[0][0].created_at = data[0][0].created_at
                .toString()
                .split(" GMT")[0]; // We can change the format of the date here

            // data[2].forEach((element) => {
            //     element.created_at = element.created_at.toString().split(" GMT")[0];
            // });

            res.json(data);
        })
        .catch((error) => {
            console.log(error);
        });
});

// Log out
app.get("/logout", (req, res) => {
    req.session = null;
    res.redirect("/");
});

// Reset password
app.post("/getcode", (req, res) => {
    // console.log("GET CODE. req.body:", req.body);

    const { email } = req.body;

    db.getUserByEmail(email)
        .then((data) => {
            if (data.length) {
                // Generate code
                const secretCode = cryptoRandomString({
                    length: 6,
                });
                console.log("secretCode :", secretCode);

                // Store the email-code pair in the database
                return db.storeCode(email, secretCode);
            } else {
                res.json({
                    success: false,
                    message: "No matching email!",
                });
            }
        })
        .then((data) => {
            // (Code to send the code to email here)
            data;

            return undefined;
        })
        .then(() => {
            res.json({
                success: true,
                message: "Code sent!",
            });
        })
        .catch((error) => {
            res.json({
                success: false,
                message: "Error getting the code!",
            });
            console.log(error);
        });
});

app.post("/resetpassword", (req, res) => {
    // console.log("RESET PASSWORD req.body :", req.body);

    db.checkCode(req.body.email)
        .then((data) => {
            // console.log("data :", data);
            if (data.length > 0) {
                if (req.body.code === data[0].code) {
                    // Generate salt
                    return bcrypt.genSalt();
                } else {
                    // End the process
                    res.json({
                        success: false,
                        message: "Wrong code! Try again.",
                    });
                }
            } else {
                res.json({
                    success: false,
                    message: "Code expired! Try again.",
                });
            }
        })
        .then((salt) => {
            // Hash the new password with the salt
            return bcrypt.hash(req.body.password, salt);
        })
        .then((hash) => {
            // Reset password
            return db.resetPassword(req.body.email, hash);
        })
        .then(() => {
            res.json({
                success: true,
                message: "Password has been reset!",
            });
        })
        .catch((error) => {
            res.json({
                success: false,
                message: "Error updating password!",
            });
            console.log(error);
        });
});

// Edit profile
app.post("/profile", uploader.single("file"), (req, res) => {
    // console.log("EDIT PROFILE. req.body :", req.body);
    // console.log("req.file :", req.file);

    const { id } = req.session;
    const { username, email, bio } = req.body;

    // Check if email already exists
    db.checkUsernameAndEmail(username, email)
        .then((data) => {
            if (data.length) {
                for (let element of data) {
                    if (element.id != id) {
                        if (element.username == username) {
                            res.json({
                                success: false,
                                message: "User name already in use!",
                            });
                        } else if (element.email == email) {
                            res.json({
                                success: false,
                                message: "Email already in use!",
                            });
                        }
                    }
                }
            }
            return db.getUserById(id);
        })
        .then((data) => {
            const oldEmail = data[0].email;

            if (oldEmail != email) {
                return db.deleteCodes(oldEmail); // If email has changed, delete old codes before changing email
            }
        })
        .then(() => {
            if (req.file) {
                const { filename, mimetype, size, path } = req.file;

                const promise = s3
                    .putObject({
                        Bucket: "spicedling",
                        ACL: "public-read",
                        Key: filename,
                        Body: fs.createReadStream(path),
                        ContentType: mimetype,
                        ContentLength: size,
                    })
                    .promise();

                return promise;
            }
            return undefined;
        })
        .then(() => {
            if (req.file) {
                // get image url
                const picture = `https://s3.amazonaws.com/spicedling/${req.file.filename}`;
                // console.log("picture url :", picture);

                // delete image from local store
                fs.unlink(req.file.path, function (err) {
                    if (err) {
                        console.error("Error in fs.unlink:", err);
                    } else {
                        // console.log("File removed!", req.file.path);
                    }
                });

                // put data in database
                return db.updateProfileAndPic(
                    id,
                    username,
                    email,
                    bio,
                    picture
                );
            } else {
                return db.updateProfile(id, username, email, bio);
            }
        })
        .then((data) => {
            res.json({
                success: true,
                user: data[0],
            });
        })
        .catch((error) => {
            res.json({
                success: false,
                message: "Error updating profile!",
            });
            console.log(error);
        });
});

// DELETE ACCOUNT
app.post("/deletegetcode", (req, res) => {
    // console.log("DELETE GET CODE. req.body:", req.body);

    const { email, password } = req.body;

    // Get user password from database
    db.getIdPasswordByEmail(email)
        .then((data) => {
            // Compare passwords
            bcrypt.compare(password, data[0].password).then((compare) => {
                if (compare) {
                    // Create code
                    const secretCode = cryptoRandomString({
                        length: 6,
                    });
                    console.log("secretCode :", secretCode);

                    // Store the email-code pair in the database
                    return db.storeCode(email, secretCode);
                } else {
                    res.json({
                        success: false,
                        message: "Wrong password!",
                    });
                }
            });
        })
        .then((data) => {
            // (Code to send the code to email here)
            data;

            return undefined;
        })
        .then(() => {
            res.json({
                success: true,
            });
        })
        .catch((error) => {
            res.json({
                success: false,
                message: "Error logging in!",
            });
            console.log(error);
        });
});

app.post("/deletecheckcode", (req, res) => {
    console.log("DELETE CHECK CODE req.body:", req.body);
    const id = req.session.id;
    const { email, code } = req.body;

    db.checkCode(email)
        .then((data) => {
            if (data.length > 0) {
                if (code === data[0].code) {
                    // Delete account, codes, friends and messages
                    // promise all
                    Promise.all([
                        db.deleteMessages(id),
                        db.deleteRequests(id),
                        db.deleteCodes(email),
                    ])
                        .then(() => {
                            return db.deleteAccount(id, email);
                        })
                        .then(() => {
                            res.json({
                                success: true,
                                message: "Account deleted successfully!",
                            });
                        })
                        .catch((error) => {
                            res.json({
                                success: false,
                                message:
                                    "Server error! Please contact tech support.",
                            });
                            console.log(error);
                        });
                } else {
                    res.json({
                        success: false,
                        message: "Wrong code! Try again.",
                    });
                }
            } else {
                res.json({
                    success: false,
                    message: "Code expired! Try again.",
                });
            }
        })
        .catch((error) => {
            res.json({
                success: false,
                message: "Server error! Please contact tech support.",
            });
            console.log(error);
        });
});

// SEARCH USER
app.post("/searchuser", (req, res) => {
    // console.log("SEARCH USER. req.body :", req.body);

    const searchString = req.body.searchString;

    db.searchUser(searchString + "%")
        .then((data) => {
            res.json(data);
        })
        .catch((error) => {
            console.log(error);
        });
});

// FRIEND BUTTON
// get user friend status
app.get("/status/:id.json", (req, res) => {
    // console.log("GET USER STATUS. id1, id2 :", req.session.id, req.params.id);

    const id1 = req.session.id;
    const id2 = req.params.id;

    if (id1 == id2) {
        res.json({
            status: "self",
        });
    } else {
        db.getFriendshipStatus(id1, id2)
            .then((data) => {
                // console.log("data :", data);

                if (data[0]) {
                    res.json(data[0]);
                } else {
                    res.json({ status: null });
                }
            })
            .catch((error) => {
                console.log(error);
            });
    }
});

// make friendship request
app.get("/befriend/:id.json", (req, res) => {
    // console.log("BEFRIEND. id1, id2 :", req.session.id, req.params.id);

    const id1 = req.session.id;
    const id2 = req.params.id;

    if (id1 == id2) {
        res.redirect("/");
    }

    db.askFriendship(id1, id2)
        .then((data) => {
            // console.log("askFriendship data :", data);

            if (Object.prototype.hasOwnProperty.call(socketId, id2)) {
                io.to(socketId[id2]).emit("newRequestUpdate", true);
            }

            res.json(data[0]);
        })
        .catch((error) => {
            console.log(error);
        });
});

// cancel friendship request
app.get("/cancel/:id.json", (req, res) => {
    // console.log("CANCEL. id1, id2 :", req.session.id, req.params.id);

    const id1 = req.session.id;
    const id2 = req.params.id;

    if (id1 == id2) {
        res.redirect("/");
    }

    db.cancelFriendshipRequest(id1, id2)
        .then((data) => {
            // console.log("data :", data);

            res.json({ success: true });
        })
        .catch((error) => {
            console.log(error);
        });
});

// accept friendship request
app.get("/accept/:id.json", (req, res) => {
    // console.log("ACCEPT. id1, id2 :", req.session.id, req.params.id);

    const id1 = req.session.id;
    const id2 = req.params.id;

    if (id1 == id2) {
        res.redirect("/");
    }

    db.acceptFriendshipRequest(id1, id2)
        .then((data) => {
            // console.log("data :", data);

            res.json({ success: true });
        })
        .catch((error) => {
            console.log(error);
        });
});

// CHAT
// get messages
app.get("/messages/:id.json", (req, res) => {
    const user1 = req.session.id;
    const user2 = req.params.id;
    const limit = 10;

    if (user2 == 0) {
        // console.log("GET MESSAGES GLOBAL. id2:", user2);
        db.getMessagesGlobal(limit)
            .then((data) => {
                data.forEach((element) => {
                    element.created_at = element.created_at
                        .toString()
                        .split(" GMT")[0];
                });

                res.json(data);
            })
            .catch((error) => {
                console.log(error);
            });
    } else {
        // console.log("GET MESSAGES. id1:", user1, "id2:", user2);
        db.getMessages(user1, user2, limit)
            .then((data) => {
                data.forEach((element) => {
                    element.created_at = element.created_at
                        .toString()
                        .split(" GMT")[0];
                });

                res.json(data);
            })
            .catch((error) => {
                console.log(error);
            });
    }
});

// CHARACTERS
app.get("/characters.json", (req, res) => {
    const id = req.session.id;
    console.log("GET CHARACTERS. id:", id);

    db.getAllCharacters(id)
        .then((data) => {
            data.forEach((element) => {
                element.created_at = element.created_at
                    .toString()
                    .split(" GMT")[0];
            });

            res.json(data);
        })
        .catch((error) => {
            console.log(error);
        });
});

// new character
app.post("/newcharacter", uploader.single("file"), (req, res) => {
    // console.log("EDIT PROFILE. req.body :", req.body);
    // console.log("req.file :", req.file);

    const { id } = req.session;
    const {
        first_name,
        last_name,
        tribe,
        role,
        strength,
        dexterity,
        intellect,
    } = req.body;
    const location = "tutorial";

    const { filename, mimetype, size, path } = req.file;

    const promise = s3
        .putObject({
            Bucket: "spicedling",
            ACL: "public-read",
            Key: filename,
            Body: fs.createReadStream(path),
            ContentType: mimetype,
            ContentLength: size,
        })
        .promise();

    promise
        .then(() => {
            // get image url
            const image = `https://s3.amazonaws.com/spicedling/${req.file.filename}`;

            // delete image from local store
            fs.unlink(req.file.path, function (err) {
                if (err) {
                    console.error("Error in fs.unlink:", err);
                } else {
                    // console.log("File removed!", req.file.path);
                }
            });

            // put data in database
            return db.createCharacter(
                id,
                first_name,
                last_name,
                image,
                tribe,
                role,
                strength,
                dexterity,
                intellect,
                location
            );
        })
        .then((data) => {
            console.log("createCharacter data[0]:", data[0]);
            res.json({
                success: true,
                character: data[0],
            });
        })
        .catch((error) => {
            res.json({
                success: false,
            });
            console.log(error);
        });
});

// proxy HTTP GET / POST
app.use("/", proxy("localhost:5173"));

// CATCH ALL
app.get("*", function (req, res) {
    // res.sendFile(path.join(__dirname, "..", "client", "index.html"));
});

// INITIALIZATION
server.listen(PORT, function () {
    console.log("I'm listening on port :", PORT);
});
