import {v4 as uuidv4} from "uuid";
import crypto from "crypto";
import bcrypt from "bcrypt";
import {createTaskDataBaseForUser} from "./initializeDatabase.js";

/**
 * Sign Up a user. (generate user id, user token, and perform other necessary checks)
 * @param req Client Request
 * @param res Client Response
 * @param dbConnector dataBase where data is being accessed / modified
 * @response JSON file with: request body, server response message (success, or error message)
 */
export async function signUp(req, res, dbConnector) {
    try {
        // Destructure data from request
        const firstName = req.body.firstName;
        const lastName = req.body.lastName;
        const username = req.body.username;
        const password = req.body.password;

        // Check if any field is blank, throw error if any field is blank
        if (!firstName || !lastName || !username || !password) {
            throw new Error("data incomplete");
        }

        // Check if username already exists, throw error if already exists
        let similarUserName = await dbConnector.execute(`SELECT username FROM ${process.env.MYSQL_USER_TABLE} WHERE username = ?;`, [username]);
        if (similarUserName[0].length > 0) {
            throw new Error("username taken");
        }

        // Store user data, create userID, hashPassword
        const userID = uuidv4();
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate token
        const token = await new Promise((resolve, reject) => {
            crypto.randomBytes(48, (err, buffer) => {
                if (err) reject(err);
                resolve(buffer.toString('hex'));
            });
        });

        // Return success to user
        res.json({res: "success"});

        // Insert data into DataBase
        await dbConnector.execute(`INSERT INTO ${process.env.MYSQL_USER_TABLE}(userID, username, firstName, lastName, hashedPassword, token)
                            VALUES (?, ?, ?, ?, ?, ?);`, [userID, username, firstName, lastName, hashedPassword, token]);

        await createTaskDataBaseForUser(dbConnector, token);

        console.log("A new user signed up!", req.body);
    }

        // Error catching, and send error data to client
    catch (error) {
        console.error(`A user tried to signup and caused and caused an error: ${error}\nData Received: ${JSON.stringify(req.body)}\n`);
        res.json({res: `${error}`});
    }
}

/**
 * Login a user. (search user token, and perform necessary checks for login data)
 * @param req Client Request
 * @param res Client Response
 * @param dbConnector dataBase where data is being accessed / modified
 * @response JSON file with: request body, additional userData if login successful, userToken, server response message (success, or error message)
 */
export async function login(req, res, dbConnector) {
    try {
        // Destructure data from request
        const username = req.body.username;
        const password = req.body.password;

        // Check if any field is blank, throw error if any field is blank
        if (!username || !password) {
            throw new Error("data incomplete");
        }

        // Search if password for user exists (if password doesn't exist, user doesn't exist). If password exists, store temporarily.
        let actualHashedPassword = await dbConnector.execute(`SELECT hashedPassword FROM ${process.env.MYSQL_USER_TABLE} WHERE username = ?;`, [username]);
        if (actualHashedPassword[0].length > 0) {
            actualHashedPassword = actualHashedPassword[0][0].hashedPassword; // Convert var from list to actual element
        } else {
            throw new Error("incorrect data");
        }

        const doPasswordsMatch = await bcrypt.compare(password, actualHashedPassword);

        // Check if stored actual password is equal to given password
        if (!doPasswordsMatch) {
            throw new Error("incorrect data");
        }

        // If the user reached here, they are the correct user with correct credentials.

        // Get user data from server
        let firstName = await dbConnector.execute(`SELECT firstName FROM ${process.env.MYSQL_USER_TABLE} WHERE username = ?;`, [username]);
        let lastName = await dbConnector.execute(`SELECT lastName FROM ${process.env.MYSQL_USER_TABLE} WHERE username = ?;`, [username]);
        lastName = lastName[0][0].lastName;
        firstName = firstName[0][0].firstName;
        let token = await dbConnector.execute(`SELECT token FROM ${process.env.MYSQL_USER_TABLE} WHERE username = ?;`, [username]);
        token = token[0][0].token;

        // Login successful, give user login data
        console.log("A user logged in!", req.body);
        res.json({username, firstName, lastName, res: "success", token: token});
    }
        // Error catching, and send error data to client
    catch (error) {
        console.error(`A user tried to login and caused an error: ${error}`);
        res.json({...req.body, res: `${error}`});
    }
}

/**
 * Check if a token is valid. (receive a user token, and perform if it exists)
 * @param req Client Request (only has token)
 * @param res Client Response
 * @param dbConnector dataBase where data is being accessed / modified
 * @response JSON file with: server response message (success, or error message)
 */
export async function authenticateToken(req, res, dbConnector){
    const givenToken = req.body.token;
    let tokenResult = await dbConnector.execute(`SELECT token FROM ${process.env.MYSQL_USER_TABLE} WHERE token = ?;`, [givenToken]);
    let response = tokenResult.length > 0 && tokenResult[0].length > 0 && givenToken === tokenResult[0][0].token ? 'token valid' : 'invalid token';
    res.json({res: `${response}` });
}
