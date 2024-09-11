import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve the uploads folder statically
  app.useStaticAssets(join(__dirname, '..', 'uploads'));

  // Swagger setup (if using Swagger)
  const config = new DocumentBuilder()
    .setTitle('Matrix Org Neo4j API')
    .setDescription('API for interacting with Neo4j organizational data')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(3000);
  console.log('>>> Service listening on 3000');
}
bootstrap();
