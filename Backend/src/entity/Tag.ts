import {Column, Entity, ManyToMany, ManyToOne, PrimaryColumn, PrimaryGeneratedColumn} from "typeorm"
import { Problem } from "./Problem"
import { ProblemRevision } from "./Revision"
import { User } from "./User"

@Entity()
export class Tag{
    @PrimaryColumn({type:"varchar",length:16})
    name:string

    @Column({type:"tinytext", nullable:true})
    discription?:string

    @ManyToOne(type=>User,user=>user.createdTags,{
        nullable:false,
        persistence:false
    })
    readonly creator:User

    @ManyToMany(type=>Problem,problem=>problem.tags,{
        persistence:false
    })
    readonly problems?:Problem[]

    @ManyToMany(type=>ProblemRevision,revision=>revision.tags,{
        persistence:false
    })
    readonly problemRevisions?:ProblemRevision[]
}