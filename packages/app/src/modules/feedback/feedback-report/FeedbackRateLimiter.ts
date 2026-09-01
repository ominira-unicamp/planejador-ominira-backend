type Entry = { count: number; resetAt: number };

export class FeedbackRateLimiter {
    private readonly entries = new Map<string, Entry>();

    constructor(
        private readonly maximum: number,
        private readonly windowMilliseconds: number
    ) {}

    consume(key: string, now = Date.now()) {
        const current = this.entries.get(key);
        if (!current || current.resetAt <= now) {
            this.entries.set(key, {
                count: 1,
                resetAt: now + this.windowMilliseconds
            });
            return { allowed: true as const };
        }
        if (current.count >= this.maximum)
            return {
                allowed: false as const,
                retryAfterSeconds: Math.max(
                    1,
                    Math.ceil((current.resetAt - now) / 1000)
                )
            };
        current.count += 1;
        return { allowed: true as const };
    }
}
