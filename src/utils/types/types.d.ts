export interface Employee {
  EmployeeID: number;
  EmployeeName: string;
  BusinessUnit: string;
  Department: string;
  TalentManager: number;
  FunctionalManager: number;
  JobTitle: string;
  YearOfJoining: number;
  YearOfBirth: number;
}

export interface Project {
  ProjectID: number;
  ProjectName: string;
  ProjectManagerID: number;
  ProductManagerID: number;
  TechnicalLeadID: number;
  StartDate: Date | null; // Add StartDate
  EndDate: Date | null; // Add EndDate
}

export interface AssignmentMapping {
  EmployeeID: number;
  ProjectID: number;
  ReportingToEmployeeID: number;
  ProjectSpecificRole: string;
  TimeAlloted: number; // Add TimeAlloted
  StartDate: Date | null; // Add StartDate
  EndDate: Date | null; // Add EndDate
}

export interface Unit {
  UnitName: string;
  ParentUnitName?: string | null;
  UnitType: string;
}
