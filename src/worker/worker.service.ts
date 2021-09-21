import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, Interval } from '@nestjs/schedule';

@Injectable()
export class WorkerService {

  @Cron(CronExpression.EVERY_SECOND)
  async analys() {
        
        //있으면 error times error 추가 // 5번연속이면 다시 5번째로 다시 돌아가고 다시 0 -> 휴면기 돌입 1시간.
        // error times error 0으로 초기화 
        this.checkDataExist();

        // battleType ===1 체크
        this.check_BattleType_Solo();

        //  routeId 체크
        this.check_Exist_RouteId();

        // route, characterNum, seson 조회
        //있으면, enemy 업데이트
        //없으면, 새로 추가
        this.check_SameRoute();

        //saveLastNum
        this.saveLastNum();
  }

  checkDataExist(){}
  check_BattleType_Solo(){}
  check_Exist_RouteId(){}
  check_SameRoute(){}
  saveLastNum(){}
  
}
