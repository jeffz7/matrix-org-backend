import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Neo4jModule } from './neo4j/neo4j.module';
import { SeedingModule } from './seeding/seeding.module';
import { ConfigModule } from '@nestjs/config';
import { OpenaiModule } from './openai/openai.module';

@Module({
  imports: [ConfigModule.forRoot(), Neo4jModule, SeedingModule, OpenaiModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
