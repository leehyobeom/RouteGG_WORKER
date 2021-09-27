import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class GameID {

    @PrimaryColumn()
    id: number;

    @Column()
    gameId: number;
}