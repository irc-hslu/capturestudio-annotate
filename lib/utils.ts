import {type ClassValue, clsx} from "clsx";
import {twMerge} from "tailwind-merge";

/**
 * Merge Tailwind class names intelligently.
 * Usage: cn("p-2", condition && "bg-red-500")
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/** Clamp a number between min and max (inclusive). */
export function clamp(n: number, min: number, max: number) {
    return Math.min(Math.max(n, min), max);
}

/** Mod that always returns a positive remainder (useful for wrap-around indices). */
export function mod(n: number, m: number) {
    return ((n % m) + m) % m;
}

/** Exhaustiveness checking helper for discriminated unions. */
export function assertNever(x: never): never {
    throw new Error(`Unexpected object: ${String(x)}`);
}

/** No-op function. */
export function noop(): void {
    /* noop */
}

/** Generate a short unique id (not cryptographically secure). */
export function uid(prefix = "id"): string {
    return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Simple debounce. Returns a debounced function and a cancel method. */
export function debounce<T extends (...args: any[]) => void>(fn: T, wait = 200) {
    let t: ReturnType<typeof setTimeout> | undefined;
    const debounced = (...args: Parameters<T>) => {
        if (t) clearTimeout(t);
        t = setTimeout(() => fn(...args), wait);
    };
    debounced.cancel = () => {
        if (t) clearTimeout(t);
        t = undefined;
    };
    return debounced as T & { cancel: () => void };
}

/** Simple throttle. Calls at most once per `wait` ms. */
export function throttle<T extends (...args: any[]) => void>(fn: T, wait = 200) {
    let last = 0;
    let pending: ReturnType<typeof setTimeout> | null = null;
    let latestArgs: Parameters<T> | null = null;

    const invoke = () => {
        last = Date.now();
        pending = null;
        if (latestArgs) {
            fn(...latestArgs);
            latestArgs = null;
        }
    };

    return (...args: Parameters<T>) => {
        const now = Date.now();
        const remaining = wait - (now - last);
        latestArgs = args;
        if (remaining <= 0 || remaining > wait) {
            if (pending) {
                clearTimeout(pending);
                pending = null;
            }
            invoke();
        } else if (!pending) {
            pending = setTimeout(invoke, remaining);
        }
    };
}

/** Safely parse JSON with a fallback. */
export function safeJsonParse<T = unknown>(str: string, fallback: T): T {
    try {
        return JSON.parse(str) as T;
    } catch {
        return fallback;
    }
}

/** Convert hex color to rgba string. Accepts #RGB, #RRGGBB. */
export function hexToRgba(hex: string, alpha = 1): string {
    const h = hex.replace("#", "");
    const expand = (c: string) => (c.length === 1 ? c + c : c);
    const r = parseInt(expand(h.substring(0, h.length === 3 ? 1 : 2)), 16);
    const g = parseInt(expand(h.substring(h.length === 3 ? 1 : 2, h.length === 3 ? 2 : 4)), 16);
    const b = parseInt(expand(h.substring(h.length === 3 ? 2 : 4, h.length === 3 ? 3 : 6)), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Create a data URL from a base64 string (no header). */
export function dataUrlFromBase64(base64: string, mime = "image/png") {
    return `data:${mime};base64,${base64}`;
}

/** Create a Blob from a base64 string (no header). */
export async function blobFromBase64(base64: string, mime = "image/png"): Promise<Blob> {
    const byteChars = atob(base64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], {type: mime});
}

/** Tiny range helper. */
export function range(n: number) {
    return Array.from({length: n}, (_, i) => i);
}

/** Check defined (type guard). */
export function isDefined<T>(v: T | undefined | null): v is T {
    return v !== undefined && v !== null;
}