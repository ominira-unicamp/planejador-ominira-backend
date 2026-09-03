import { context, propagation } from "@opentelemetry/api";
import { spawn } from "node:child_process";

export type ProcessSpec = {
    command: string;
    args: string[];
    cwd: string;
    env: Record<string, string>;
    timeoutMs: number;
    stderrToStdout?: boolean;
    allowedExitCodes?: number[];
};

export type ProcessResult = {
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    durationMs: number;
    timedOut: boolean;
    cancelled: boolean;
};

export async function runProcess(
    spec: ProcessSpec,
    signal?: AbortSignal
): Promise<ProcessResult> {
    return await new Promise<ProcessResult>((resolve, reject) => {
        const startedAt = Date.now();
        const carrier: Record<string, string> = {};
        propagation.inject(context.active(), carrier);
        const env = {
            ...process.env,
            ...spec.env,
            ...Object.fromEntries(
                Object.entries(carrier).map(([key, value]) => [
                    key.toUpperCase().replaceAll("-", "_"),
                    value
                ])
            )
        };
        const child = spawn(spec.command, spec.args, {
            cwd: spec.cwd,
            env,
            stdio: spec.stderrToStdout
                ? ["inherit", "inherit", "pipe"]
                : "inherit",
            shell: false
        });
        if (spec.stderrToStdout)
            child.stderr?.on("data", (chunk: Buffer) => {
                process.stdout.write(chunk);
            });
        let settled = false;
        let timedOut = false;
        let cancelled = false;
        const finish = (result: ProcessResult, error?: Error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            if (signal) signal.removeEventListener("abort", abort);
            if (error) reject(error);
            else resolve(result);
        };
        const abort = () => {
            cancelled = true;
            child.kill("SIGTERM");
        };
        const timeout = setTimeout(() => {
            timedOut = true;
            child.kill("SIGTERM");
            finish(
                {
                    exitCode: null,
                    signal: "SIGTERM",
                    durationMs: Date.now() - startedAt,
                    timedOut,
                    cancelled
                },
                new Error(`Processo excedeu o timeout de ${spec.timeoutMs}ms`)
            );
        }, spec.timeoutMs);
        signal?.addEventListener("abort", abort, { once: true });
        child.once("error", (error) =>
            finish(
                {
                    exitCode: null,
                    signal: null,
                    durationMs: Date.now() - startedAt,
                    timedOut,
                    cancelled
                },
                error
            )
        );
        child.once("exit", (code, reason) => {
            if (code === 0 || spec.allowedExitCodes?.includes(code ?? -1))
                finish({
                    exitCode: code,
                    signal: reason,
                    durationMs: Date.now() - startedAt,
                    timedOut,
                    cancelled
                });
            else
                finish(
                    {
                        exitCode: code,
                        signal: reason,
                        durationMs: Date.now() - startedAt,
                        timedOut,
                        cancelled
                    },
                    new Error(`Processo terminou com ${code ?? reason}`)
                );
        });
    });
}
