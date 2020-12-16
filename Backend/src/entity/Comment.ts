import { Column, Entity, JoinTable, ManyToMany, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm"
import { Problem } from "./Problem"
import { Source } from "./Source"
import { User } from "./User"

abstract class Comment {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    content: string

    @Column({ default: 0 })
    voteUp: number

    @Column({ default: 0 })
    voteDown: number
}

@Entity()
export class ProblemComment extends Comment {
    @ManyToOne(type => Problem, problem => problem.comments, {
        nullable: false,
        persistence: false,
    })
    readonly problem: Problem

    @ManyToOne(type => User, user => user.problemComments, {
        nullable: false,
        persistence: false,
    })
    readonly reviewer: User

    @ManyToMany(type=>User,user=>user.problemReminders,{
        persistence:false
    })
    @JoinTable({name:"problem_reminder"})
    readonly remindees?: User[];
}

@Entity()
export class SourceComment extends Comment {
    @ManyToOne(type => Source, source => source.comments, {
        nullable: false,
        persistence: false,
    })
    readonly source: Source

    @ManyToOne(type => User, user => user.sourceComments, {
        nullable: false,
        persistence: false,
    })
    readonly reviewer: User

    @ManyToMany(type=>User,user=>user.sourceReminders,{
        persistence:false
    })
    @JoinTable({name:"source_reminder"})
    readonly remindees?: User[];
}