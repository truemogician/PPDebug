import express = require('express');
import clone = require('lodash.clonedeep');
import cookieParser = require('cookie-parser');
import bodyParser = require('body-parser');
import multer = require('multer');
import fileSystem=require('fs');
import nodemailer = require('nodemailer');
import Database from "./database"
import { User } from './entity/User';
import SMTPTransport = require('nodemailer/lib/smtp-transport');
import { Problem } from './entity/Problem';

function hasKeys(dst: object, ...keys: string[]): boolean {
    const existedKeys = Object.keys(dst);
    for (const key of keys) {
        if (!existedKeys.includes(key))
            return false;
    }
    return true;
}
type FullConstraint = [string, Function, boolean?];
type PartialConstraint = [string, boolean?];
function hasKeysWithTypes(dst: object, ...keysAndTypes: FullConstraint[]): boolean;
function hasKeysWithTypes(dst: object, type: Function, ...keys: (PartialConstraint | string)[]): boolean;
function hasKeysWithTypes(dst: object, ...params: any[]): boolean {
    const existedKeys = Object.keys(dst);
    if (params[0] instanceof Function) {
        const type = params[0] as Function;
        for (let i = 1; i < params.length; ++i) {
            if (typeof params[i] == "string") {
                if (!existedKeys.includes(params[i]) || dst[params[i]].constructor != type)
                    return false;
            }
            else {
                const key = params[i] as PartialConstraint;
                if (existedKeys.includes(key[0])) {
                    if (dst[key[0]].constructor != type)
                        return false;
                }
                else if (!params[1])
                    return false;
            }
        }
        return true;
    }
    else {
        for (const keyAndType of params) {
            if (existedKeys.includes(keyAndType[0])) {
                if (dst[keyAndType[0]].constructor != keyAndType[1])
                    return false;
            }
            else if (!params[2])
                return false;
        }
        return true;
    }
}
type Constraint = [string, Function, (boolean | RegExp)?, RegExp?];
function satisfyConstraints(obj: object, ...constraints: Constraint[]) {
    const keys = Object.keys(obj);
    for (const constraint of constraints) {
        if (keys.includes(constraint[0])) {
            const value = obj[constraint[0]];
            if (value.constructor != constraint[1])
                return false;
            else if (constraint[2]) {
                if (constraint[2] instanceof RegExp &&
                    !constraint[2].test(typeof value == "string" ? value : value.toString()))
                    return false;
                else if (constraint[3] &&
                    !constraint[3].test(typeof value == "string" ? value : value.toString()))
                    return false;
            }
        }
        else if (constraint[2] !== true)
            return false;
    }
    return true;
}
function leftJoin(dst: object, target: object, typeSafe = true): void {
    const dstKeys = Object.keys(dst);
    const srcKeys = Object.keys(target);
    for (const key of dstKeys) {
        if (srcKeys.includes(key) && (!typeSafe || dst[key].constructor == target[key].constructor))
            dst[key] = clone(target[key]);
    }
}
function rightJoin(dst: object, target: object, typeSafe = true): void {
    const dstKeys = Object.keys(dst);
    const srcKeys = Object.keys(target);
    for (const key of srcKeys) {
        if (!dstKeys.includes(key) || !typeSafe || dst[key].constructor == target[key].constructor)
            dst[key] = clone(target[key]);
    }
}
let int = Number.parseInt;
let mailConfig: SMTPTransport.Options = {
    host: "smtp.exmail.qq.com",
    port: 465,
    secure: true,
    auth: {
        user: "ppdebug@truemogician.com",
        pass: "EUPHFqvJM9MhSZeT"
    }
}
let sourceUpload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, "upload/source"),
        filename: (_req, file, cb) => cb(null, file.fieldname + '-' + Date.now())
    }),
    limits: {
        fileSize: 524288,
        files: 1,
    }
})
let avatorUpload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, "upload/avator"),
        filename: (_req, file, cb) => cb(null, file.fieldname + '-' + Date.now())
    }),
    limits: {
        fileSize: 2097152,
        files: 1,
    },
})
Database.create().then(database => {
    const app: express.Application = express();
    const guestAvailabelUrl: string[] = [
        "/user/hasUser",
        "/user/login",
        "/user/sendEmail",
        "/user/register",
        
        "/source/upload",
    ];

    app.enable("trust proxy");

    app.use("/api", cookieParser(), bodyParser.json(), async (request, response, next) => {
        console.log({
            time: new Date(),
            ip: request.connection.remoteAddress,
            path: request.path,
            params: request.query,
            payload: request.body,
            cookies: request.cookies,
        });
        response.header("Access-Control-Allow-Origin","*");
        if (!request.cookies?.sessionId) {
            const session = await database.sessions.add();
            response.cookie("sessionId", session.id);
            response.locals.session = session;
            next();
        }
        else {
            const sessionId = request.cookies.sessionId;
            if (!await database.sessions.has(sessionId)) {
                response.cookie("sessionId", (await database.sessions.add()).id);
                response.status(401).send("sessionId doesn't exist");
            }
            else {
                database.sessions.get(sessionId).then(async session => {
                    if (session.expired()) {
                        database.sessions.delete(sessionId);
                        const newSession = await database.sessions.add();
                        response.cookie("sessionId", newSession.id);
                        if (session.user)
                            response.status(401).send("Session expired");
                        else {
                            response.locals.session = newSession;
                            next();
                        }
                    }
                    else {
                        session.lastAccessDate = new Date();
                        database.sessions.update(session);
                        response.locals.session = session;
                        next();
                    }
                })
            }
        }
    }, async (request, response, next) => {
        if (guestAvailabelUrl.indexOf(request.path) == -1 && !response.locals.session?.user)
            response.status(401).send("Login required");
        else
            next();
    });

    app.get("/api/user/hasUser", (request, response) => {
        const query = request.query;
        if (/^\S+@[a-zA-Z0-9]+\.[a-zA-Z]+$/.test(query.email as string)) {
            database.getTable(User).findOne({
                where: {
                    email: query.email as string
                }
            }).then(user => {
                response.json({
                    exist: user != null && user != undefined
                })
            })
        }
        else {
            response.status(400).send(
                query.email ?
                    "'email' syntax error" :
                    "Parameter 'email' required"
            );
        }
    });

    app.get("/api/user/login", (request, response) => {
        const query = request.query;
        if (!hasKeys(query, "email", "password"))
            response.status(400).send("Parameter(s) missing");
        else {
            database.getTable(User).findOne({
                where: {
                    email: query.email as string
                }
            }).then(async user => {
                if (!user)
                    response.status(403).send("Email not registered");
                else {
                    database.sessions.delete(response.locals.session.id);
                    const session = await database.sessions.add(user);
                    response.cookie("sessionId", session.id);
                    response.status(200).send("Logged in successfully")
                }
            })
        }
    });

    app.get("/api/user/getAvator", (request, response) => {
        const params = request.query;
        const userId = params.userId ?? response.locals.session.user.id;
        database.getTable(User).findByIds([userId]).then(users => {
            if (users && users[0]) {
                response.json({
                    avator: users[0].avator
                });
            }
            else
                response.status(400).send("User not found");
        })
    })

    app.post("/api/user/sendEmail", (request, response) => {
        const query = request.query;
        let metadata = response.locals.session.metadata;
        metadata = metadata ? JSON.parse(metadata) : {};
        if (metadata.mailTime && Date.now() < metadata.mailTime + 60000)
            response.status(429).json({
                timeLeft: 60000 + metadata.mailTime - Date.now(),
            });
        else if (/^\S+@[a-zA-Z0-9]+\.[a-zA-Z]+$/.test(query.email as string)) {
            const transporter = nodemailer.createTransport(mailConfig);
            const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            let verificationCode: string;
            do {
                verificationCode = "";
                for (let i = 0; i < 4; ++i)
                    verificationCode += charset.charAt(Math.floor(Math.random() * charset.length));
            } while (verificationCode.length != 4);
            const mailOptions = {
                from: mailConfig.auth.user,
                to: query.email as string,
                subject: "PPDEBUG 验证邮件",
                text: `您的验证码是 : ${verificationCode}，请于10分钟内完成注册`,
            };
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log(error);
                    response.status(500).send("Email sending failed for unknown reason")
                }
                else {
                    metadata.mailTime = Date.now();
                    metadata.verificationCode = verificationCode;
                    response.locals.session.metadata = JSON.stringify(metadata);
                    database.sessions.update(response.locals.session);
                    console.log("Email sent: " + info.response);
                    response.sendStatus(200);
                }
            });
        }
        else
            response.status(400).send("Email syntax error");
    });

    app.post("/api/user/register", (request, response) => {
        const payload = request.body;
        if (!satisfyConstraints(payload,
            ["username", String, /^[a-z0-9_]{1,32}$/i],
            ["password", String, /^.{1,32}$/],
            ["email", String, /^\S+@[a-zA-Z0-9]+\.[a-zA-Z]+$/],
            ["verificationCode", String, /^[a-z0-9]{4}$/i],
            ["phone", Number, true, /^[0-9]{11}$/],
            ["qq", String, true, /^[0-9]{6,12}$/]))
            response.status(400).send("Syntax error");
        else {
            let metadata = response.locals.session.metadata ? JSON.parse(response.locals.session.metadata) : {};
            if (metadata.mailTime && Date.now() > metadata.mailTime + 600000) {
                delete metadata.verificationCode;
                delete metadata.mailTime;
                response.locals.session.metadata = JSON.stringify(metadata);
                database.sessions.update(response.locals.session);
                response.status(403).send("Verification code expired");
            }
            else if (!metadata.verificationCode)
                response.status(400).send("Verification email not sent")
            else if (metadata.verificationCode != payload.verificationCode)
                response.status(403).send("Wrong verification code");
            else {
                let newUser = new User();
                leftJoin(newUser, payload);
                database.getTable(User).save(newUser).then(user => {
                    response.status(201).json({
                        id: user.id
                    });
                })
            }
        }
    });

    app.post("/api/problem/create", (request, response) => {
        const payload = request.body;
        if (!satisfyConstraints(payload,
            ["title", String, /^.{16,256}$/],
            ["description", String],
            ["tags", Array, true]))
            response.status(400).send("Parameter syntax error");
        else {
            let newProblem = new Problem();
            leftJoin(newProblem, payload);
            newProblem.author = response.locals.session.user as User;
            database.getTable(Problem).save(newProblem).then(problem => {
                if (problem)
                    response.json({
                        id: problem.id
                    });
                else
                    response.sendStatus(500);
            })
        }
    });

    app.post("/api/source/upload", (request, response) => {
        sourceUpload.single("source")(request,response,error=>{
            if (error)
                response.status(500).send("Uploading failed for unknown reason");
            else{
                const params=request.query;
                const payload=request.body;
                if (!satisfyConstraints(payload,
                    ["language",String],
                    ["languageStandard",String,true],
                    ["compiler",String]))
                    response.status(400).send("Payload syntax error");
                else{
                    let stream=fileSystem.createReadStream(request.file.path);
                    console.log(stream);
                }
            }
        })
    })

    app.put("/api/user/modify", (request, response) => {
        const payload = request.body;
        if (!satisfyConstraints(payload,
            ["username", String, true, /^[a-z0-9_]{1,32}$/i],
            ["password", String, true, /^.{1,32}$/],
            ["phone", Number, true, /^[0-9]{11}$/],
            ["qq", String, true, /^[0-9]{6,12}$/],
            ["gender", String, true, /^Male|Female|Other|Secret$/]))
            response.status(400).send("Parameter syntax error");
        else {
            rightJoin(response.locals.session.user, payload);
            database.getTable(User).save(response.locals.session.user as User).then(user => {
                response.sendStatus(user ? 200 : 500);
            });
        }
    })

    app.delete("/api/user/logout", (request, response) => {
        database.sessions.delete(response.locals.session.id).then(success => {
            response.sendStatus(success ? 200 : 401);
        });
    });

    app.listen(19920, () => {
        console.log("App listening on 19920");
    });
})