import { Column, Entity, JoinTable, ManyToMany, ManyToOne, PrimaryGeneratedColumn } from "typeorm"
import { Source } from "./Source"
import { User } from "./User"

class Configuration {
    @Column({nullable:true})
    datamakerArguments?:string

    @Column({unsigned:true})
    maxTime:number

    @Column({default:false})
    analysis:boolean
}

class Result {
    @Column()
    found:boolean

    @Column({nullable:true})
    data?:string

    @Column({nullable:true})
    analysis?:string
}

@Entity()
export class Judgement {
    @PrimaryGeneratedColumn()
    id: number

    @ManyToOne(type=>User,user=>user.judgements,{
        nullable:false,
        persistence:false,
    })
    readonly user:User

    @ManyToMany(type => Source, source => source.judgements,{
        persistence:false
    })
    @JoinTable({name:"judgement_sources"})
    readonly sources?: Source

    @Column(type => Configuration)
    config: Configuration

    @Column(type => Result)
    result: Result
}