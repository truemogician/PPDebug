import { Column, Entity, JoinTable, ManyToMany, ManyToOne, PrimaryGeneratedColumn } from "typeorm"
import { Code } from "./Code"
import { Problem } from "./Problem"
import { Tag } from "./Tag"

@Entity()
export class ProblemRevision {
    @PrimaryGeneratedColumn()
    id: number

    @ManyToOne(type => Problem, problem => problem.revisions, {
        nullable: false,
    })
    target: Problem

    @Column({ nullable: true })
    description?: string

    @ManyToMany(type => Tag, tag => tag.problemRevisions, {
        persistence: false,
        eager: true
    })
    @JoinTable({name:"problem_revision_tags"})
    readonly tags?: Tag[]
}

@Entity()
export class CodeRevision {
    @PrimaryGeneratedColumn()
    id: number

    @ManyToOne(type => Code, code => code.revisions, {
        nullable: false,
    })
    target: Code

    @Column()
    code: string
}