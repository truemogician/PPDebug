import { Column, Entity, OneToMany, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm"
import { Source } from "./Source"

@Entity()
export class Language {
    @PrimaryColumn({ type: "varchar", length: 16 })
    name: string

    @Column("text", { name: "standards", nullable: true })
    _standards?: string

    @Column("text", { name: "compilers" })
    _compilers: string

    @OneToMany(type => Source, source => source.language, {
        persistence: false
    })
    sources?: Source[]

    get standards() { return JSON.parse(this._standards) };
    set standards(value: string[]) { this._standards = JSON.stringify(value) }
    get compilers() { return JSON.parse(this._compilers) };
    set compilers(value: string[]) { this._compilers = JSON.stringify(value) }
}