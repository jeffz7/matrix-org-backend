import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { OpenaiService } from './openai.service';
import { ApiBody, ApiOperation } from '@nestjs/swagger';

@Controller('openai')
export class OpenaiController {
  constructor(private readonly openaiService: OpenaiService) {}

  @Get('cypher')
  async getCypherQuery(@Query('question') question: string) {
    const response = await this.openaiService.runCypherFlow(question);
    return response.data;
  }

  @Post('cypher')
  @ApiOperation({ description: 'Run a cypher query and get db response' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          example: 'MATCH (n:Employee {Name: $name}) RETURN n',
          description: 'The Cypher query string',
        },
        params: {
          type: 'object',
          additionalProperties: {
            type: 'string', // You can adjust this type depending on your parameter values
          },
          example: {
            name: 'Jobin',
          },
          description:
            'Parameters for the Cypher query, provided as key-value pairs',
        },
      },
      required: ['query'], // Params is optional
    },
  })
  async runCypherQuery(@Body() body: any) {
    try {
      console.log('>>> cypher body', body);

      const { query, params } = body;
      if (!query) {
        throw new BadRequestException('Cypher query is required');
      }

      const queryParams = params || {};
      const result = await this.openaiService.runQuery(query, queryParams);

      return { status: 'success', data: result };
    } catch (error) {
      throw new BadRequestException(
        `Failed to execute query: ${error.message}`,
      );
    }
  }
}
