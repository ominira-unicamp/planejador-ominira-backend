import { Cron } from "croner";

export function validateCronExpression(expression: string) {
    if (expression.trim().split(/\s+/).length !== 5)
        throw new Error(`Expressão cron deve ter cinco campos: ${expression}`);
    const schedule = new Cron(expression, { paused: true });
    schedule.stop();
    return expression;
}

export function nextCronOccurrence(
    expression: string,
    from: Date = new Date()
) {
    const schedule = new Cron(expression, { paused: true });
    try {
        return schedule.nextRun(from);
    } finally {
        schedule.stop();
    }
}
