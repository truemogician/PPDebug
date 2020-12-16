import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, ManyToMany } from "typeorm";
import { SourceComment, ProblemComment } from "./Comment";
import { Judgement } from "./Judgement";
import { Log } from "./Log"
import { Problem } from "./Problem";
import { Tag } from "./Tag";

export enum Gender {
    Male, Female, Other, Secret
}

@Entity()
export class User {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({length:32})
    username: string;

    @Column({length:32})
    password: string;

    @Column({ default: false })
    administrator: boolean;

    @Column({ length:64,unique: true })
    email: string;

    @Column({ nullable: true })
    avator?: string;

    @Column({ nullable: true })
    phone?: number;

    @Column({ length:12, nullable: true })
    qq?: string;

    @Column({ type: "enum", enum: Gender, default: Gender.Secret })
    gender: Gender;

    @Column({ default: 1 })
    reputation: number;

    @CreateDateColumn()
    joinDate: Date;

    @Column({ nullable: true })
    dropDate?: Date;

    @OneToMany(type => Log, log => log.user, {
        persistence: false,
    })
    readonly logs?: Log[];

    @OneToMany(type => Judgement, judgement => judgement.user, {
        persistence: false
    })
    readonly judgements?: Judgement[]

    @OneToMany(type => Problem, problem => problem.creator, {
        persistence: false,
    })
    readonly createdProblems?: Problem[]

    @ManyToMany(type => Problem, problem => problem.contributors, {
        persistence: false
    })
    readonly contributedProblems?: Problem[]

    @OneToMany(type => Tag, tag => tag.creator, {
        persistence: false
    })
    readonly createdTags?: Tag[]

    @OneToMany(type => ProblemComment, comment => comment.reviewer, {
        persistence: false
    })
    readonly problemComments?: ProblemComment[]

    @OneToMany(type => SourceComment, comment => comment.reviewer, {
        persistence: false
    })
    readonly sourceComments?: SourceComment[]

    @OneToMany(type => ProblemComment, comment=>comment.remindees, {
        persistence: false
    })
    readonly problemReminders?: ProblemComment[]

    @OneToMany(type => SourceComment, comment=>comment.remindees, {
        persistence: false
    })
    readonly sourceReminders?: ProblemComment[]
}