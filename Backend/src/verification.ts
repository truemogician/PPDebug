import clone = require('lodash.clonedeep');
export function hasKeys(dst: object, ...keys: string[]): boolean {
    const existedKeys = Object.keys(dst);
    for (const key of keys) {
        if (!existedKeys.includes(key))
            return false;
    }
    return true;
}
type FullConstraint = [string, Function, boolean?];
type PartialConstraint = [string, boolean?];
export function hasKeysWithTypes(dst: object, ...keysAndTypes: FullConstraint[]): boolean;
export function hasKeysWithTypes(dst: object, type: Function, ...keys: (PartialConstraint | string)[]): boolean;
export function hasKeysWithTypes(dst: object, ...params: any[]): boolean {
    const existedKeys = Object.keys(dst);
    if (params[0] instanceof Function) {
        const type = params[0] as Function;
        for (let i = 1; i < params.length; ++i) {
            if (typeof params[i] == "string") {
                if (!existedKeys.includes(params[i]) || dst[params[i]].constructor != type)
                    return false;
            }
            else {
                const key = params[i] as PartialConstraint;
                if (existedKeys.includes(key[0])) {
                    if (dst[key[0]].constructor != type)
                        return false;
                }
                else if (!params[1])
                    return false;
            }
        }
        return true;
    }
    else {
        for (const keyAndType of params) {
            if (existedKeys.includes(keyAndType[0])) {
                if (dst[keyAndType[0]].constructor != keyAndType[1])
                    return false;
            }
            else if (!params[2])
                return false;
        }
        return true;
    }
}
export type Constraint = [string, Function, (boolean | RegExp)?, RegExp?];
export function satisfyConstraints(obj: object, ...constraints: Constraint[]) {
    const keys = Object.keys(obj);
    for (const constraint of constraints) {
        if (keys.includes(constraint[0])) {
            const value = obj[constraint[0]];
            if (value.constructor != constraint[1])
                return false;
            else if (constraint[2]) {
                if (constraint[2] instanceof RegExp &&
                    !constraint[2].test(typeof value == "string" ? value : value.toString()))
                    return false;
                else if (constraint[3] &&
                    !constraint[3].test(typeof value == "string" ? value : value.toString()))
                    return false;
            }
        }
        else if (constraint[2] !== true)
            return false;
    }
    return true;
}
export function leftJoin(dst: object, target: object, typeSafe = true): void {
    const dstKeys = Object.keys(dst);
    const srcKeys = Object.keys(target);
    for (const key of dstKeys) {
        if (srcKeys.includes(key) && (!typeSafe || dst[key].constructor == target[key].constructor))
            dst[key] = clone(target[key]);
    }
}
export function rightJoin(dst: object, target: object, typeSafe = true): void {
    const dstKeys = Object.keys(dst);
    const srcKeys = Object.keys(target);
    for (const key of srcKeys) {
        if (!dstKeys.includes(key) || !typeSafe || dst[key].constructor == target[key].constructor)
            dst[key] = clone(target[key]);
    }
}