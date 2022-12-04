import { IncomingMessage } from "node:http";
import util from "node:util";
import { WebSocket, WebSocketServer } from "ws";

type Peer = {
    webSocket: WebSocket,
    isAlive: boolean
}

const peers = new Map<string,Peer>();
const debuglog = util.debuglog("signaling");

const CLOSE_CODES = {
    ID_TAKEN: 4000,
    MISSING_ID: 4001,
    INVALID_ID: 4002
}

function onPong(id: string) {
    debuglog(`Received pong from ${id}`);
    const peer = peers.get(id);
    peer.isAlive = true;
}

function onMessage(fromId: string, data: any, isBinary: boolean) {
    try {
        const message = JSON.parse(data);
        if (message.to !== null && peers.has(message.to)) {
            const receiver = peers.get(message.to);
            message.from = fromId;
            receiver.webSocket.send(JSON.stringify(message), { binary: isBinary });
        }
    } catch (error) {
        console.error(`Received malformed message from ${fromId} (could not be relayed):`, error.message);
    }
}

function onClose(id: string) {
    peers.delete(id);
    debuglog(`Connection to ${id} closed`);
}

function peerConnectionSetup(socket: WebSocket, request: IncomingMessage) {
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
        peers.set(id, { webSocket: socket, isAlive: true });
        socket.on("pong", () => onPong(id));
        socket.on("message", (data: any, isBinary: boolean) => onMessage(id, data, isBinary));
        socket.on("close", () => onClose(id));
        debuglog(`New connection for ${id} accepted and open`);
    }
}

export function signalingServer(path: string, httpServer) {
    const wss = new WebSocketServer({ server: httpServer, path: path });
    wss.on("connection", (socket, request) => peerConnectionSetup(socket, request));
    
    setInterval(() => {
        debuglog(`Sending/checking heartbeat ping/pong for all connected peers`);
        for (const peer of peers.values()) {
            if (peer.isAlive === false) {
                return peer.webSocket.terminate();
            }

            peer.isAlive = false;
            peer.webSocket.ping();
        }
    }, 10000);
}