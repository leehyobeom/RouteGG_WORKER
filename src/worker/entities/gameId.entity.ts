import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class GameID {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    gameId: number;
}