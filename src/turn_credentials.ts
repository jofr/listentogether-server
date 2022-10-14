export function getTurnCredentials(req, res) {
    const origin = req.headers.origin;
    if (!argv.allowedTurnOrigins.includes(origin)) {
        res.writeHead(403);
        res.end();
        return;
    }

    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "OPTIONS, GET");

    if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
    } else {
        res.setHeader("Content-Type", "application/json");
        
        const ttl = 86400; // seconds (so 24 hours)
        const expirationTimestamp = Math.floor(Date.now()/1000) + ttl;
        const username = `${expirationTimestamp}:listentogether`;

        const hmac = crypto.createHmac("sha1", argv.turnSecret);
        hmac.setEncoding("base64");
        hmac.write(username);
        hmac.end()
        const password = hmac.read();

        res.writeHead(200);
        res.end(JSON.stringify({
            username: username,
            password: password,
            ttl: ttl
        }));
    }
}