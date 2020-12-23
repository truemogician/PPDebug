import multer = require("multer")
import FileSystem = require("fs")
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
        const html = parseHtml(FileSystem.readFileSync("email.html", "utf8").toString());
        html.querySelector("#target").set_content(target);
        html.querySelector("#verificationCode").set_content(verificationCode);
        this.content = html.toString();
    }
}
interface UploadConfig {
    location: string | ((file: Express.Multer.File) => string)
    filename: string | ((file: Express.Multer.File) => string)
    sizeLimit: number
    countLimit?: number
}
export function upload(config: UploadConfig) {
    return multer({
        storage: multer.diskStorage({
            destination: (_req, file, callback) => {
                const location = typeof config.location == "string"
                    ? config.location
                    : config.location(file);
                callback(null, location);
            },
            filename: (_req, file, callback) => {
                const filename = typeof config.filename == "string"
                    ? config.filename
                    : config.filename(file);
                callback(null, filename);
            }
        }),
        limits: {
            fileSize: config.sizeLimit,
            files: config.countLimit ?? 1,
        }
    })
}