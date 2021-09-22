import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity()
export class GameID {

    @PrimaryColumn({default:0})
    gameId: number;
}