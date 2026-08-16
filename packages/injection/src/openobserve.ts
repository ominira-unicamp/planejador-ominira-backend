import { Writable } from "node:stream";

export type OpenObserveConfig = { url: string; auth: string };

const MAX_BATCH_SIZE = 50;
const MAX_QUEUE_SIZE = 1_000;
const FLUSH_INTERVAL_MS = 250;

export function openObserveConfig(
    stream = "pomi-injection-logs"
): OpenObserveConfig | undefined {
    const url = process.env.OPENOBSERVE_URL?.trim();
    if (!url) return undefined;
    const auth =
        process.env.OPENOBSERVE_AUTH?.trim() ||
        (process.env.OPENOBSERVE_USER && process.env.OPENOBSERVE_PASSWORD
            ? `Basic ${Buffer.from(
                  `${process.env.OPENOBSERVE_USER}:${process.env.OPENOBSERVE_PASSWORD}`
              ).toString("base64")}`
            : undefined);
    if (!auth)
        throw new Error(
            "OPENOBSERVE_AUTH ou OPENOBSERVE_USER/OPENOBSERVE_PASSWORD deve ser configurado quando OPENOBSERVE_URL estiver definido"
        );
    return {
        url: `${url.replace(/\/$/, "")}/${process.env.OPENOBSERVE_STREAM?.trim() || stream}/_json`,
        auth
    };
}

export function createOpenObserveStream(
    options: OpenObserveConfig,
    onError: (error: unknown) => void
): Writable {
    const queue: unknown[] = [];
    let flushing = false;
    let timer: NodeJS.Timeout | undefined;
    const flush = async (): Promise<void> => {
        if (flushing || queue.length === 0) return;
        flushing = true;
        const batch = queue.splice(0, MAX_BATCH_SIZE);
        try {
            let delay = 250;
            for (let attempt = 0; attempt < 3; attempt += 1) {
                try {
                    const response = await fetch(options.url, {
                        method: "POST",
                        headers: {
                            "Authorization": options.auth,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(batch),
                        signal: AbortSignal.timeout(5_000)
                    });
                    if (!response.ok)
                        throw new Error(
                            `OpenObserve respondeu HTTP ${response.status}`
                        );
                    break;
                } catch (error) {
                    if (attempt === 2) onError(error);
                    else {
                        await new Promise((resolve) =>
                            setTimeout(resolve, delay)
                        );
                        delay *= 2;
                    }
                }
            }
        } finally {
            flushing = false;
            if (queue.length > 0) void flush();
        }
    };
    const scheduleFlush = () => {
        if (timer) return;
        timer = setTimeout(() => {
            timer = undefined;
            void flush();
        }, FLUSH_INTERVAL_MS);
    };
    return new Writable({
        write(chunk, _encoding, callback) {
            try {
                if (queue.length >= MAX_QUEUE_SIZE) queue.shift();
                queue.push(JSON.parse(chunk.toString()));
                if (queue.length >= MAX_BATCH_SIZE) void flush();
                else scheduleFlush();
            } catch (error) {
                onError(error);
            }
            callback();
        },
        async final(callback) {
            if (timer) clearTimeout(timer);
            timer = undefined;
            while (queue.length > 0 || flushing) {
                await flush();
                if (flushing)
                    await new Promise((resolve) => setTimeout(resolve, 25));
            }
            callback();
        }
    });
}
