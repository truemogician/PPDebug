import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm"
import { User } from "./User";

export enum LogType {
    Register, Close, Login, Logout, Modify, Donate,
    Judge, Create, Revise, Response, Delete, Vote, Comment,
    Suspend, Terminate, Administrate
}

@Entity()
export class Log {
    @PrimaryGeneratedColumn({type:"bigint"})
    id: string;

    @Column({ type:"longtext", nullable: true })
    detail?: string;

    @ManyToOne(type => User, user => user.logs, {
        nullable: false,
        cascade: true,
        persistence:false,
    })
    readonly user: User;

    @Column({ type: "enum", enum: LogType })
    type: LogType;

    @CreateDateColumn()
    date: Date;
}