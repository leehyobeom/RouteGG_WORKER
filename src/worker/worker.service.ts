import { Body, Injectable, Logger } from '@nestjs/common';
import { Cron, Interval, Timeout } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { log } from 'console';
import * as request from 'request';
import { Repository } from 'typeorm';
import { GameID } from './entities/gameId.entity';
import { Route } from './entities/route.entity';

const BATTLE_TYPE_SOLO = 1; 

class InstanceData{
    gameId = 0;
    gameJson;
    routeId = 0;
    routeJson;
    rank_1st_Json;
    inGame_Character_list: number[];
    too_Many_Request = false;
    constructor(gameId){
        this.gameId = gameId;
    }
};


@Injectable()
export class WorkerService {

  private static errorCount = 0;
  private static gameId = 0;

  constructor(
    @InjectRepository(Route)
    private routeRepository: Repository<Route>,
    @InjectRepository(GameID)
    private gmaeIdRepository: Repository<GameID>,
  ) {
  }


  @Interval(100)
  async analys() {
        WorkerService.gameId = await this.get_game_ID();
        const instanceData = new InstanceData(WorkerService.gameId);

        if(!this.check_Error_Count()) return // error 횟수가 연속 n번 이상이면 n번 이전 부터 다시 분석
        await this.set_game_ID(WorkerService.gameId +1);
        

        // too Many requests면 다시 분석한다.
        do{
            
            if(!await this.check_Data_Exist(instanceData)) continue  //데이터 체크 및 에러 횟수 카운트 -> 5번연속이면 다시 5번째로 다시 돌아가고 다시 0 -> 휴면기 돌입 1시간.
            
            if(!await this.check_BattleType_Solo(instanceData)) continue  // battleType === BATTLETYPE_SOLO 체크
            
            if(!await this.check_Exist_RouteId(instanceData)) continue  //  routeId 체크
    
            if(!await this.check_Route_Data(instanceData)) continue 

           await this.insert_Route(instanceData); // route, characterNum, seson 조회 후 있으면, enemy 업데이트 없으면, 새로 추가

        } while(instanceData.too_Many_Request)
    

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
   check_Data_Exist(instanceData:InstanceData): Promise<boolean>{
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
                    instanceData.gameJson = JSON.parse(body);
                } catch (error) {
                    resolve(false);
                }
                
                if(instanceData.gameJson?.message === "Too Many Requests"){
                    // 다시 요청하기
                    instanceData.too_Many_Request = true;
                    resolve(false);
                }
                
                instanceData.too_Many_Request = false;

                if(instanceData.gameJson?.code===200) {
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

    check_Route_Data(instanceData: InstanceData): Promise<boolean>{
    const thisInstance = this; 
      return new Promise(resolve=>{
         request.get(
            {
                uri: process.env.ETERNAL_API_ROUTE + instanceData.routeId,
                headers:{
                    "x-api-key": process.env.ETERNAL_API_KEY,
                    "accept": "application/json",
                },
            }, 
            function (error, response, body) {
                instanceData.routeJson = JSON.parse(body);

                if(instanceData.routeJson?.message === "Too Many Requests"){
                    console.log("Too Many Requests");
                    instanceData.too_Many_Request = true;
                    resolve(false);
                }
                instanceData.too_Many_Request = false;
                if(instanceData.routeJson?.code===200) {
                    resolve(true)
                }else{
                    resolve(false);
                }
            });
    });

    }   
  check_BattleType_Solo(instanceData:InstanceData){ 
      if(!instanceData.gameJson) {
          console.log("WorkerService.gameJson: ",instanceData.gameJson);
          console.log("WorkerService.gameJson?.userGames[0].matchingTeamMode === BATTLE_TYPE_SOLO", instanceData.gameJson?.userGames[0].matchingTeamMode === BATTLE_TYPE_SOLO);
      }
    return instanceData.gameJson?.userGames[0].matchingTeamMode === BATTLE_TYPE_SOLO
  }
  async find_Rank_1st(instanceData: InstanceData){
    instanceData.rank_1st_Json = await instanceData.gameJson?.userGames.find(element => element.gameRank === 1);
    return instanceData.rank_1st_Json
  }
  async get_InGame_Character_List(instanceData: InstanceData) {
    const characterList = await instanceData.gameJson?.userGames.filter(element => element.gameRank !== 1).map(element => +element.characterNum);
    const result = new Array(100);
    result.fill(0);

    await characterList.forEach(element => {
        result[element] = result[element] + 1
    });
    instanceData.inGame_Character_list = result;
    return instanceData.inGame_Character_list
  }
  async check_Exist_RouteId(instanceData: InstanceData){
    instanceData.routeId = (await this.find_Rank_1st(instanceData))?.routeIdOfStart;
    if(!instanceData.routeId){
        return false
    }else if(instanceData.routeId < 1){
        return false
    }else{
        return true
    }
  }

  async insert_Route(instanceData: InstanceData){

    await this.get_InGame_Character_List(instanceData);

    const insertDTO = this.make_Route_DTO(instanceData);

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

  make_Route_DTO(instanceData: InstanceData){
    
    const insertRoute = new Route();
    insertRoute.route = instanceData.routeJson?.result?.recommendWeaponRoute?.paths;
    insertRoute.character = instanceData.rank_1st_Json?.characterNum;
    insertRoute.season = instanceData.rank_1st_Json?.seasonId;
    insertRoute.routeId = instanceData.rank_1st_Json?.routeIdOfStart;
    insertRoute.enemy_character_count = instanceData.inGame_Character_list;
    insertRoute.count = 1;
    insertRoute.likeScore = instanceData.routeJson?.result?.recommendWeaponRoute?.likeScore;    
    // console.log(WorkerService.gameId);
    // console.log(insertRoute);
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
