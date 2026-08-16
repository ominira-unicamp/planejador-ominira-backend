import dotenv from "dotenv";
import { resolve } from "node:path";

export function loadInjectionEnv() {
    dotenv.config({
        path: resolve(import.meta.dirname, "../../../", ".env")
    });
}
