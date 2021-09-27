import { Body, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { log } from 'console';
import * as request from 'request';
import { Repository } from 'typeorm';
import { GameID } from './entities/gameId.entity';
import { Route } from './entities/route.entity';

const BATTLE_TYPE_SOLO = 1; 
const DATA_EXIST = 1; 
const DATA_NOT_EXIST = 2; 
const DATA_TOO_MANY_REQUEST = 3; 

@Injectable()
export class WorkerService {

  private static errorCount = 0;
  private static gameId = 14;
  private static gameJson;
  private static routeId = 0;
  private static routeJson;
  private static rank_1st_Json;
  private static inGame_Character_list: number[];


  constructor(
    @InjectRepository(Route)
    private routeRepository: Repository<Route>,
    @InjectRepository(GameID)
    private gmaeIdRepository: Repository<GameID>,
  ) {

  }

  @Cron(CronExpression.EVERY_SECOND)
  async analys() {
        
        if(!this.check_Error_Count()) return //api가 n번 연속이면 다시 gameId - n 부터 다시 조회 시작. ( n = ERROR_TIME_NUM)
        
        WorkerService.gameId = await this.get_game_ID();
        
        await this.set_game_ID(WorkerService.gameId +1);

        if(!await this.check_Data_Exist()) return //데이터 체크 및 에러 횟수 카운트 -> 5번연속이면 다시 5번째로 다시 돌아가고 다시 0 -> 휴면기 돌입 1시간.
        
        if(!await this.check_BattleType_Solo()) return // battleType === BATTLETYPE_SOLO 체크
        
        if(!await this.check_Exist_RouteId()) return //  routeId 체크

        if(!await this.check_Route_Data()) return

       await this.insert_Route(); // route, characterNum, seson 조회 후 있으면, enemy 업데이트 없으면, 새로 추가

  }

  check_Error_Count(){
    if(WorkerService.errorCount  >= +process.env.ERROR_TIME_NUM){
        WorkerService.errorCount = 0;
        WorkerService.gameId = WorkerService.gameId - (+process.env.ERROR_TIME_NUM + 1);        
        this.set_game_ID(WorkerService.gameId);
        return false;
    }
        return true;
  }
   check_Data_Exist(): Promise<boolean>{
    const thisInstance = this; 
    return  new Promise(resolve=>{
        request.get(
            {
                uri: process.env.ETERNAL_API_GAME + WorkerService.gameId +"?ad=0",
                headers:{
                    "x-api-key": process.env.ETERNAL_API_KEY,
                    "accept": "application/json",
                },
            }, 
            function (error, response, body) {
                try {
                    WorkerService.gameJson = JSON.parse(body);
                } catch (error) {
                    resolve(false);
                }
                
                if(WorkerService.gameJson?.message === "Too Many Requests"){
                    // 다시 요청하기
                    thisInstance.set_game_ID(WorkerService.gameId - 1);
                    resolve(false);
                }
                
                if(WorkerService.gameJson?.code===200) {
                    // 성공
                    WorkerService.errorCount = 0;
                    resolve(true)
                }else{
                    WorkerService.errorCount++;
                    resolve(false);
                }
            });
    });
    }   

    check_Route_Data(): Promise<boolean>{
    const thisInstance = this; 
      return new Promise(resolve=>{
         request.get(
            {
                uri: process.env.ETERNAL_API_ROUTE + WorkerService.routeId,
                headers:{
                    "x-api-key": process.env.ETERNAL_API_KEY,
                    "accept": "application/json",
                },
            }, 
            function (error, response, body) {
                WorkerService.routeJson = JSON.parse(body);

                if(WorkerService.routeJson?.message === "Too Many Requests"){
                    thisInstance.set_game_ID(WorkerService.gameId - 1);
                    resolve(false);
                }
                if(WorkerService.routeJson?.code===200) {
                    resolve(true)
                }else{
                    resolve(false);
                }
            });
    });

    }   
  check_BattleType_Solo(){      
    return WorkerService.gameJson?.userGames[0].matchingTeamMode === BATTLE_TYPE_SOLO
  }
  async find_Rank_1st(){
    WorkerService.rank_1st_Json = await WorkerService.gameJson?.userGames.find(element => element.gameRank === 1);
    return WorkerService.rank_1st_Json
  }
  async get_InGame_Character_List() {
    const characterList = await WorkerService.gameJson?.userGames.filter(element => element.gameRank !== 1).map(element => +element.characterNum);
    const result = new Array(100);
    result.fill(0);

    await characterList.forEach(element => {
        result[element] = result[element] + 1
    });
    WorkerService.inGame_Character_list = result;
    return WorkerService.inGame_Character_list
  }
  async check_Exist_RouteId(){
    WorkerService.routeId = (await this.find_Rank_1st())?.routeIdOfStart;
    if(!WorkerService.routeId){
        return false
    }else if(WorkerService.routeId < 1){
        return false
    }else{
        return true
    }
  }

  async insert_Route(){

    await this.get_InGame_Character_List();

    const insertDTO = this.make_Route_DTO();

    const route = await this.routeRepository.findOne({
        route: insertDTO.route,
        season: insertDTO.season,
        character: insertDTO.character,
    });
    if(route){
        const liekScore = (route.likeScore > insertDTO.likeScore);
        route.likeScore = liekScore ? route.likeScore : insertDTO.likeScore;
        route.routeId = liekScore ? route.routeId : insertDTO.routeId;
        route.count = route.count + 1;
        route.enemy_character_count = route.enemy_character_count.map((e,i):number=>{return e + insertDTO.enemy_character_count[i]})
        await this.routeRepository.update({ id: route.id },route);
        
    }else{
        await this.routeRepository.save(this.routeRepository.create(insertDTO));
    }
  }

  make_Route_DTO(){
    
    const insertRoute = new Route();
    insertRoute.route = WorkerService.routeJson?.result?.recommendWeaponRoute?.paths;
    insertRoute.character = WorkerService.rank_1st_Json?.characterNum;
    insertRoute.season = WorkerService.rank_1st_Json?.seasonId;
    insertRoute.routeId = WorkerService.rank_1st_Json?.routeIdOfStart;
    insertRoute.enemy_character_count = WorkerService.inGame_Character_list;
    insertRoute.count = 1;
    insertRoute.likeScore = WorkerService.routeJson?.result?.recommendWeaponRoute?.likeScore;    
    console.log(insertRoute);
    return insertRoute;
  }

  async set_game_ID(gameID){
    WorkerService.gameId = gameID;
    const game = await this.gmaeIdRepository.findOne({id:1});
    if(!game){
        await this.gmaeIdRepository.save(this.gmaeIdRepository.create({id:1,gameId:10000000}));
        return;
    }else{
        await this.gmaeIdRepository.update({id:1}, {gameId: gameID});
    }
    
  }

  async get_game_ID(): Promise<number>{
      
    const gameId = (await this.gmaeIdRepository.findOne({id:1}));

    if(!gameId){
        return (await this.gmaeIdRepository.save(this.gmaeIdRepository.create({id:1, gameId:10000000}))).gameId;
    }else{
        return gameId.gameId;
    }
  }
}
