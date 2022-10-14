const util = require("node:util");
const ws = require("ws");

const peers = new Map();
const debuglog = util.debuglog("signaling");

const CLOSE_CODES = {
    ID_TAKEN: 4000,
    MISSING_ID: 4001,
    INVALID_ID: 4002
}

function onPong(id) {
    debuglog(`Received pong from ${id}`);
    const socket = peers.get(id);
    socket.isAlive = true;
}

function onMessage(fromId: string, data: any, isBinary: boolean) {
    try {
        const message = JSON.parse(data);
        if (message.to !== null && peers.has(message.to)) {
            const receiver = peers.get(message.to);
            message.from = fromId;
            receiver.send(JSON.stringify(message), { binary: isBinary });
        }
    } catch (error) {
        console.error(`Received malformed message from ${fromId} (could not be relayed):`, error.message);
    }
}

function onClose(id) {
    peers.delete(id);
    debuglog(`Connection to ${id} closed`);
}

function peerConnectionSetup(socket, request) {
    const index = request.url.indexOf("?");
    const searchParams = index !== -1 ? new URLSearchParams(request.url.substring(index)) : null;
    const id = searchParams ? searchParams.get("id") : null;

    if (id === null) {
        socket.close(CLOSE_CODES.MISSING_ID);
        debuglog("Denied connection attempt because id is missing");
    } else if (peers.has(id)) {
        socket.close(CLOSE_CODES.ID_TAKEN);
        debuglog(`Denied connection attempt because id ${id} is already taken`);
    } else {
        peers.set(id, socket);
        socket.isAlive = true;
        socket.on("pong", () => onPong(id));
        socket.on("message", (data: any, isBinary: boolean) => onMessage(id, data, isBinary));
        socket.on("close", () => onClose(id));
        debuglog(`New connection for ${id} accepted and open`);
    }
}

export function signalingServer(httpServer) {
    const wss = new ws.Server({ server: httpServer });
    wss.on("connection", (socket, request) => peerConnectionSetup(socket, request));
    
    setInterval(() => {
        debuglog(`Sending/checking heartbeat ping/pong for all connected peers`);
        wss.clients.forEach((socket) => {
            if (socket.isAlive === false) {
                return socket.terminate();
            }

            socket.isAlive = false;
            socket.ping();
        });
    }, 10000);
}