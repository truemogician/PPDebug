import { Column, Entity, JoinTable, ManyToMany, ManyToOne, PrimaryGeneratedColumn } from "typeorm"
import { Source } from "./Source"
import { User } from "./User"

class Configuration {
    @Column({nullable:true})
    datamakerArguments?:string

    @Column({unsigned:true})
    maxTime:number

    @Column({default:1000})
    timeout:number

    @Column({default:false})
    analysis:boolean
}

class TotalTime{
    @Column({unsigned:true, default:0})
    datamaker: number

    @Column({unsigned:true, default:0})
    standardProgram: number

    @Column({unsigned:true, default:0})
    judgedProgram: number

    @Column({unsigned:true, nullable: true})
    specialJudger?: number
}

class Status{
    @Column()
    startTime:Date

    @Column(type=>TotalTime)
    totalTime:TotalTime

    @Column()
    endTime:Date
}

class Result {
    @Column()
    compiled:boolean

    @Column()
    found:boolean

    @Column({type: "longtext", nullable:true})
    inputData?:string

    @Column({type: "longtext", nullable:true})
    answerData?:string

    @Column({type: "longtext", nullable:true})
    outputData?:string
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

    @Column(type=>Status)
    status: Status

    @Column(type => Result)
    result: Result
}