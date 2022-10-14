const util = require("node:util")
const https = require("node:https");
const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs");
const yargs = require("yargs");

const { signalingServer } = require("./signaling");
const { getTurnCredentials } = require("./turn_credentials");

const argv = yargs
    .default("cert", "")
    .default("key", "")
    .default("port", "")
    .default("turn-secret", "")
    .default("allowed-turn-origins", [])
    .config()
    .argv

function createServer(certPath = "", keyPath = "") {
    if (certPath !== "" && keyPath !== "") {
        try {
            const cert = fs.readFileSync(certPath);
            const key = fs.readFileSync(keyPath);
            return https.createServer({
                cert: cert,
                key: key
            }, serverRequest);
        } catch (error) {
            console.error("Could not read certificate and/or private key (falling back to unsecure connection):", error.message);
            return http.createServer(serverRequest);
        }
    } else {
        if (argv.cert !== "" || argv.key !== "") {
            console.error("Only cert or key provided, need both for secure connection (falling back to unsecure connection)");
        }
        return http.createServer(serverRequest);
    }
}

function serverRequest(req, res) {
    if (req.url === "/turn_credentials") {
        getTurnCredentials(req, res);
    } else {
        res.writeHead(404);
        res.end();
    }
}

const server = createServer(argv.cert, argv.key);
signalingServer(server);

const port = argv.port !== ""
    ? parseInt(argv.port)
    : server instanceof https.Server ? 443 : 80 

server.listen(port, () => {
    console.log(`Listening on port ${port}`);
});