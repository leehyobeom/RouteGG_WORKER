import { Module } from '@nestjs/common';
import { WorkerService } from './worker.service';
import { WorkerController } from './worker.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Route } from './entities/route.entity';
import { GameID } from './entities/gameId.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Route, GameID])],
  providers: [WorkerService],
  controllers: [WorkerController]
})
export class WorkerModule {}
