import { Controller, Get, Query } from '@nestjs/common';
import { OpenaiService } from './openai.service';

@Controller('openai')
export class OpenaiController {
  constructor(private readonly openaiService: OpenaiService) {}

  @Get('cypher')
  async getCypherQuery(@Query('question') question: string) {
    const response = await this.openaiService.runCypherFlow(question);
    return response.data;
  }

  //   @Get('v2/cypher')
  //   async getV2CypherQuery(@Query('question') question: string) {
  //     const response = await this.openaiService.runV2CypherFlow(question);
  //     return response;
  //   }
}
