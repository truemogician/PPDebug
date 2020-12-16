import { Column, Entity, JoinColumn, OneToMany, OneToOne } from "typeorm"
import { CodeRevision } from "./Revision"
import { Source } from "./Source"

@Entity()
export class Code {
    @OneToOne(type => Source, source => source.code, {
        primary: true,
        nullable: false,
        eager: true,
    })
    @JoinColumn()
    source: Source

    @Column()
    code: string

    @OneToMany(type => CodeRevision, revision => revision.target, {
        persistence: false,
    })
    readonly revisions?: CodeRevision[]
}