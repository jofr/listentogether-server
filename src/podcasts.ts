import createPodcastApi from "podcast-index-api";

function convertImage(image: string) {
    return {
        original: image,
        thumbnail: image !== "" ? `https://listentogether.nsupdate.info/thumbnails/${encodeURIComponent(image)}?size=100` : "",
        large: image
    }
}

function convertPodcast(podcast: any) {
    return {
        ...podcast,
        image: convertImage(podcast.image),
        artwork: convertImage(podcast.artwork)
    }
}

function convertPodcasts(podcasts: any[]) {
    return podcasts.map(convertPodcast);
}

function convertEpisode(episode: any) {
    return {
        ...episode,
        image: convertImage(episode.image),
        feedImage: convertImage(episode.feedImage)
    }
}

function convertEpisodes(epsiodes: any[]) {
    return epsiodes.map(convertEpisode);
}

export function podcastApi(app, apiKey: string, apiSecret: string) {
    const podcastIndexApi = createPodcastApi(apiKey, apiSecret);

    app.get("/podcasts", async (req, res) => {
        try {
            const search = req.query["search"];
            if (!search) {
                throw new Error("Search parameter missing");
            }
            const podcasts = await podcastIndexApi.searchByTerm(search);
            if (podcasts.status === "true" && podcasts.count > 0) {
                res.send(convertPodcasts(podcasts.feeds));
            } else {
                res.end();
            }
        } catch (error) {
            console.error(error);
            res.end();
        }
    });

    app.get("/podcasts/:url", async (req, res) => {
        try {
            const url = req.params.url;
            const podcasts = await podcastIndexApi.podcastsByFeedUrl(url);
            if (podcasts.status == "true" && podcasts.feed) {
                res.send(convertPodcast(podcasts.feed));
            }
        } catch (error) {
            console.error(error);
            res.end();
        }
    });

    app.get("/podcasts/:url/episodes", async (req, res) => {
        try {
            const url = req.params.url;
            const maxQuery = parseInt(req.query["max"] as string);
            const max = maxQuery !== NaN ? maxQuery : 30;
            const episodes = await podcastIndexApi.episodesByFeedUrl(url, null, max);
            if (episodes.status === "true" && episodes.count > 0) {
                res.send(convertEpisodes(episodes.items));
            } else {
                res.end();
            }
        } catch (error) {
            console.error(error);
            res.end();
        }
    });
}