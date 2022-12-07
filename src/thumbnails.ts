import followRedirects from "follow-redirects";
const { http, https } = followRedirects;
import sharp from "sharp";

function getImageThumbnailBuffer(url: string, protocl: "http" | "https", format: string, size: number): Promise<Buffer | null> {
    let resolveImageThumbnailBuffer: (value: Buffer | null) => void;
    const result = new Promise<Buffer | null>((resolve) => resolveImageThumbnailBuffer = resolve);

    try {
        const resizer = sharp().resize(size, size)[format]();
        const agent = protocl === "http" ? http : https;
        agent.get(url, (response) => {
            if (!response.headers["content-type"].includes("image")) {
                console.log(response.headers)
                console.error("Not an image");
                resolveImageThumbnailBuffer(null);
            } else {
                response.pipe(resizer);
                resolveImageThumbnailBuffer(resizer.toBuffer());
            }
        });
    } catch (error) {
        console.error(error);
        resolveImageThumbnailBuffer(null);
    }

    return result;
}

function urlProtocol(input: string): "http" | "https" | null {
    const url = new URL(input);
    if (url.protocol === "http:") {
        return "http";
    } else if (url.protocol === "https:") {
        return "https";
    } else {
        return null;
    }
}

export function imageThumbnails(app) {
    app.get("/thumbnails/:url/", async (req, res) => {
        const url = req.params.url;
        const protocol = urlProtocol(url);

        if (protocol === null) {
            console.error("Not a valid URL");
            return res.end();
        }

        const size = req.query["size"] ? parseInt(req.query["size"] as string) : 150;
        const format = req.accepts("avif", "webp", "jpeg") || null;

        if (format === null) {
            console.error("Does not accept any of the supported image formats (avif, webp, jpeg)");
            return res.end();
        }

        const thumbnail = await getImageThumbnailBuffer(url, protocol, format, size);
        if (thumbnail !== null) {
            res.contentType(`image/${format}`);
            res.send(thumbnail);
        } else {
            res.end();
        }
    });
}