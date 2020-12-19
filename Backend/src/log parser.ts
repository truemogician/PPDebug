import { LogType } from "./entity/Log"
export namespace LogDetail {
    export interface Login {
        failReason?: string
    }
    export interface ModifyPair {
        key: string
        oldValue?: any
    }
    export interface Modify {
        pairs?: ModifyPair[];
    }
    export enum PaymentMethod {
        Alipay, WeChatPay
    }
    export interface Donate {
        amount: number
        paymentMethod: PaymentMethod
    }
    export interface Judge {
        id: number
    }
    export enum Target {
        Problem, Code
    }
    export enum VoteTarget {
        Problem, Code, Comment
    }
    interface Action<T = Target> {
        target: T
        id: number
    }
    export interface Create extends Action { }
    export interface Revise extends Action {
        revisionId: number
    }
    export interface Response extends Revise {
        useful: boolean
        applied: boolean
    }
    export interface Delete extends Action {
        title?: string
    }
    export interface Vote extends Action<VoteTarget> {
        up: boolean
    }
    export interface Comment extends Action {
        commnetId: number
        action: "post" | "edit" | "delete"
    }
    export interface Suspend {
        releaseDate: Date
        reason: string
    }
    export interface Terminate {
        reason: string
    }
}
export class LogParser {
}