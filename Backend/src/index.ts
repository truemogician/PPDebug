import "reflect-metadata";
import { createConnection } from "typeorm";

createConnection().then(async connection => {
    console.log("Connected");
}).catch(error => console.log(error));
