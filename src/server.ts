import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import yargs from "yargs";
import express from "express";
import cors from "cors";

import { signalingServer } from "./signaling.js";
import { podcastApi } from "./podcasts.js";
import { imageThumbnails } from "./thumbnails.js";
import { turnCredentials } from "@jofr/express-turn-credentials-rest-api";

const argv = yargs(process.argv).options({
    cert: { type: "string" },
    key: { type: "string" },
    port: { type: "number" },
    turnSecret: { type: "string" },
    podcastApiKey: { type: "string" },
    podcastApiSecret: { type: "string" },
    allowedCorsOrigins: { type: "array", default: [] }
}).config().parseSync();

let secure = false;
let cert: Buffer, key: Buffer;
if (argv.cert !== undefined && argv.key !== undefined) {
    try {
        cert = fs.readFileSync(argv.cert);
        key = fs.readFileSync(argv.key);
        secure = true;
    } catch (error) {
        console.error("Could not read certificate and/or private key (falling back to unsecure connection): ", error.message);
        secure = false;
    }
} else if (argv.cert !== undefined || argv.key !== undefined) {
    console.error("Only cert or key provided, need both for secure connection (falling back to unsecure connection)");
}

const app = express();
app.use(cors({ origin: argv.allowedCorsOrigins }));
const server = secure
             ? https.createServer({ cert: cert, key: key}, app)
             : http.createServer(app);

signalingServer("/signaling", server);
podcastApi(app, argv.podcastApiKey, argv.podcastApiSecret);
imageThumbnails(app);
app.get("/turn/credentials", turnCredentials({ sharedSecret: argv.turnSecret }));

const port = argv.port !== undefined
           ? argv.port
           : secure ? 443 : 80;

server.listen(port, () => {
    console.log(`Listening on port ${port}`);
});