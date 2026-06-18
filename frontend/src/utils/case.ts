/**
 * Utility: Check if a value is a "plain" JavaScript object.
 * 
 * Excludes special objects (Date, File, Blob, FormData, Map, Set) to prevent
 * unexpected key transformations during deep recursion. This ensures only
 * JSON-like objects are transformed.
 */
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    !!value &&
    Object.prototype.toString.call(value) === "[object Object]" &&
    !(value instanceof Date) &&
    !(value instanceof File) &&
    !(value instanceof Blob) &&
    !(value instanceof FormData) &&
    !(value instanceof Map) &&
    !(value instanceof Set);

/**
 * Convert snake_case or kebab-case string to camelCase.
 * 
 * Example: "first_name" → "firstName"
 */
export const toCamel = (key: string) =>
    key.replace(/[_-](\w)/g, (_: string, c: string) => c.toUpperCase());

/**
 * Convert camelCase string to snake_case.
 * 
 * Example: "firstName" → "first_name"
 */
export const toSnake = (key: string) =>
    key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

/**
 * Deeply convert all object keys to camelCase.
 *
 * - Recursively walks through objects and arrays.
 * - Safely handles circular references using WeakMap.
 * - Returns a new object without mutating the input.
 */
const camelizeKeysInternal = (
    input: unknown,
    seen: WeakMap<object, unknown>,
): unknown => {
    if (Array.isArray(input)) {
        return input.map((item) => camelizeKeysInternal(item, seen));
    }

    if (!isPlainObject(input)) return input;

    // Handle circular references
    if (seen.has(input)) return seen.get(input as object);

    const result: Record<string, unknown> = {};
    seen.set(input as object, result);

    for (const [key, value] of Object.entries(input)) {
        result[toCamel(key)] = camelizeKeysInternal(value, seen);
    }

    return result;
};

export const camelizeKeys = <T>(input: T): T =>
    camelizeKeysInternal(input, new WeakMap()) as T;

/**
 * Deeply convert all object keys to snake_case.
 *
 * - Recursively walks through objects and arrays.
 * - Safely handles circular references using WeakMap.
 * - Returns a new object without mutating the input.
 */
const snakifyKeysInternal = (
    input: unknown,
    seen: WeakMap<object, unknown>,
): unknown => {
    if (Array.isArray(input)) {
        return input.map((item) => snakifyKeysInternal(item, seen));
    }

    if (!isPlainObject(input)) return input;

    // Handle circular references
    if (seen.has(input)) return seen.get(input as object);

    const result: Record<string, unknown> = {};
    seen.set(input as object, result);

    for (const [key, value] of Object.entries(input)) {
        result[toSnake(key)] = snakifyKeysInternal(value, seen);
    }

    return result;
};

export const snakifyKeys = <T>(input: T): T =>
    snakifyKeysInternal(input, new WeakMap()) as T;

/**
 * Check whether a value should be transformed.
 * 
 * Used by interceptors to decide when to convert API payloads.
 */
export const shouldTransform = (value: unknown) =>
    value !== null &&
    value !== undefined &&
    !Array.isArray(value) &&
    isPlainObject(value);
    
