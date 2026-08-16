import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { Router, type Request, type Response } from "express";

import { AuthRegistry } from "#/auth.js";
import { serializeCalendarFeed } from "#/modules/schedule/calendar/CalendarFeed.js";
import {
    calendarQuerySchema,
    invalidCalendarQuery
} from "#/modules/schedule/calendar/CalendarQuery.js";
import {
    InternalServerErrorProblemSchema,
    InvalidRequestProblemSchema,
    invalidRequestProblem,
    sendProblem
} from "@pomi/api-core";

const router = Router();
const authRegistry = new AuthRegistry();

authRegistry.addException("GET", "/calendar");

async function getCalendar(req: Request, res: Response) {
    const query = calendarQuerySchema.safeParse(req.query);
    if (!query.success) {
        const validation = invalidCalendarQuery(query.error);
        return sendProblem(
            res,
            invalidRequestProblem(validation.errors, req.path)
        );
    }

    const events = await req.scope.cradle.calendarService.feed(query.data);

    const feed = serializeCalendarFeed(events);
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader(
        "Content-Disposition",
        'inline; filename="pomi-calendar.ics"'
    );
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.status(200).send(feed);
}

router.get("/calendar", getCalendar);

const registry = new OpenAPIRegistry();

registry.registerPath({
    method: "get",
    path: "/calendar",
    tags: ["calendar"],
    request: {
        query: calendarQuerySchema
    },
    responses: {
        200: {
            description: "Public iCalendar feed",
            content: {
                "text/calendar": {
                    schema: {
                        type: "string"
                    }
                }
            }
        },
        500: {
            description: "Não foi possível concluir a ação",
            content: {
                "application/problem+json": {
                    schema: InternalServerErrorProblemSchema
                }
            }
        },
        400: {
            description: "Dados da requisição inválidos",
            content: {
                "application/problem+json": {
                    schema: InvalidRequestProblemSchema
                }
            }
        }
    }
});

export default {
    router,
    registry,
    authRegistry
};
