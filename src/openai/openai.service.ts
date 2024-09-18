import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotImplementedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class OpenaiService {
  private openai: OpenAI;

  constructor(@Inject('NEO4J_DRIVER') private readonly neo4jDriver) {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async runCypherFlow(
    question: string,
    history: any[] = [],
    retry = true,
  ): Promise<any> {
    let query = '';
    try {
      console.log('>>> question: ', question);
      const cypherQuery = await this.getCypherQueryFromAI(question, history);
      console.log('>>> response from openai', cypherQuery);

      query = cypherQuery?.rawCypher;
      if (!query) {
        throw new NotImplementedException(cypherQuery.error);
      }

      const session = this.neo4jDriver.session();
      const result = await session.run(query);
      console.log('>>> result length', result?.records?.length);

      const formattedResult = await this.formatResponse(result);

      return this.createSuccessResponse(
        'Query executed successfully',
        formattedResult,
      );
    } catch (error) {
      return this.handleError(error, question, query, retry);
    }
  }

  private async getCypherQueryFromAI(
    question: string,
    history: any[],
  ): Promise<{ success: boolean; rawCypher: string; error: string }> {
    const thread = await this.createThreadWithMessages(question, history);
    const run = await this.executeAssistantRun(thread.id);
    console.log('>>> usage', run.usage);
    if (run.status !== 'completed') {
      return { success: false, rawCypher: '', error: 'Assistant run failed' };
    }

    const assistantResponse = await this.extractAssistantResponse(
      run.thread_id,
    );
    return this.parseAssistantResponse(assistantResponse);
  }

  private async createThreadWithMessages(question: string, history: any[]) {
    const messages = [{ role: 'user', content: question }, ...history];
    const thread = await this.openai.beta.threads.create({ messages });
    return thread;
  }

  private async executeAssistantRun(threadId: string) {
    return this.openai.beta.threads.runs.createAndPoll(threadId, {
      assistant_id: process.env.OPENAI_ASSISTANT_ID,
    });
  }

  private async extractAssistantResponse(threadId: string) {
    const messages = await this.openai.beta.threads.messages.list(threadId);
    return messages?.data[0]?.content[0]['text']?.value;
  }

  private parseAssistantResponse(response: string) {
    try {
      return JSON.parse(response);
    } catch (error) {
      console.error('Error parsing assistant response:', error);
      return {
        success: false,
        rawCypher: '',
        error: 'Failed to parse response',
      };
    }
  }

  private async formatResponse(result: any): Promise<any> {
    const entities = [];
    const relations = [];

    result?.records.forEach((record) => {
      record.forEach((entry) => {
        if (this.isNode(entry)) {
          entities.push(this.formatNode(entry));
        } else if (this.isRelationship(entry)) {
          relations.push(this.formatRelationship(entry));
        }
      });
    });

    return { entities, relations };
  }

  private isNode(entry: any): boolean {
    return entry?.identity && entry?.labels;
  }

  private isRelationship(entry: any): boolean {
    return entry?.start && entry?.end && entry?.type;
  }

  private formatNode(node: any) {
    return {
      id: node.identity.toInt(),
      type: node.labels[0],
      metaData: node.properties,
    };
  }

  private formatRelationship(rel: any) {
    return {
      from: rel.start.toInt(),
      to: rel.end.toInt(),
      type: rel.type,
      metaData: rel.properties || {},
    };
  }

  private handleError(
    error: any,
    question: string,
    rawCypher: string,
    retry: boolean,
  ): any {
    console.error('Error executing Cypher flow:', error);

    if (error.status === 501) {
      throw error;
    }

    if (!retry) {
      throw new InternalServerErrorException(error.message);
    }

    return this.runCypherFlow(
      question,
      [
        { role: 'assistant', content: rawCypher },
        {
          role: 'user',
          content: `This query returns an error: ${error.message}. Please fix it without any explanations.`,
        },
      ],
      false,
    );
  }

  private createSuccessResponse(message: string, data: any) {
    return {
      status: 'success',
      message,
      data,
    };
  }
}
