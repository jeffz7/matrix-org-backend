import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createDriver } from './neo4jConfig';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'NEO4J_DRIVER',
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const driver = createDriver(
          configService.get('NEO4J_URI'),
          configService.get('NEO4J_USERNAME'),
          configService.get('NEO4J_PASSWORD'),
        );
        return driver;
      },
    },
  ],
  exports: ['NEO4J_DRIVER'],
})
export class Neo4jModule {}
