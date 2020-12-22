import multer = require("multer")
import fileSystem = require("fs")
import { parse as parseHtml } from "node-html-parser"
import SMTPTransport = require("nodemailer/lib/smtp-transport")
export class MailTemplate {
    config: SMTPTransport.Options = {
        host: "smtp.exmail.qq.com",
        port: 465,
        secure: true,
        auth: {
            user: "ppdebug@truemogician.com",
            pass: "EUPHFqvJM9MhSZeT"
        }
    }
    content: string
    constructor(target: string, verificationCode: string) {
        const html = parseHtml(fileSystem.readFileSync("email.html", "utf8").toString());
        html.querySelector("#target").set_content(target);
        html.querySelector("#verificationCode").set_content(verificationCode);
        this.content = html.toString();
    }
}
export const sourceUpload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, "upload/source"),
        filename: (_req, file, cb) => cb(null, file.originalname + '-' + Date.now())
    }),
    limits: {
        fileSize: 524288,
        files: 1,
    }
})
export const avatorUpload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, "upload/avator"),
        filename: (_req, file, cb) => cb(null, file.fieldname + '-' + Date.now())
    }),
    limits: {
        fileSize: 2097152,
        files: 1,
    },
})