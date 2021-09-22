import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";


@Entity()
export class Route {

    @PrimaryGeneratedColumn()
    id: number;
    
    @Column()
    route: string;
    
    @Column()
    character: number;   
    
    @Column()
    season: number;   
    
    @Column()
    routeId : number;
    
    @Column("int", { array: true })
    enemy_character_count: number[]; 
    
    @Column()
    count: number;

    @Column()
    likeScore: number;
}