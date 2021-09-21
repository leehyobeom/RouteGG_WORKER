import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";


@Entity()
export class Route {

    @PrimaryGeneratedColumn()
    index: number;
    
    @Column()
    route: string;
    
    @Column()
    character: number;   
    
    @Column()
    seson: number;   
    
    @Column()
    routeId : number;
    
    @Column("int", { array: true })
    enemy_character: number[]; 
    
    @Column()
    count: number;
}