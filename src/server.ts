const yargs = require("yargs");
const https = require("https");
const http = require("http");
const fs = require("fs");
const ws = require("ws");

const argv = yargs
    .default("cert", "")
    .default("key", "")
    .default("port", "")
    .argv

let server;

function httpsServer(cert, key) {
    server = https.createServer({
        cert: cert,
        key: key
    });
}

function httpServer() {
    server = http.createServer();
}

if (argv.cert !== "" && argv.key !== "") {
    try {
        const cert = fs.readFileSync(argv.cert);
        const key = fs.readFileSync(argv.key);
        httpsServer(cert, key);
    } catch (error) {
        console.log("Could not read certificate and/or private key (falling back to unsecure connection):", error.message);
        httpServer();
    }
} else {
    if (argv.cert !== "" || argv.key !== "") {
        console.log("Need both certificate and private key for secure connection (falling back to unsecure connection)")
    }
    httpServer();
}

const wss = new ws.Server({ server });
const peers = new Map();

const CLOSE_CODES = {
    ID_TAKEN: 4000,
    MISSING_ID: 4001,
    INVALID_ID: 4002
}

const onMessage = (fromId: string, data: any, isBinary: boolean) => {
    try {
        const message = JSON.parse(data);
        if (message.to !== null && peers.has(message.to)) {
            const receiver = peers.get(message.to);
            message.from = fromId;
            receiver.send(JSON.stringify(message), { binary: isBinary });
        }
    } catch (error) {
        console.log("Received message could not be processed:", error.message);
    }
}

const onClose = (id) => {
    peers.delete(id);
}

wss.on("connection", (socket, request) => {
    const index = request.url.indexOf("?");
    const searchParams = index !== -1 ? new URLSearchParams(request.url.substring(index)) : null;
    const id = searchParams ? searchParams.get("id") : null;

    if (id === null) {
        socket.close(CLOSE_CODES.MISSING_ID);
    } else if (peers.has(id)) {
        socket.close(CLOSE_CODES.ID_TAKEN);
    } else {
        peers.set(id, socket);
        socket.on("message", (data: any, isBinary: boolean) => onMessage(id, data, isBinary));
        socket.on("close", () => onClose(id));
    }
});

const port = argv.port !== ""
    ? parseInt(argv.port)
    : server instanceof https.Server ? 443 : 80 

server.listen(port, () => {
    console.log(`Listening on port ${port}`);
});