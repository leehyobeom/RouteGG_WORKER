import { Module } from '@nestjs/common';
import { WorkerService } from './worker.service';
import { WorkerController } from './worker.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Route } from './entities/route.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Route])],
  providers: [WorkerService],
  controllers: [WorkerController]
})
export class WorkerModule {}
