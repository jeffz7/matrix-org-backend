import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
// import ExcelJS from 'exceljs';
const ExcelJS = require('exceljs');

import { generateCypherCommands } from '../utils/cypherGenerator';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import {
  AssignmentMapping,
  Employee,
  Project,
  Unit,
} from 'src/utils/types/types';

@Injectable()
export class SeedingService {
  constructor(@Inject('NEO4J_DRIVER') private readonly neo4jDriver) {}

  loadExcelData = async (
    filePath: string,
  ): Promise<{
    employees: Employee[];
    projects: Project[];
    mappings: AssignmentMapping[];
    units: Unit[];
    skills: { SkillID: number; SkillName: string }[];
    employeeSkillMappings: { EmployeeID: number; SkillID: number }[];
    projectSkillMappings: { ProjectID: number; SkillID: number }[];
  }> => {
    console.log('>>> loadExcelData started', filePath);

    const workbook = new ExcelJS.Workbook();
    console.log('>>> got workbook', workbook);

    await workbook.xlsx.readFile(filePath);

    // Load Employee Table
    const employeeSheet = workbook.getWorksheet('Employee Table');
    const employees: Employee[] = [];
    employeeSheet?.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        // Skip header row
        employees.push({
          EmployeeID: row.getCell(1).value as number,
          EmployeeName: row.getCell(2).value as string,
          BusinessUnit: row.getCell(3).value as string,
          Department: row.getCell(4).value as string,
          TalentManager: row.getCell(5).value as number,
          FunctionalManager: row.getCell(6).value as number,
          JobTitle: row.getCell(7).value as string,
          YearOfJoining: row.getCell(8).value as number,
          YearOfBirth: row.getCell(9).value as number,
        });
      }
    });

    // Load Project Table
    const projectSheet = workbook.getWorksheet('Project Table');
    const projects: Project[] = [];
    projectSheet?.eachRow((row, rowNumber) => {
      if (rowNumber > 1 && rowNumber < 12) {
        // Skip header row
        projects.push({
          ProjectID: row.getCell(1).value as number,
          ProjectName: row.getCell(2).value as string,
          ProjectManagerID: row.getCell(3).value as number,
          ProductManagerID: row.getCell(4).value as number,
          TechnicalLeadID: row.getCell(5).value as number,
          StartDate: row.getCell(6).value
            ? new Date(row.getCell(6).value as string)
            : null,
          EndDate: row.getCell(7).value
            ? new Date(row.getCell(7).value as string)
            : null,
        });
      }
    });

    // Load Units Table (from new sheet)
    const unitSheet = workbook.getWorksheet('Units');
    const units: Unit[] = [];
    unitSheet?.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        units.push({
          UnitName: row.getCell(1).value as string,
          ParentUnitName: (row.getCell(2).value as string) || null,
          UnitType: row.getCell(3).value as string,
        });
      }
    });

    // Load Employee To Project Mapping
    const mappingSheet = workbook.getWorksheet('Employee To Project Mapping');
    const mappings: AssignmentMapping[] = [];
    mappingSheet?.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        // Skip header row
        mappings.push({
          EmployeeID: row.getCell(1).value as number,
          ProjectID: row.getCell(2).value as number,
          ReportingToEmployeeID: row.getCell(3).value as number,
          ProjectSpecificRole: row.getCell(4).value as string,
          TimeAlloted: row.getCell(5).value as number,
          StartDate: row.getCell(6).value
            ? new Date(row.getCell(6).value as string)
            : null,
          EndDate: row.getCell(7).value
            ? new Date(row.getCell(7).value as string)
            : null,
        });
      }
    });

    // Load Skills Table
    const skillsSheet = workbook.getWorksheet('Skills');
    const skills: { SkillID: number; SkillName: string }[] = [];
    skillsSheet?.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        // Skip header row
        skills.push({
          SkillID: row.getCell(1).value as number,
          SkillName: row.getCell(2).value as string,
        });
      }
    });

    // Load Employee to Skill Mapping Table
    const employeeSkillSheet = workbook.getWorksheet(
      'Employee To Skill Mapping',
    );
    const employeeSkillMappings: { EmployeeID: number; SkillID: number }[] = [];
    employeeSkillSheet?.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        // Skip header row
        employeeSkillMappings.push({
          EmployeeID: row.getCell(1).value as number,
          SkillID: row.getCell(2).value as number,
        });
      }
    });

    // Load Skills to Project Mapping Table
    const projectSkillSheet = workbook.getWorksheet(
      'Skills to Project Mapping',
    );
    const projectSkillMappings: { ProjectID: number; SkillID: number }[] = [];
    projectSkillSheet?.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        // Skip header row
        projectSkillMappings.push({
          ProjectID: row.getCell(1).value as number,
          SkillID: row.getCell(2).value as number,
        });
      }
    });

    return {
      employees,
      projects,
      mappings,
      units,
      skills,
      employeeSkillMappings,
      projectSkillMappings,
    };
  };

  async checkIsDatabaseEmpty(): Promise<boolean> {
    const session = this.neo4jDriver.session();
    const query = `MATCH (n) return count(n) as count`;
    const result = await session.run(query);
    const count = result?.records[0]?.get('count').toInt();
    console.log('>>> count:', count);
    return count === 0;
  }

  async runCypherQueries(data: any) {
    const session = this.neo4jDriver.session();
    const commands = generateCypherCommands(
      data.employees,
      data.projects,
      data.mappings,
      data.units,
      data.skills,
      data.employeeSkillMappings,
      data.projectSkillMappings,
    );

    try {
      for (const query of commands) {
        await session.run(query);
      }
      console.log('Database seeding completed.');
    } catch (error) {
      console.error('Error during seeding:', error);
    } finally {
      await session.close();
    }
  }

  async processFile(filePath: string) {
    try {
      const isDatabaseEmpty = await this.checkIsDatabaseEmpty();

      if (isDatabaseEmpty) {
        const data = await this.loadExcelData(filePath);
        await this.runCypherQueries(data);
        console.log('File processed and database seeded successfully');
      } else {
        console.log('Database is not empty, skipping processing');
        throw new ForbiddenException(
          'Database is not empty, skipping processing',
        );
      }

      // Always delete the file after processing
      await fs.unlink(filePath);
    } catch (error) {
      console.error('Error processing file:', error);
      await fs.unlink(filePath);
      throw error;
    }
  }
}
