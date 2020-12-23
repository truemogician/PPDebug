import express = require("express");
import cookieParser = require("cookie-parser");
import bodyParser = require("body-parser");
import nodemailer = require("nodemailer");
import FileSystem = require("fs");
import Image = require("Jimp");
import Zlib = require("zlib");
import Mail = require("nodemailer/lib/mailer");
import Database from "./database";
import { hasKeys, rightJoin as rightAssign, verifyRequest } from "./verification";
import { MailTemplate, upload } from "./configuration";
import { User } from "./entity/User";
import { Problem } from "./entity/Problem";
import { Tag } from "./entity/Tag";
import { Session } from "./entity/Session";
import { Source, SourceType } from "./entity/Source";
import { Code } from "./entity/Code";
import { Language } from "./entity/Language";

declare global {
    interface Array<T> {
        select<R>(this: any[], selector: (obj: T) => R, skipNull?: boolean): R[];
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
            if (this[i].hasOwnProperty(prop)) current[prop] = this[i][prop];
        }
        result.push(current);
    }
    return result;
};
Array.prototype.select = function <T, R>(this: any[], selector: (obj: T) => R, skipNull = false): R[] {
    let result = new Array<R>();
    for (let i = 0; i < this.length; ++i) {
        const selected = selector(this[i]);
        if ((selected != null && selected != undefined) || !skipNull)
            result.push(selected);
    }
    return result;
};
let int = Number.parseInt;
type APIRestraintTuple = [boolean, number?];
class API {
    private restrictions: Map<string, APIRestraintTuple>;
    constructor(configFile?: string) {
        FileSystem.readFile(configFile ?? "api.json", "utf8", (error, data) => {
            if (error) throw error;
            else {
                const json = JSON.parse(data);
                this.restrictions = new Map(Object.entries(json) as [string, APIRestraintTuple][]);
            }
        });
    }
    has = (path: string) => this.restrictions.has(path);
    authorized = (path: string, user: User): boolean | string => {
        const target = this.restrictions.get(path);
        if (target[0] == true) return true;
        else {
            if (!user) return "Login required";
            else
                return user.reputation >= target[1]
                    ? true
                    : `At least ${target[1]} reputation required`;
        }
    };
}
const APIs = new API();

