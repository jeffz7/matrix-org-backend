import { v4 as uuidv4 } from 'uuid';
import { Employee, Project, AssignmentMapping, Unit } from './types/types';
import { format } from 'date-fns';

const generateTimestamp = (): string => {
  return format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
};

const splitAndTrim = (input: string | null | undefined): string[] => {
  if (!input) {
    return [];
  }
  return input.split(',').map((item) => item.trim());
};

// Helper function to get additional labels based on UnitType
const getUnitLabel = (unitType: string): string => {
  switch (unitType.toLowerCase()) {
    case 'businessunit':
      return ':BusinessUnit';
    case 'department':
      return ':Department';
    case 'project':
      return ':Project';
    default:
      return '';
  }
};

export const generateCypherCommands = (
  employees: Employee[],
  projects: Project[],
  mappings: AssignmentMapping[],
  units: Unit[],
  skills: { SkillID: number; SkillName: string }[],
  employeeSkillMappings: { EmployeeID: number; SkillID: number }[],
  projectSkillMappings: { ProjectID: number; SkillID: number }[],
): string[] => {
  const commands: string[] = [];

  // Process Employee Table and create BusinessUnit, Department nodes

  // Process Unit Table (BusinessUnit, Department, Project)
  units.forEach((unit) => {
    const additionalLabel = getUnitLabel(unit.UnitType);

    // Create Unit Node with additional labels
    const unitNode = `
      MERGE (u:Unit${additionalLabel} {name: "${unit.UnitName}", UnitType: "${
        unit.UnitType
      }"})
      ON CREATE SET
        u._id = "${uuidv4()}",
        u.UnitType = "${unit.UnitType}",
        u._created_at = "${generateTimestamp()}",
        u._last_modified = "${generateTimestamp()}",
        u.isDeleted = false,
        u.status = 'active'
    `;
    commands.push(unitNode);

    // Create Parent-Child (BELONGS_TO_UNIT) Relationship if applicable
    if (unit.ParentUnitName) {
      const linkParentToSubUnit = `
      MATCH (pu:Unit {name: "${unit.ParentUnitName}"}), (u:Unit {name: "${unit.UnitName}",  UnitType: "${unit.UnitType}"})
      WHERE pu <> u
      MERGE (pu)<-[:BELONGS_TO_UNIT]-(u)
      `;
      commands.push(linkParentToSubUnit);
    }
  });

  employees.forEach((employee) => {
    const employeeNode = `
    MERGE (e:Employee {
      _id: "${uuidv4()}",
      EmployeeID: ${employee.EmployeeID},
      Name: "${employee.EmployeeName}",
      _created_at: "${generateTimestamp()}",
      _last_modified: "${generateTimestamp()}",
      isDeleted: false,
      status: 'active'
    })
    `;
    commands.push(employeeNode);
  });

  //   employees.forEach((employee) => {
  //     // Create or merge BusinessUnit Node
  //     const businessUnitNode = `
  //         MERGE (bu:BusinessUnit {BusinessUnitName: "${employee.BusinessUnit}"})
  //         ON CREATE SET
  //           bu._id = "${uuidv4()}",
  //           bu._created_at = "${generateTimestamp()}",
  //           bu._last_modified = "${generateTimestamp()}",
  //           bu.isDeleted = false,
  //           bu.status = 'active'
  //         ON MATCH SET
  //           bu._last_modified = "${generateTimestamp()}"
  //         `;
  //     commands.push(businessUnitNode);
  //   });
  //

  employees.forEach((employee) => {
    // Handle Job Titles (comma-separated) and connect to Role
    const jobTitles = splitAndTrim(employee.JobTitle);
    jobTitles.forEach((jobTitle) => {
      const roleNode = `
       MERGE (r:Role {RoleType: "${jobTitle}"})
       ON CREATE SET
         r._id = "${uuidv4()}",
         r._created_at = "${generateTimestamp()}",
         r._last_modified = "${generateTimestamp()}",
         r.isDeleted = false,
         r.status = 'active'
       ON MATCH SET
         r._last_modified = "${generateTimestamp()}"
       `;
      commands.push(roleNode);
    });
  });

  employees.forEach((employee) => {});
  employees.forEach((employee) => {});

  employees.forEach((employee) => {
    // Link Employee to BusinessUnit
    if (employee.BusinessUnit) {
      const linkEmployeeToBusinessUnit = `
        MATCH (e:Employee {EmployeeID: ${employee.EmployeeID}})
        MATCH (bu:BusinessUnit {name: "${employee.BusinessUnit}"})
        MERGE (e)-[:BELONGS_TO_UNIT {
          _id: "${uuidv4()}",
          _created_at: "${generateTimestamp()}",
          _last_modified: "${generateTimestamp()}",
          isDeleted: false,
          status: 'active'
        }]->(bu)
        `;
      commands.push(linkEmployeeToBusinessUnit);
    }

    if (employee.Department) {
      // Link Employee to Department
      const linkEmployeeToDepartment = `
MATCH (e:Employee {EmployeeID: ${employee.EmployeeID}})
MATCH (d:Department {name: "${employee.Department}"})
MERGE (e)-[:BELONGS_TO_UNIT {
  _id: "${uuidv4()}",
  _created_at: "${generateTimestamp()}",
  _last_modified: "${generateTimestamp()}",
  isDeleted: false,
  status: 'active'
}]->(d)
`;
      commands.push(linkEmployeeToDepartment);
    }

    // Handle Job Titles (comma-separated) and connect to Role
    const jobTitles = splitAndTrim(employee.JobTitle);
    jobTitles.forEach((jobTitle) => {
      const linkEmployeeToRole = `
      MATCH (e:Employee {EmployeeID: ${employee.EmployeeID}})
      MATCH (r:Role {RoleType: "${jobTitle}"})
      MERGE (e)-[:HAS_ROLE {
        _id: "${uuidv4()}",
        _created_at: "${generateTimestamp()}",
        _last_modified: "${generateTimestamp()}",
        isDeleted: false,
        status: 'active'
      }]->(r)
      `;
      commands.push(linkEmployeeToRole);
    });

    // Link Employee to Talent Manager
    const linkEmployeeToTalentManager = `
    MATCH (e:Employee {EmployeeID: ${employee.EmployeeID}})
    MATCH (tm:Employee {EmployeeID: ${employee.TalentManager}})
    MERGE (e)-[:MANAGED_BY_TALENT {
      _id: "${uuidv4()}",
      _created_at: "${generateTimestamp()}",
      _last_modified: "${generateTimestamp()}",
      isDeleted: false,
      status: 'active'
    }]->(tm)
    `;
    commands.push(linkEmployeeToTalentManager);

    // Link Employee to Functional Manager
    const linkEmployeeToFunctionalManager = `
    MATCH (e:Employee {EmployeeID: ${employee.EmployeeID}})
    MATCH (fm:Employee {EmployeeID: ${employee.FunctionalManager}})
    MERGE (e)-[:MANAGED_BY_FUNCTIONAL {
      _id: "${uuidv4()}",
      _created_at: "${generateTimestamp()}",
      _last_modified: "${generateTimestamp()}",
      isDeleted: false,
      status: 'active'
    }]->(fm)
    `;
    commands.push(linkEmployeeToFunctionalManager);
  });

  // Process Project Table
  projects.forEach((project) => {
    let projectNode = `
    MERGE (p:Project:Unit {ProjectID: ${project.ProjectID}})
    ON CREATE SET
      p._id = "${uuidv4()}",
      p.name = "${project.ProjectName}",
      p.ProjectName = "${project.ProjectName}",
      p.ProjectManagerID = ${project.ProjectManagerID},
      p.ProductManagerID = ${project.ProductManagerID},
      p.TechnicalLeadID = ${project.TechnicalLeadID},
      p._created_at = "${generateTimestamp()}",
      p._last_modified = "${generateTimestamp()}",
      p.isDeleted = false,
      p.status = 'active'
    ON MATCH SET
      p._last_modified = "${generateTimestamp()}",
      p.ProjectName = "${project.ProjectName}",
      p.ProjectManagerID = ${project.ProjectManagerID},
      p.ProductManagerID = ${project.ProductManagerID},
      p.TechnicalLeadID = ${project.TechnicalLeadID}
    `;

    // Conditionally add StartDate and EndDate if they are not null
    if (project.StartDate) {
      projectNode += `, p.StartDate = "${project.StartDate.toISOString()}"`;
    }
    if (project.EndDate) {
      projectNode += `, p.EndDate = "${project.EndDate.toISOString()}"`;
    }

    projectNode += ' RETURN p'; // Close the MERGE statement and return the project node
    commands.push(projectNode);

    // Link Project to Project Manager
    const linkProjectToManager = `
    MATCH (p:Project {ProjectID: ${project.ProjectID}})
    MATCH (pm:Employee {EmployeeID: ${project.ProjectManagerID}})
    MERGE (p)-[:MANAGED_BY_PROJECT_MANAGER {
      _id: "${uuidv4()}",
      _created_at: "${generateTimestamp()}",
      _last_modified: "${generateTimestamp()}",
      isDeleted: false,
      status: 'active'
    }]->(pm)
    `;
    commands.push(linkProjectToManager);
  });

  // Process Skills Table
  skills.forEach((skill) => {
    const skillNode = `
        MERGE (s:Skill {SkillID: ${skill.SkillID}, SkillName: "${
          skill.SkillName
        }"})
           ON CREATE SET
          s._id = "${uuidv4()}",
          s._created_at = "${generateTimestamp()}",
          s._last_modified = "${generateTimestamp()}",
          s.isDeleted = false,
          s.status = 'active'
        ON MATCH SET
          s._last_modified = "${generateTimestamp()}"
        `;
    commands.push(skillNode);
  });

  // Process Employee to Skill Mapping
  employeeSkillMappings.forEach((mapping) => {
    const linkEmployeeToSkill = `
    MATCH (e:Employee {EmployeeID: ${mapping.EmployeeID}})
    MATCH (s:Skill {SkillID: ${mapping.SkillID}})
    MERGE (e)-[:HAS_SKILL {
      _id: "${uuidv4()}",
      _created_at: "${generateTimestamp()}",
      _last_modified: "${generateTimestamp()}",
      isDeleted: false,
      status: 'active'
    }]->(s)
    `;
    // console.log('>>> linkEmployeeToSkill', linkEmployeeToSkill);

    commands.push(linkEmployeeToSkill);
  });

  // Process Project to Skill Mapping
  projectSkillMappings.forEach((mapping) => {
    const linkProjectToSkill = `
    MATCH (p:Project {ProjectID: ${mapping.ProjectID}})
    MATCH (s:Skill {SkillID: ${mapping.SkillID}})
    MERGE (p)-[:USES_SKILL {
      _id: "${uuidv4()}",
      _created_at: "${generateTimestamp()}",
      _last_modified: "${generateTimestamp()}",
      isDeleted: false,
      status: 'active'
    }]->(s)
    `;
    commands.push(linkProjectToSkill);
  });

  // Process Employee To Project Mapping
  mappings.forEach((mapping) => {
    const assignmentId = uuidv4();
    let assignmentNode = `
    CREATE (a:Assignment {
      _id: "${assignmentId}",
      AssignmentID: "${assignmentId}",
      TimeAlloted: ${mapping.TimeAlloted},
      _created_at: "${generateTimestamp()}",
      _last_modified: "${generateTimestamp()}",
      isDeleted: false,
      status: 'active'
    `;

    // Conditionally add StartDate and EndDate if they are not null
    if (mapping.StartDate) {
      assignmentNode += `, StartDate: "${mapping.StartDate.toISOString()}"`;
    }
    if (mapping.EndDate) {
      assignmentNode += `, EndDate: "${mapping.EndDate.toISOString()}"`;
    }

    assignmentNode += '})'; // Close the CREATE statement
    commands.push(assignmentNode);

    // Link Employee to Assignment
    const linkEmployeeToAssignment = `
    MATCH (e:Employee {EmployeeID: ${mapping.EmployeeID}})
    MATCH (a:Assignment {AssignmentID: "${assignmentId}"})
    MERGE (e)-[:ASSIGNED {
      _id: "${uuidv4()}",
      _created_at: "${generateTimestamp()}",
      _last_modified: "${generateTimestamp()}",
      isDeleted: false,
      status: 'active'
    }]->(a)
    `;
    commands.push(linkEmployeeToAssignment);

    // Link Assignment to Project
    const linkAssignmentToProject = `
    MATCH (a:Assignment {AssignmentID: "${assignmentId}"})
    MATCH (p:Project {ProjectID: ${mapping.ProjectID}})
    MERGE (a)-[:ASSIGNED_TO_UNIT {
      _id: "${uuidv4()}",
      _created_at: "${generateTimestamp()}",
      _last_modified: "${generateTimestamp()}",
      isDeleted: false,
      status: 'active'
    }]->(p)
    `;
    commands.push(linkAssignmentToProject);

    // Handle Reporting Relationship
    if (mapping.ReportingToEmployeeID) {
      const linkReportingToManager = `
        MATCH (e:Employee {EmployeeID: ${mapping.EmployeeID}})
        MATCH (rm:Employee {EmployeeID: ${mapping.ReportingToEmployeeID}})
        MATCH (a:Assignment {AssignmentID: "${assignmentId}"})
        MERGE (a)-[:REPORTS_TO {
          _id: "${uuidv4()}",
          _created_at: "${generateTimestamp()}",
          _last_modified: "${generateTimestamp()}",
          isDeleted: false,
          status: 'active'
        }]->(rm)
        `;
      commands.push(linkReportingToManager);
    }

    // Handle Roles (comma-separated)
    const roles = splitAndTrim(mapping.ProjectSpecificRole);
    roles.forEach((role) => {
      const roleNode = `
      MERGE (r:Role {RoleType: "${role}"})
      ON CREATE SET
        r._id = "${uuidv4()}",
        r._created_at = "${generateTimestamp()}",
        r._last_modified = "${generateTimestamp()}",
        r.isDeleted = false,
        r.status = 'active'
      ON MATCH SET
        r._last_modified = "${generateTimestamp()}"
      `;
      commands.push(roleNode);

      const linkAssignmentToRole = `
      MATCH (a:Assignment {AssignmentID: "${assignmentId}"})
      MATCH (r:Role {RoleType: "${role}"})
      MERGE (a)-[:HAS_ROLE {
        _id: "${uuidv4()}",
        _created_at: "${generateTimestamp()}",
        _last_modified: "${generateTimestamp()}",
        isDeleted: false,
        status: 'active'
      }]->(r)
      `;
      commands.push(linkAssignmentToRole);
    });
  });

  return commands;
};
