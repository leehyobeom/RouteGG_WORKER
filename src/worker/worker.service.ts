import { Body, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import * as request from 'request';
import { Repository } from 'typeorm';
import { GameID } from './entities/gameId.entity';
import { Route } from './entities/route.entity';

const BATTLE_TYPE_SOLO = 1; 

@Injectable()
export class WorkerService {

  private static errorCount = 0;
  private static gameId = 14;
  private static tempBodyJson;
   
  constructor(
    @InjectRepository(Route)
    private routeRepository: Repository<Route>,
    @InjectRepository(GameID)
    private gmaeIdRepository: Repository<GameID>,
  ) {}

  @Cron(CronExpression.EVERY_SECOND)
  async analys() {
        
        WorkerService.gameId = await this.get_game_ID();

        if(!await this.check_Data_Exist()) return ; //데이터 체크 및 에러 횟수 카운트 -> 5번연속이면 다시 5번째로 다시 돌아가고 다시 0 -> 휴면기 돌입 1시간.

        if(!this.check_BattleType_Solo()) return; // battleType === BATTLETYPE_SOLO 체크

        if(!this.check_Exist_RouteId()) return; //  routeId 체크

        this.check_Same_Route(); // route, characterNum, seson 조회 후 있으면, enemy 업데이트 없으면, 새로 추가
        this.set_game_ID(WorkerService.gameId++);

  }

  check_Data_Exist(): Promise<boolean>{
    return new Promise(resolve=>{
        request.get(
            {
                uri: process.env.ETERNAL_API_GAME + WorkerService.gameId +"?ad=0",
                headers:{
                    "x-api-key": process.env.ETERNAL_API_KEY,
                    "accept": "application/json",
                },
            }, 
            function (error, response, body) {
                WorkerService.tempBodyJson = JSON.parse(body)                  
                if(WorkerService.tempBodyJson?.code===200) {
                    WorkerService.errorCount++;
                    resolve(true)
                };  
                WorkerService.errorCount = 0;
                resolve(false);
            });
    });
    }   

  check_BattleType_Solo(){      
    return WorkerService.tempBodyJson?.userGames[0].matchingTeamMode === BATTLE_TYPE_SOLO
  }

  find_Rank_1st(){
    return WorkerService.tempBodyJson?.userGames.find(element => element.gameRank ===1)
  }
  check_Exist_RouteId(){
    return this.find_Rank_1st().routeIdOfStart !== 0;
  }
  check_Same_Route(){}

  async set_game_ID(gameID){
    const game = await this.gmaeIdRepository.findOne();
    game.gameId = gameID;
    await this.gmaeIdRepository.save(game);
  }

  async get_game_ID(): Promise<number>{
    return (await this.gmaeIdRepository.findOne()).gameId;
  }

}
