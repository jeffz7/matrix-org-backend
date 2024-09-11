import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { extname } from 'path';
import { SeedingService } from './seeding.service';
import {
  ApiConsumes,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Express } from 'express'; // Import Express namespace

@Controller('seeding')
@ApiTags('Seeding') // Tag for Swagger UI
export class SeedingController {
  constructor(private readonly seedingService: SeedingService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload an Excel file to seed the database' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'File processed successfully.' })
  @ApiResponse({ status: 500, description: 'Error processing file.' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads', // Folder where files will be saved
        filename: (req, file, cb) => {
          const fileName = `${uuidv4()}${extname(file.originalname)}`;
          cb(null, fileName);
        },
      }),
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      return { message: 'No file uploaded' };
    }

    const filePath = file.path;

    try {
      // Process the file
      await this.seedingService.processFile(filePath);
      return {
        message: 'File processed successfully',
        filename: file.filename,
      };
    } catch (error) {
      return { message: 'Error processing file', error: error.message };
    }
  }
}
