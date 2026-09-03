import { metrics, SpanStatusCode, trace } from "@opentelemetry/api";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { RuntimeNodeInstrumentation } from "@opentelemetry/instrumentation-runtime-node";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
    MeterProvider,
    PeriodicExportingMetricReader
} from "@opentelemetry/sdk-metrics";
import {
    BatchSpanProcessor,
    ParentBasedSampler,
    TraceIdRatioBasedSampler
} from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import {
    ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
    ATTR_SERVICE_NAME,
    ATTR_SERVICE_VERSION
} from "@opentelemetry/semantic-conventions";
import { PrismaInstrumentation } from "@prisma/instrumentation";

export let tracerProvider: NodeTracerProvider | undefined;
export let meterProvider: MeterProvider | undefined;

export type TraceOptions<Args extends unknown[] = unknown[]> = Readonly<{
    attributes?: Record<string, string | number | boolean>;
    extractAttributes?: (
        ...args: Args
    ) => Record<string, string | number | boolean>;
    tracerName?: string;
}>;

let initialized = false;

export function initializeTelemetry(serviceName: string) {
    if (initialized) return;
    initialized = true;

    const tracesEndpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
    const metricsEndpoint = process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT;
    if (!tracesEndpoint && !metricsEndpoint) return;

    const resource = resourceFromAttributes({
        [ATTR_SERVICE_NAME]: serviceName,
        [ATTR_SERVICE_VERSION]: process.env.SERVICE_VERSION ?? "unknown",
        [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]:
            process.env.DEPLOYMENT_ENVIRONMENT_NAME ??
            process.env.NODE_ENV ??
            "development",
        "cloud.provider": process.env.CLOUD_PROVIDER ?? "aws",
        "cloud.region": process.env.AWS_REGION ?? "sa-east-1"
    });

    if (tracesEndpoint) {
        tracerProvider = new NodeTracerProvider({
            resource,
            sampler: new ParentBasedSampler({
                root: new TraceIdRatioBasedSampler(
                    parseTraceSampleRatio(process.env.OTEL_TRACE_SAMPLE_RATIO)
                )
            }),
            spanProcessors: [
                new BatchSpanProcessor(
                    new OTLPTraceExporter({
                        url: tracesEndpoint,
                        headers: parseHeaders(
                            process.env.OTEL_EXPORTER_OTLP_HEADERS
                        ),
                        timeoutMillis: 5_000
                    })
                )
            ]
        });
        tracerProvider.register();
    }

    if (metricsEndpoint) {
        meterProvider = new MeterProvider({
            resource,
            readers: [
                new PeriodicExportingMetricReader({
                    exporter: new OTLPMetricExporter({
                        url: metricsEndpoint,
                        headers: parseHeaders(
                            process.env.OTEL_EXPORTER_OTLP_HEADERS
                        ),
                        timeoutMillis: 5_000
                    }),
                    exportIntervalMillis: 15_000
                })
            ]
        });
        metrics.setGlobalMeterProvider(meterProvider);
        registerAvailabilityMetrics(meterProvider);
    }

    registerInstrumentations({
        tracerProvider,
        meterProvider,
        instrumentations: [
            new HttpInstrumentation(),
            new ExpressInstrumentation(),
            new PrismaInstrumentation(),
            new RuntimeNodeInstrumentation({ monitoringPrecision: 5_000 }),
            new UndiciInstrumentation()
        ]
    });
}

export async function shutdownTelemetry() {
    await Promise.allSettled([
        tracerProvider?.shutdown(),
        meterProvider?.shutdown()
    ]);
}

export function parseTraceSampleRatio(value: string | undefined) {
    const parsed = Number(value ?? "1");
    return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 1;
}

export function withTrace<Args extends unknown[], Result>(
    spanName: string,
    operation: (...args: Args) => Promise<Result> | Result,
    options: TraceOptions<Args> = {}
) {
    return async (...args: Args): Promise<Result> => {
        const tracer = trace.getTracer(options.tracerName ?? "pomi-api-core");
        return tracer.startActiveSpan(spanName, async (span) => {
            try {
                if (options.attributes) span.setAttributes(options.attributes);
                if (options.extractAttributes)
                    span.setAttributes(options.extractAttributes(...args));
                const result = await operation(...args);
                span.setStatus({ code: SpanStatusCode.OK });
                return result;
            } catch (error) {
                const exception =
                    error instanceof Error ? error : new Error(String(error));
                span.recordException(exception);
                span.setStatus({
                    code: SpanStatusCode.ERROR,
                    message: exception.message
                });
                throw error;
            } finally {
                span.end();
            }
        });
    };
}

export function setActiveTraceAttributes(
    attributes: Record<string, string | number | boolean>
) {
    trace.getActiveSpan()?.setAttributes(attributes);
}

function registerAvailabilityMetrics(provider: MeterProvider) {
    const meter = provider.getMeter("pomi-runtime");
    const uptime = meter.createObservableGauge("pomi_process_uptime_seconds", {
        description: "Tempo de atividade do processo em segundos",
        unit: "s"
    });
    uptime.addCallback((result) => result.observe(process.uptime()));

    const up = meter.createObservableGauge("pomi_up", {
        description: "Indica que o processo está em execução"
    });
    up.addCallback((result) => result.observe(1));
}

function parseHeaders(value: string | undefined) {
    return Object.fromEntries(
        (value ?? "").split(",").flatMap((entry) => {
            const separator = entry.indexOf("=");
            return separator < 1
                ? []
                : [[entry.slice(0, separator), entry.slice(separator + 1)]];
        })
    );
}
