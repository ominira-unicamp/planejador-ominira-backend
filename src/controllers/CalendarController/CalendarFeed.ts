export type CalendarFeedEvent = {
    id: number;
    startDate: Date;
    endDate: Date | null;
    description: string;
    tags: { name: string }[];
};

function escapeText(value: string) {
    return value
        .replaceAll("\\", "\\\\")
        .replaceAll("\r\n", "\n")
        .replaceAll("\r", "\n")
        .replaceAll("\n", "\\n")
        .replaceAll(";", "\\;")
        .replaceAll(",", "\\,");
}

function foldLine(line: string) {
    const lines: string[] = [];
    let current = "";
    let currentBytes = 0;
    let limit = 75;

    for (const character of line) {
        const characterBytes = Buffer.byteLength(character, "utf8");
        if (currentBytes + characterBytes > limit) {
            lines.push(current);
            current = ` ${character}`;
            currentBytes = 1 + characterBytes;
            limit = 74;
            continue;
        }

        current += character;
        currentBytes += characterBytes;
    }

    lines.push(current);
    return lines.join("\r\n");
}

function formatDateTime(date: Date) {
    const year = date.getUTCFullYear().toString().padStart(4, "0");
    const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
    const day = date.getUTCDate().toString().padStart(2, "0");
    const hours = date.getUTCHours().toString().padStart(2, "0");
    const minutes = date.getUTCMinutes().toString().padStart(2, "0");
    const seconds = date.getUTCSeconds().toString().padStart(2, "0");

    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function formatDate(date: Date) {
    const year = date.getUTCFullYear().toString().padStart(4, "0");
    const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
    const day = date.getUTCDate().toString().padStart(2, "0");

    return `${year}${month}${day}`;
}

function isUtcMidnight(date: Date) {
    return (
        date.getUTCHours() === 0 &&
        date.getUTCMinutes() === 0 &&
        date.getUTCSeconds() === 0 &&
        date.getUTCMilliseconds() === 0
    );
}

function isAllDayEvent(event: CalendarFeedEvent) {
    return (
        isUtcMidnight(event.startDate) &&
        (!event.endDate || isUtcMidnight(event.endDate))
    );
}

function addUtcDays(date: Date, days: number) {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
}

function buildEventLines(event: CalendarFeedEvent, generatedAt: Date) {
    const allDay = isAllDayEvent(event);
    const lines = [
        "BEGIN:VEVENT",
        `UID:calendar-event-${event.id}@pomi`,
        `DTSTAMP:${formatDateTime(generatedAt)}`,
        allDay
            ? `DTSTART;VALUE=DATE:${formatDate(event.startDate)}`
            : `DTSTART:${formatDateTime(event.startDate)}`,
        `SUMMARY:${escapeText(event.description)}`
    ];

    if (allDay) {
        lines.splice(
            4,
            0,
            `DTEND;VALUE=DATE:${formatDate(addUtcDays(event.endDate ?? event.startDate, 1))}`
        );
    } else if (event.endDate) {
        lines.splice(4, 0, `DTEND:${formatDateTime(event.endDate)}`);
    }

    if (event.tags.length > 0) {
        lines.push(
            `CATEGORIES:${event.tags.map((tag) => escapeText(tag.name)).join(",")}`
        );
    }

    lines.push("END:VEVENT");
    return lines;
}

export function serializeCalendarFeed(
    events: readonly CalendarFeedEvent[],
    generatedAt = new Date()
) {
    const sortedEvents = [...events].sort(
        (first, second) =>
            first.startDate.getTime() - second.startDate.getTime() ||
            (first.endDate?.getTime() ?? Infinity) -
                (second.endDate?.getTime() ?? Infinity) ||
            first.id - second.id
    );
    const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//POMI//Calendar//PT-BR",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:POMI",
        ...sortedEvents.flatMap((event) => buildEventLines(event, generatedAt)),
        "END:VCALENDAR"
    ];

    return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
