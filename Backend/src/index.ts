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
import { Tag } from './entity/Tag';
import { Session } from './entity/Session';

declare global {
    interface Array<T> {
        select(this: any[], selector: (obj: T) => any): any[];
        extract(this: T[], ...keys: string[]): T[];
    }
    interface Math {
        randomBetween(min: number, max: number): number;
    }
}
Array.prototype.extract = function <T>(this: T[], ...keys: string[]): any[] {
    let result = [];
    for (let i = 0; i < this.length; ++i) {
        let current = {};
        for (let j = 0; j < keys.length; ++j) {
            let prop = keys[j].toString();
            if (this[i].hasOwnProperty(prop))
                current[prop] = this[i][prop];
        }
        result.push(current);
    }
    return result;
};
Array.prototype.select = function <T>(this: any[], selector: (obj: T) => any): any[] {
    let result = [];
    for (let i = 0; i < this.length; ++i)
        result.push(selector(this[i]));
    return result;
};
let int = Number.parseInt;
Database.create().then(database => {
    const app: express.Application = express();
    const guestAvailabelUrl: string[] = [
        "/api/user/hasUser",
        "/api/user/login",
        "/api/user/sendEmail",
        "/api/user/register"
    ];

    app.enable("trust proxy");

    app.use("/api", cookieParser(), bodyParser.json(), async (request, response, next) => {
        console.log({
            time: new Date(),
            url: request.url,
            path: request.path,
            params: request.query,
            payload: request.body,
            cookies: request.cookies,
        });
        async function createSession(): Promise<Session> {
            const session = await database.sessions.add();
            response.locals.session = session;
            response.cookie("sessionId", session.id);
            return session;
        }
        if (!request.cookies?.sessionId)
            createSession().then(_ => next());
        else {
            const sessionId = request.cookies.sessionId;
            if (!await database.sessions.has(sessionId)) {
                await createSession();
                request.path == "/user/login" ? next() : response.status(401).send("sessionId doesn't exist");
            }
            else {
                database.sessions.get(sessionId).then(async session => {
                    if (session.expired()) {
                        database.sessions.delete(sessionId);
                        const newSession = await createSession();
                        if (session.user && request.path != "/user/login")
                            response.status(401).send("Session expired");
                        else
                            next();
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
    }, (request, response, next) => {
        if (guestAvailabelUrl.indexOf("/api" + request.path) == -1 && !response.locals.session?.user)
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
            database.findOneByConditions(User, { email: query.email as string }).then(async user => {
                if (!user)
                    response.status(403).send("Email not registered");
                else if (user.session)
                    response.status(400).send("User already logged in");
                else {
                    response.locals.session.user = user;
                    database.sessions.update(response.locals.session).then(success => {
                        success ? response.status(200).send("Logged in successfully") :
                            response.sendStatus(500);
                    });
                }
            })
        }
    });

    app.get("/api/user/getAvator", (request, response) => {
        const params = request.query;
        const userId = params.userId ? int(params.userId as string) : response.locals.session.user.id;
        database.findById(User, userId).then(user => {
            if (user)
                response.json({ avator: user[0].avator });
            else
                response.status(400).send("User not found");
        })
    });

    app.get("/api/user/isAdministrator", (request, response) => {
        database.findById(User, response.locals.session.user.id, ["administrator"]).then(user => {
            user ? response.json({ isAdmin: user.administrator }) : response.sendStatus(500);
        });
    })

    app.get("/api/tag/getAll", (request, response) => {
        database.getTable(Tag).find({ select: ["name"] }).then(tags => {
            response.send(tags.select(tag => tag.name));
        }).catch(error => {
            console.log(error);
            response.sendStatus(500);
        })
    })

    app.get("/api/tag/getDescriptions", (request, response) => {
        const params = request.query;
        const result = satisfyConstraints(params, ["names", Array]);
        if (result !== true)
            response.status(400).send(`${result[0]} : ${result[1]}`);
        else {
            database.getTable(Tag).findByIds(params.names as string[]).then(tags => {
                const map: object = {};
                for (let tag of tags)
                    map[tag.name] = tag.description;
                response.send(map);
            })
        }
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
            if (await database.findOneByConditions(User, { email: query.email as string }))
                return response.status(403).send("Email address already registered");
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
        const result = satisfyConstraints(payload,
            ["username", /^[a-z0-9_]$/i, [1, 32]],
            ["password", [1, 32]],
            ["email", /^\S+@[a-zA-Z0-9]+\.[a-zA-Z]+$/, [1, 64]],
            ["verificationCode", /^[a-z0-9]{4}$/i],
            ["phone", true, /^[0-9]{11}$/],
            ["qq", true, /^[0-9]+$/, [6, 12]]);
        if (result !== true)
            response.status(400).send(`${result[0]} : ${result[1]}`);
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

    app.post("/api/problem/create", async (request, response) => {
        const payload = request.body;
        const result = satisfyConstraints(payload,
            ["title", [1, 255]],
            ["description", [1, 16777215]],
            ["tags", Array, true]);
        if (result !== true)
            response.status(400).send(`${result[0]} : ${result[1]}`);
        else {
            let newProblem = new Problem();
            newProblem.title = payload.title;
            newProblem.description = payload.description;
            newProblem.tags = await database.getTable(Tag).findByIds(payload.tags);
            newProblem.author = response.locals.session.user as User;
            database.getTable(Problem).save(newProblem).then(problem => {
                response.json({ id: problem.id });
            }).catch(error => {
                console.log(error);
                response.status(500);
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
                const result = satisfyConstraints(payload, ["language"], ["languageStandard", true], ["compiler"]);
                if (result !== true)
                    response.status(400).send(`${result[0]} : ${result[1]}`);
                else {
                    let stream = fileSystem.createReadStream(request.file.path);
                    console.log(stream);
                }
            }
        })
    })

    app.post("/api/tag/create", (request, response) => {
        const payload = request.body;
        const result = satisfyConstraints(payload,
            ["name", /^\S+$/i, [1, 16]],
            ["description", true, [1, 255]]);
        if (result !== true)
            response.status(400).send(`${result[0]} : ${result[1]}`);
        else if (database.has(Tag, payload.name))
            response.status(400).send("Tag already existed");
        else {
            const newTag = new Tag;
            rightJoin(newTag, payload);
            newTag.creator = response.locals.session.user;
            database.getTable(Tag).save(newTag).then(() => {
                response.sendStatus(200);
            }).catch(error => {
                console.log(error);
                response.sendStatus(500);
            });
        }
    })

    app.put("/api/user/modify", (request, response) => {
        const payload = request.body;
        const result = satisfyConstraints(payload,
            ["username", true, /^[a-z0-9_]$/i, [1, 32]],
            ["password", true, [1, 32]],
            ["phone", true, /^[0-9]{11}$/],
            ["qq", true, /^[0-9]+$/, [6, 12]],
            ["gender", true, /^Male|Female|Other|Secret$/]);
        if (result !== true)
            response.status(400).send(`${result[0]} : ${result[1]}`);
        else {
            rightJoin(response.locals.session.user, payload);
            database.getTable(User).save(response.locals.session.user as User).then(() => {
                response.sendStatus(200);
            }).catch(error => {
                console.log(error);
                response.sendStatus(500);
            });
        }
    })

    app.delete("/api/user/logout", (request, response) => {
        response.cookie("sessionId", "");
        database.sessions.delete(response.locals.session.id).then(success => {
            response.sendStatus(success ? 200 : 500);
        });
    });

    app.listen(19920, () => {
        console.log("App listening on 19920");
    });

    const sessionCleaner = setInterval(() => {
        database.getTable(Session).find().then(sessions => {
            let count = 0;
            for (const session of sessions) {
                if (session.expired()) {
                    database.sessions.delete(session.id);
                    ++count;
                }
            }
            console.log(`${count} expired sessions out of ${sessions.length} sessions have been cleared`);
        })
    }, 120000)
})