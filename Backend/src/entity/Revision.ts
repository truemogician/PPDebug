import { Column, Entity, JoinTable, ManyToMany, ManyToOne, PrimaryGeneratedColumn } from "typeorm"
import { Code } from "./Code"
import { Problem } from "./Problem"
import { Source } from "./Source"
import { Tag } from "./Tag"

@Entity()
export class ProblemRevision {
    @PrimaryGeneratedColumn()
    id: number

    @ManyToOne(type => Problem, problem => problem.revisions, {
        nullable: false,
    })
    target: Problem

    @Column({ type:"mediumtext", nullable: true })
    description?: string

    @ManyToMany(type => Tag, tag => tag.problemRevisions, {
        persistence: false,
        eager: true
    })
    @JoinTable({name:"problem_revision_tags"})
    readonly tags?: Tag[]
}

@Entity()
export class SourceRevision {
    @PrimaryGeneratedColumn()
    id: number

    @ManyToOne(type => Source, source => source.revisions, {
        nullable: false,
    })
    target: Source

    @Column("mediumtext")
    code: string
}