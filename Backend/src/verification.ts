import clone = require('lodash.clonedeep');
export function hasKeys(dst: object, ...keys: string[]): boolean {
    const existedKeys = Object.keys(dst);
    for (const key of keys) {
        if (!existedKeys.includes(key))
            return false;
    }
    return true;
}
type TypeConstraint = [string, Function, boolean?];
type PartialTypeConstraint = [string, boolean?];
export function hasKeysWithTypes(dst: object, ...keysAndTypes: TypeConstraint[]): boolean;
export function hasKeysWithTypes(dst: object, type: Function, ...keys: (PartialTypeConstraint | string)[]): boolean;
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
                const key = params[i] as PartialTypeConstraint;
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
export type LengthConstraint = [number, number?];
export type Constraint = Function | boolean | RegExp | LengthConstraint;
export type KeyConstraint = [string, ...Constraint[]];
class Restraint {
    type: Function = String
    nullable?: boolean
    length?: LengthConstraint
    pattern?: RegExp
    assign(pConstraint: Constraint): void {
        if (!pConstraint)
            return;
        if (typeof pConstraint == "boolean")
            this.nullable = pConstraint;
        else if (pConstraint instanceof RegExp)
            this.pattern = pConstraint;
        else if (pConstraint instanceof Function)
            this.type = pConstraint;
        else
            this.length = pConstraint;
    }
}
export enum FailureReason {
    Type = "wrong type",
    Omitted = "omitted",
    Syntax = "syntax not matching pattern",
    Long = "upper length limit exceeded",
    Short = "lower length limit exceeded",
    Redundant = "redundant"
}
export function satisfyConstraints(obj: object, ...constraints: KeyConstraint[]): boolean | [string, FailureReason] {
    const keys = Object.keys(obj);
    const constraintKeys = new Array<string>();
    for (const constraint of constraints) {
        constraintKeys.push(constraint[0]);
        const restraint: Restraint = new Restraint();
        restraint.assign(constraint[1]);
        restraint.assign(constraint[2]);
        restraint.assign(constraint[3]);
        restraint.assign(constraint[4]);
        if (keys.includes(constraint[0])) {
            if (obj[constraint[0]].constructor != restraint.type)
                return [constraint[0],FailureReason.Type];
            else if (restraint.pattern && !restraint.pattern.test(typeof obj[constraint[0]] == "string" ? obj[constraint[0]] : obj[constraint[0]].toString()))
                return [constraint[0],FailureReason.Syntax];
            else if (restraint.length) {
                if (typeof obj[constraint[0]] == "string") {
                    if (obj[constraint[0]].length < restraint.length[0])
                        return [constraint[0],FailureReason.Short];
                    else if (restraint.length[1] && obj[constraint[0]].length > restraint.length[1])
                        return [constraint[0],FailureReason.Long];
                }
                else {
                    const str = obj[constraint[0]].toString();
                    if (str.length < restraint.length[0])
                        return [constraint[0],FailureReason.Short];
                    else if (restraint.length[1] && str.length > restraint.length[1])
                        return [constraint[0],FailureReason.Long];
                }
            }
        }
        else if (!restraint.nullable)
            return [constraint[0],FailureReason.Omitted];
    }
    for (const key of keys)
        if (!constraintKeys.includes(key))
            return [key,FailureReason.Redundant];
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
        if (!dstKeys.includes(key) || !typeSafe || !dst[key]?.constructor != target[key].constructor)
            dst[key] = clone(target[key]);
    }
}