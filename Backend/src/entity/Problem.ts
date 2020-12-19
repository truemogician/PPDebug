import { Column, Entity, JoinTable, ManyToMany, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm"
import { ProblemComment } from "./Comment"
import { ProblemRevision } from "./Revision"
import { Source } from "./Source"
import { Tag } from "./Tag"
import { User } from "./User"

@Entity()
export class Problem {
    @PrimaryGeneratedColumn()
    id: number

    @Column("tinytext")
    title: string

    @Column("mediumtext")
    description: string

    @ManyToMany(type => Tag, tag => tag.problems, {
        cascade: ["insert"],
        eager: true
    })
    @JoinTable({name:"problem_tags"})
    tags?: Tag[]

    @Column({ default: 0 })
    voteUp: number

    @Column({ default: 0 })
    voteDown: number

    @ManyToOne(type => User, user => user.problems, {
        nullable: false,
        persistence: false
    })
    readonly author: User

    @ManyToMany(type => User, user => user.contributedProblems, {
        persistence: false
    })
    readonly contributors?: User[]

    @OneToMany(type => Source, source => source.problem, {
        cascade: true
    })
    sources?: Source[]

    @OneToMany(type => ProblemComment, comment => comment.problem)
    comments?: ProblemComment[]

    @OneToMany(type => ProblemRevision, revision => revision.target, {
        persistence: false
    })
    readonly revisions?: ProblemRevision[]
}