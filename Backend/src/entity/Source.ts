import { Column, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm"
import { Code } from "./Code"
import { SourceComment } from "./Comment"
import { Judgement } from "./Judgement"
import { Language } from "./Language"
import { Problem } from "./Problem"
import { SourceRevision } from "./Revision"
import { User } from "./User"

export enum SourceType {
    Datamaker = "Datamaker",
    Standard = "Standard",
    Judged = "Judged",
    Judger = "Judger"
}

@Entity()
export class Source {
    @PrimaryGeneratedColumn()
    id: number

    @Column({ type: "enum", enum: SourceType })
    type: SourceType

    @ManyToOne(type=>Language,language=>language.sources,{
        nullable:false,
        eager:true,
        persistence:false
    })
    language:Language

    @Column({ type: "tinytext", nullable: true })
    languageStandard?: string

    @Column("tinytext")
    compiler: string

    @Column({ default: 0 })
    voteUp: number

    @Column({ default: 0 })
    voteDown: number

    @OneToOne(type => Code, code => code.source, {
        nullable: false,
        cascade: true,
    })
    code: Code

    @OneToMany(type => SourceComment, comment => comment.source)
    comments?: SourceComment[]

    @OneToMany(type => SourceRevision, revision => revision.target, {
        persistence: false
    })
    readonly revisions?: SourceRevision[]

    @ManyToOne(type => User, user => user.sources, {
        nullable: false,
        persistence: false
    })
    author: User

    @ManyToMany(type => User, user => user.contributedSources, {
        persistence: false
    })
    @JoinTable({name:"problem_contributor"})
    readonly contributors?: User[]

    @ManyToOne(type => Problem, problem => problem.sources, {
        persistence: false,
    })
    problem?: Problem

    @ManyToMany(type => Judgement, judgement => judgement.sources, {
        persistence: false,
    })
    readonly judgements?: Judgement[]
}