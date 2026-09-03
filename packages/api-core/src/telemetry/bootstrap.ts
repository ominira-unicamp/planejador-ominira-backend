import "dotenv/config";

const { initializeTelemetry } = await import("./tracing.js");
initializeTelemetry(process.env.OTEL_SERVICE_NAME?.trim() || "pomi-api");
