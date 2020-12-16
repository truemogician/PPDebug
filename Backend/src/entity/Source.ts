import { Column, Entity, JoinColumn, ManyToMany, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm"
import { Code } from "./Code"
import { SourceComment } from "./Comment"
import { Judgement } from "./Judgement"
import { Problem } from "./Problem"

export enum SourceType {
    Datamaker, StandardProgram, JudgedProgram, SpecialJudger
}
export enum SourceLanguage {
    C, Cpp
}

@Entity()
export class Source {
    @PrimaryGeneratedColumn()
    id: number

    @Column({ type: "enum", enum: SourceType })
    type: SourceType

    @Column({ type: "enum", enum: SourceLanguage })
    language: SourceLanguage

    @Column({ nullable: true })
    languageStandard?: string

    @Column()
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

    @ManyToOne(type => Problem, problem => problem.sources, {
        persistence: false,
    })
    readonly problem?: Problem

    @ManyToMany(type => Judgement, judgement => judgement.sources, {
        persistence: false,
    })
    readonly judgements?: Judgement[]
}