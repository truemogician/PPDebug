import express = require('express');
import cookieParser = require('cookie-parser');
import Database from "./database"

Database.create().then(database => {
    const app: express.Application = express();
    const guestAvailabelUrl:string[]=[
        "/api/user/hasUser",
        "/api/user/login",
        "/api/user/sendEmail",
        "/api/user/register",
    ];

    app.enable("trust proxy");
    app.use("/api",cookieParser(), async (request, response, next) => {
        console.log({
            time: new Date(),
            ip: request.connection.remoteAddress,
            url: request.url,
            path: request.path,
            params: request.query,
            cookies: request.cookies,
        });
        if (!request.cookies || !request.cookies.sessionId) {
            response.cookie("sessionId", (await database.sessions.add()).id);
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
                        response.cookie("sessionId", (await database.sessions.add()).id);
                        session.user?response.status(401).send("Session expired"):next();
                    }
                    else {
                        session.lastAccessDate = new Date();
                        database.sessions.update(session);
                        next();
                    }
                })
            }
        }
    },async (request,response,next)=>{
        if (guestAvailabelUrl.indexOf(request.path)==-1 && request.cookies.sessionId){
            const session=await database.sessions.get(request.cookies.sessionId);
            if (!session.user)
                response.status(401).send("Login required");
            else
                next();
        }
        else
            next();
    });

    app.get("/api/user/hasUser", (request, response) => {
        response.json({
            exist: true
        });
    });

    app.listen(19920, () => {
        console.log("App listening on 19920");
    });
})