Database.create().then((database) => {
    const app: express.Application = express();

    app.enable("trust proxy");

    app.use(cookieParser(), bodyParser.json(), (request, response, next) => next());
    //API existence
    app.use("/api", (request, response, next) => {
        if (!APIs.has("/api" + request.path)) response.status(400).send("API not supported");
        else next();
    });
    //Session
    app.use("/api", async (request, response, next) => {
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
        if (!request.cookies?.sessionId) createSession().then((_) => next());
        else {
            const sessionId = request.cookies.sessionId;
            if (!(await database.sessions.has(sessionId))) {
                await createSession();
                request.path == "/user/login"
                    ? next()
                    : response.status(401).send("sessionId doesn't exist");
            } else {
                database.sessions.get(sessionId).then(async (session) => {
                    if (session.expired()) {
                        database.sessions.delete(sessionId);
                        const newSession = await createSession();
                        if (session.user && request.path != "/user/login")
                            response.status(401).send("Session expired");
                        else next();
                    } else {
                        session.lastAccessDate = new Date();
                        database.sessions.update(session);
                        response.locals.session = session;
                        next();
                    }
                });
            }
        }
    });
    //API authentification
    app.use("/api", (request, response, next) => {
        const result = APIs.authorized("/api" + request.path, response.locals.session.user);
        if (result === true) next();
        else response.status(401).send(result);
    });

    app.get("/api/user/hasUser", (request, response) => {
        const query = request.query;
        if (/^\S+@[a-zA-Z0-9]+\.[a-zA-Z]+$/.test(query.email as string)) {
            database.findOneByConditions(User, { email: query.email as string }).then((user) => {
                response.json({
                    exist: user != null && user != undefined,
                });
            });
        } else {
            response
                .status(400)
                .send(query.email ? "'email' syntax error" : "Parameter 'email' required");
        }
    });

    app.get("/api/user/login", (request, response) => {
        const query = request.query;
        if (!hasKeys(query, "email", "password")) response.status(400).send("Parameter(s) missing");
        else {
            database
                .findOneByConditions(User, { email: query.email as string })
                .then(async (user) => {
                    if (!user) response.status(403).send("Email not registered");
                    else if (user.session) response.status(400).send("User already logged in");
                    else {
                        response.locals.session.user = user;
                        database.sessions.update(response.locals.session).then((success) => {
                            success
                                ? response.status(200).send("Logged in successfully")
                                : response.sendStatus(500);
                        });
                    }
                });
        }
    });

    app.get("/api/user/getAvatar", (request, response) => {
        if (!verifyRequest("Parameter", request, response, ["userId", true]))
            return;
        const userId = request.query.userId
            ? int(request.query.userId as string)
            : response.locals.session.user.id;
        database.findById(User, userId).then((user) => {
            if (user) {
                response.json({
                    avatar: user.avatar
                        ? Zlib.inflateSync(user.avatar).toString()
                        : null
                });
            }
            else response.status(400).send("User not found");
        });
    });

    app.get("/api/user/getRawAvatar", (request, response) => {
        if (!verifyRequest("Parameter", request, response, ["userId", true]))
            return;
        const userId = request.query.userId
            ? int(request.query.userId as string)
            : response.locals.session.user.id;
        database.findById(User, userId).then(user => {
            if (user) {
                let avatar = null;
                FileSystem.readdir("../Resource/Upload/Avatar", (error, files) => {
                    if (error) {
                        console.log(error);
                        response.status(500).send("Unknown error occurred when reading folder");
                    }
                    else {
                        for (const file of files) {
                            if (user.id.toString() == file.substr(0, file.lastIndexOf("."))) {
                                avatar = `${request.hostname}/resource/avatar/${file}`;
                                break;
                            }
                        }
                    }
                })
                response.json({ avatar: avatar });
            }
            else response.status(400).send("User not found");
        });
    });

    app.get("/api/user/getInformation", (request, response) => {
        if (!verifyRequest(
            "Parameter", request, response,
            ["avatar", true, /^true|false$/],
            ["phone", true, /^true|false$/],
            ["qq", true, /^true|false$/],
            ["gender", true, /^true|false$/],
        )) return;
        const params = request.query;
        const userId = response.locals.session.user.id;
        database.findById(User, userId).then(user => {
            if (!user)
                return response.status(404).send("User doesn't exist");
            response.json({
                id: userId,
                username: user.username,
                administrator: user.administrator,
                email: user.email,
                reputation: user.reputation,
                joinDate: user.joinDate,
                avatar: params.avatar ? (user.avatar ? Zlib.inflateSync(user.avatar) : null) : null,
                phone: params.phone ? user.phone : null,
                qq: params.qq ? user.qq : null,
                gender: params.gender ? user.gender : null
            })
        })
    })

    app.get("/api/user/isAdministrator", (request, response) => {
        database.findById(User, response.locals.session.user.id, ["administrator"]).then((user) => {
            user ? response.json({ isAdmin: user.administrator }) : response.sendStatus(500);
        });
    });

    app.get("/api/user/hasDropped", (request, response) => {
        if (!verifyRequest("Parameter", request, response, ["userId"])) return;
        database.findById(User, request.query.userId as string, ["id", "dropDate"]).then((user) => {
            user ? response.json({ dropDate: user.dropDate }) : response.sendStatus(500);
        });
    });

    app.get("/api/tag/getAll", (request, response) => {
        database
            .getTable(Tag)
            .find({ select: ["name"] })
            .then((tags) => {
                response.send(tags.select((tag) => tag.name));
            })
            .catch((error) => {
                console.log(error);
                response.sendStatus(500);
            });
    });

    app.get("/api/tag/getDescriptions", (request, response) => {
        if (!verifyRequest("Parameter", request, response, ["names", Array]))
            return;
        database
            .getTable(Tag)
            .findByIds(request.query.names as string[])
            .then((tags) => {
                const map: object = {};
                for (let tag of tags) map[tag.name] = tag.description;
                response.send(map);
            });
    });

    app.get("/api/problem/getProblems", (request, response) => {
        if (!verifyRequest(
            "Parameter", request, response,
            ["skip", true, /^[0-9]+$/],
            ["count", true, /^[0-9]+$/]
        )) return;
        const params = {
            skip: request.query.skip ? int(request.query.skip as string) : 0,
            count: request.query.count ? int(request.query.count as string) : 10
        };
        database.getTable(Problem).find({
            skip: params.skip,
            take: params.count,
            select: ["id", "title", "author", "voteUp", "voteDown"],
            relations: ["tags", "author"]
        }).then(problems => {
            response.send(problems.map(problem => {
                return {
                    id: problem.id,
                    title: problem.title,
                    tags: problem.tags?.select(tag => tag.name),
                    authorId: problem.author.id,
                    voteCount: problem.voteUp - problem.voteDown
                }
            }))
        })
    });

    app.get("/api/problem/getDetail", (request, response) => {
        if (!verifyRequest("Parameter", request, response, ["id", /^[0-9]+$/]))
            return;
        const problemId = int(request.query.id as string);
        database.getTable(Problem).findOne(problemId, {
            select: ["title", "description", "voteUp", "voteDown"],
            relations: ["tags", "contributors", "sources"]
        }).then(problem => {
            if (!problem)
                return response.status(404).send("Problem doesn't exist");
            response.json({
                id: problemId,
                title: problem.title,
                description: problem.description,
                tags: problem.tags?.select(tag => tag.name),
                authorId: problem.author.id,
                contributorsId: problem.contributors?.select(contributor => contributor.id),
                voteCount: problem.voteUp - problem.voteDown,
                datamakersId: problem.sources?.select(source => source.type == SourceType.Datamaker ? source.id : null, true),
                standardsId: problem.sources?.select(source => source.type == SourceType.Standard ? source.id : null, true),
                judgersId: problem.sources?.select(source => source.type == SourceType.Judger ? source.id : null, true),
            });
        })
    });

    app.get("/api/source/getSource", (request, response) => {
        if (!verifyRequest("Parameter", request, response, ["id", /^[0-9]+$/]))
            return;
        const sourceId = int(request.query.id as string);
        database.getTable(Source).findOne(sourceId, {
            select: ["type", "language", "compiler", "voteUp", "voteDown"],
            relations: ["author", "problem", "contributors"]
        }).then(source => {
            if (!source)
                return response.status(404).send("Source doesn't exist");
            response.json({
                id: sourceId,
                type: source.type,
                language: source.language,
                compiler: source.compiler,
                voteCount: source.voteUp - source.voteDown,
                authorId: source.author.id,
                contributorsId: source.contributors.length
                    ? source.contributors.select(contributor => contributor.id)
                    : undefined,
                problemId: source.problem?.id,
            });
        }).catch(error => {
            console.log(error);
            response.sendStatus(500);
        })
    });

    app.get("/api/source/getCode", (request, response) => {
        if (!verifyRequest("Parameter", request, response, ["id", /^[0-9]+$/]))
            return;
        const sourceId = int(request.query.id as string);
        database.findById(Code, sourceId).then(code => {
            if (!code)
                return response.status(404).send("Code doesn't exist");
            response.json({
                code: Zlib.inflateSync(code.code).toString()
            });
        })
    });

    app.get("/api/language/getAll", (request, response) => {
        database.getTable(Language).find().then(languages => {
            response.send(languages.map((language => {
                return {
                    name: language.name,
                    standards: language._standards ? language.standards : null,
                    compilers: language.compilers
                }
            })))
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
            if (
                await database.findOneByConditions(User, {
                    email: query.email as string,
                })
            )
                return response.status(403).send("Email address already registered");
            const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            let verificationCode: string;
            do {
                verificationCode = "";
                for (let i = 0; i < 4; ++i)
                    verificationCode += charset.charAt(Math.floor(Math.random() * charset.length));
            } while (verificationCode.length != 4);
            const mail = new MailTemplate(query.email as string, verificationCode);
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
                    response.status(500).send("Email sending failed for unknown reason");
                } else {
                    metadata.mailTime = Date.now();
                    metadata.verificationCode = verificationCode;
                    response.locals.session.metadata = JSON.stringify(metadata);
                    database.sessions.update(response.locals.session);
                    console.log("Email sent: " + info.response);
                    response.sendStatus(200);
                }
            });
        } else response.status(400).send("Email syntax error");
    });

    app.post("/api/user/register", (request, response) => {
        if (!verifyRequest(
            "Payload", request, response,
            ["username", /^[a-z0-9_]$/i, [1, 32]],
            ["password", [1, 32]],
            ["email", /^\S+@[a-zA-Z0-9]+\.[a-zA-Z]+$/, [1, 64]],
            ["verificationCode", /^[a-z0-9]{4}$/i],
            ["phone", true, /^[0-9]{11}$/],
            ["qq", true, /^[0-9]+$/, [6, 12]]
        )) return;
        const metadata = response.locals.session.metadata
            ? JSON.parse(response.locals.session.metadata)
            : {};
        if (metadata.mailTime && Date.now() > metadata.mailTime + 600000) {
            delete metadata.verificationCode;
            delete metadata.mailTime;
            response.locals.session.metadata = JSON.stringify(metadata);
            database.sessions.update(response.locals.session);
            response.status(403).send("Verification code expired");
        } else if (response.locals.session.user)
            response.status(400).send("User already logged in");
        else if (!metadata.verificationCode)
            response.status(400).send("Verification email not sent");
        else if (metadata.verificationCode != request.body.verificationCode)
            response.status(403).send("Wrong verification code");
        else {
            const newUser = new User();
            newUser.username = request.body.username;
            newUser.password = request.body.password;
            newUser.email = request.body.email;
            database
                .getTable(User)
                .save(newUser)
                .then((user) => {
                    delete metadata.verificationCode;
                    delete metadata.mailTime;
                    response.locals.session.user = user;
                    response.locals.session.metadata = JSON.stringify(metadata);
                    database.sessions.update(response.locals.session);
                    response.status(201).json({
                        id: user.id,
                    });
                });
        }
    });

    app.post("/api/problem/create", async (request, response) => {
        if (!verifyRequest(
            "Payload", request, response,
            ["title", [1, 255]],
            ["description", [1, 16777215]],
            ["tags", Array, true]
        )) return;
        const payload = request.body;
        let newProblem = new Problem();
        newProblem.title = payload.title;
        newProblem.description = payload.description;
        newProblem.tags = await database.getTable(Tag).findByIds(payload.tags);
        newProblem.author = response.locals.session.user as User;
        database
            .getTable(Problem)
            .save(newProblem)
            .then((problem) => {
                response.json({ id: problem.id });
            })
            .catch((error) => {
                console.log(error);
                response.status(500);
            });
    });

    app.post("/api/source/upload", bodyParser.urlencoded(), (request, response) => {
        const user = response.locals.session.user;
        upload({
            location: "../Resource/Upload/Temp",
            filename: (file: Express.Multer.File) =>
                `${user.id}-${Date.now()}-${file.originalname}`,
            sizeLimit: 131072,
        }).single("source")(request, response, async (error: any) => {
            if (error) {
                console.log(error);
                response.status(500).send("Uploading failed for unknown reason");
            } else {
                if (!verifyRequest("Parameter", request, response, ["problemId", true]) ||
                    !verifyRequest(
                        "Payload", request, response,
                        ["type", /^Datamaker|Standard|Judged|Judger$/],
                        ["language"],
                        ["compiler"],
                        ["languageStandard", true]
                    )) return;
                const params = request.query, formdata = request.body;
                const languages = await database.getTable(Language).find();
                let language: Language = null;
                for (const lan of languages) {
                    if (
                        lan.name == (formdata.language as string) &&
                        lan.compilers.includes(formdata.compiler) &&
                        (lan._standards
                            ? lan.standards.includes(formdata.languageStandard)
                            : formdata.languageStandard == null)
                    ) {
                        language = lan;
                        break;
                    }
                }
                if (!language)
                    return response.status(400).send("Language or standard or compiler not supported");
                FileSystem.readFile(request.file.path, async (error, data) => {
                    if (error) response.status(500).send("File reading error");
                    else {
                        const newSource = new Source();
                        rightAssign(newSource, formdata);
                        newSource.language = language;
                        const newCode = new Code();
                        newCode.code = Zlib.deflateSync(data);
                        console.log("Compression rate : " + (1 - newCode.code.length / data.length));
                        FileSystem.unlink(request.file.path, error => error ? console.log(error) : null);
                        newSource.code = newCode;
                        if (params.problemId)
                            newSource.problem = await database.findById(
                                Problem,
                                int(params.problemId as string)
                            );
                        newSource.author = response.locals.session.user;
                        database
                            .getTable(Source)
                            .save(newSource)
                            .then(source => response.json({ id: source.id }))
                            .catch(error => {
                                console.log(error);
                                response.status(500).send("Unknown error occurred when saving file to database");
                            });
                    }
                });
            }
        });
    });

    app.post("/api/tag/create", (request, response) => {
        if (!verifyRequest(
            "Payload", request, response,
            ["name", /^\S+$/i, [1, 16]],
            ["description", true, [1, 255]]
        )) return;
        const payload = request.body;
        if (database.has(Tag, payload.name)) response.status(400).send("Tag already existed");
        else {
            const newTag = new Tag();
            rightAssign(newTag, payload);
            newTag.creator = response.locals.session.user;
            database
                .getTable(Tag)
                .save(newTag)
                .then(() => {
                    response.sendStatus(200);
                })
                .catch((error) => {
                    console.log(error);
                    response.sendStatus(500);
                });
        }
    });

    app.put("/api/user/modify", (request, response) => {
        if (!verifyRequest(
            "Payload", request, response,
            ["username", true, /^[a-z0-9_]$/i, [1, 32]],
            ["password", true, [1, 32]],
            ["phone", true, /^[0-9]{11}$/],
            ["qq", true, /^[0-9]+$/, [6, 12]],
            ["gender", true, /^Male|Female|Other|Secret$/]
        )) return;
        const payload = request.body;
        rightAssign(response.locals.session.user, payload);
        database
            .getTable(User)
            .save(response.locals.session.user as User)
            .then(() => {
                response.sendStatus(200);
            })
            .catch((error) => {
                console.log(error);
                response.sendStatus(500);
            });
    });

    app.put("/api/user/uploadAvatar", (request, response) => {
        const user = response.locals.session.user as User;
        upload({
            location: "../Resource/Upload/Avatar",
            filename: (file: Express.Multer.File) => {
                const extension = file.originalname.split(".")[-1];
                return user.id + "." + extension;
            },
            sizeLimit: 2097152,
        }).single("avatar")(request, response, (error: any) => {
            if (error) {
                console.log(error);
                response.status(500).send("Uploading failed for unknown reason");
            } else {
                Image.read(request.file.path).then((image) => {
                    image.resize(256, 256);
                    image.getBase64Async(image.getExtension()).then((base64) => {
                        Zlib.deflate(base64, (error, result) => {
                            if (error)
                                response.status(500).send("Compression failed for unknown reason");
                            else {
                                user.avatar = result.toString();
                                database
                                    .getTable(User)
                                    .save(user)
                                    .then(() => {
                                        response.sendStatus(200);
                                    })
                                    .catch((error) => {
                                        console.log(error);
                                        response.sendStatus(500);
                                    });
                            }
                        });
                    });
                });
            }
        });
    });

    app.delete("/api/user/logout", (request, response) => {
        response.cookie("sessionId", "");
        database.sessions.delete(response.locals.session.id).then((success) => {
            response.sendStatus(success ? 200 : 500);
        });
    });

    app.listen(19920, () => console.log("App listening on 19920"));

    const sessionCleaner = setInterval(() => {
        database
            .getTable(Session)
            .find()
            .then((sessions) => {
                let count = 0;
                for (const session of sessions) {
                    if (session.expired()) {
                        database.sessions.delete(session.id);
                        ++count;
                    }
                }
                if (count)
                    console.log(`${count} / ${sessions.length} session(s) have been cleared`);
            });
    }, 120000);
});
