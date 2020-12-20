import express = require('express');
import cookieParser = require('cookie-parser');
import bodyParser = require('body-parser');
import fileSystem = require('fs');
import nodemailer = require('nodemailer');
import Database from "./database"
import { User } from './entity/User';
import { Problem } from './entity/Problem';
import { hasKeys, leftJoin, rightJoin, satisfyConstraints } from './verification';
import { MailTemplate, sourceUpload } from './configuration';
import Mail = require('nodemailer/lib/mailer');

let int = Number.parseInt;
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

    app.post("/api/user/sendEmail", async (request, response) => {
        const query = request.query;
        let metadata = response.locals.session.metadata;
        metadata = metadata ? JSON.parse(metadata) : {};
        if (metadata.mailTime && Date.now() < metadata.mailTime + 60000)
            response.status(429).json({
                timeLeft: 60000 + metadata.mailTime - Date.now(),
            });
        else if (/^\S+@([a-zA-Z0-9]+\.)+[a-zA-Z]+$/.test(query.email as string)) {
            if (await database.getTable(User).findOne({where: {email: query.email as string}}))
                response.status(403).send("Email address already registered");
            const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            let verificationCode: string;
            do {
                verificationCode = "";
                for (let i = 0; i < 4; ++i)
                    verificationCode += charset.charAt(Math.floor(Math.random() * charset.length));
            } while (verificationCode.length != 4);
            const mail = new MailTemplate(query.email as string, verificationCode)
            const transporter = nodemailer.createTransport(mail.config);
            const mailOptions: Mail.Options = {
                from: mail.config.auth.user,
                to: query.email as string,
                subject: "PPDEBUG 验证邮件",
                html: mail.content,
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
            const metadata = response.locals.session.metadata ? JSON.parse(response.locals.session.metadata) : {};
            if (metadata.mailTime && Date.now() > metadata.mailTime + 600000) {
                delete metadata.verificationCode;
                delete metadata.mailTime;
                response.locals.session.metadata = JSON.stringify(metadata);
                database.sessions.update(response.locals.session);
                response.status(403).send("Verification code expired");
            }
            else if (response.locals.session.user)
                response.status(400).send("User already logged in");
            else if (!metadata.verificationCode)
                response.status(400).send("Verification email not sent")
            else if (metadata.verificationCode != payload.verificationCode)
                response.status(403).send("Wrong verification code");
            else {
                const newUser = new User();
                newUser.username = payload.username;
                newUser.password = payload.password;
                newUser.email = payload.email;
                database.getTable(User).save(newUser).then(user => {
                    delete metadata.verificationCode;
                    delete metadata.mailTime;
                    response.locals.session.user = user;
                    response.locals.session.metadata = JSON.stringify(metadata);
                    database.sessions.update(response.locals.session);
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
        sourceUpload.single("source")(request, response, error => {
            if (error)
                response.status(500).send("Uploading failed for unknown reason");
            else {
                const params = request.query;
                const payload = request.body;
                if (!satisfyConstraints(payload,
                    ["language", String],
                    ["languageStandard", String, true],
                    ["compiler", String]))
                    response.status(400).send("Payload syntax error");
                else {
                    let stream = fileSystem.createReadStream(request.file.path);
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