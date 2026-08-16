import { spawn } from "node:child_process";

export type ProcessSpec = {
    command: string;
    args: string[];
    cwd: string;
    env: Record<string, string>;
    timeoutMs: number;
    stderrToStdout?: boolean;
};

export async function runProcess(
    spec: ProcessSpec,
    signal?: AbortSignal
): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const child = spawn(spec.command, spec.args, {
            cwd: spec.cwd,
            env: { ...process.env, ...spec.env },
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
        const finish = (error?: Error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            if (signal) signal.removeEventListener("abort", abort);
            if (error) reject(error);
            else resolve();
        };
        const abort = () => child.kill("SIGTERM");
        const timeout = setTimeout(() => {
            child.kill("SIGTERM");
            finish(
                new Error(`Processo excedeu o timeout de ${spec.timeoutMs}ms`)
            );
        }, spec.timeoutMs);
        signal?.addEventListener("abort", abort, { once: true });
        child.once("error", (error) => finish(error));
        child.once("exit", (code, reason) => {
            if (code === 0) finish();
            else finish(new Error(`Processo terminou com ${code ?? reason}`));
        });
    });
}
