export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  errors?: string[];
}

export interface Paged<T> {
  items: T[];
  totalCount?: number;
  pageNumber?: number;
  pageSize?: number;
}

/* ───────────── Organization ───────────── */
export interface Employee {
  id: number;
  name: string;
  email: string;
  phoneNumber?: string | null;
  hireDate?: string | null;
  address?: string | null;
  departmentId?: number | null;
  departmentName?: string | null;
  positionId?: number | null;
  positionTitle?: string | null;
  isActive: boolean;
}

export interface EmployeePayload {
  name: string;
  email: string;
  phoneNumber: string;
  hireDate: string;
  address: string;
  departmentId: number;
  positionId: number;
  isActive?: boolean;
}

export interface Department {
  id: number;
  name: string;
  headName?: string | null;
  employeeCount?: number;
  positionCount?: number;
}

export interface Position {
  id: number;
  title: string;
  baseSalary: number;
  departmentId: number;
  departmentName?: string | null;
}

export interface PositionPayload {
  title: string;
  baseSalary: number;
  departmentId: number;
}

/* ───────────── Leaves ───────────── */
export interface LeaveRequest {
  id: number;
  employeeId: number;
  employeeName?: string | null;
  leaveType: string | number;
  startDate: string;
  endDate: string;
  reason?: string | null;
  status: string | number;
  rejectionNote?: string | null;
  rejectionReason?: string | null;
}

export interface LeaveRequestPayload {
  employeeId: number;
  leaveType: number;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface LeaveBalance {
  employeeId?: number;
  year?: number;
  leaveType: string | number;
  totalDays: number;
  usedDays: number;
}

export interface LeaveBalancePayload {
  employeeId: number;
  year: number;
  leaveType: number;
  totalDays: number;
}

export interface RegisterAccountPayload {
  email: string;
  password: string;
  userName: string;
  employeeId: number;
}

/* ───────────── Attendance (ZKTeco) ───────────── */
export interface AttendanceRecord {
  id: number;
  employeeId: number;
  employeeName?: string | null;
  date: string;
  clockIn?: string | null;
  clockOut?: string | null;
  status?: string | number | null;
  lateMinutes: number;
  notes?: string | null;
}

export interface AttendanceUpdatePayload {
  clockIn: string | null;
  clockOut: string | null;
  lateMinutes: number;
  notes: string;
}

export interface TardinessSummary {
  employeeId?: number;
  employeeName?: string | null;
  year?: number;
  month?: number;
  totalOccurrences: number;
  totalLateMinutes: number;
  allowedMinutes: number;
  deductibleMinutes: number;
}

export interface DeviceLog {
  id: number;
  deviceSerial: string;
  userPin: string;
  logTime?: string | null;
  timestamp?: string | null;
  inOutMode?: string | number | null;
  processed: boolean;
  errorMessage?: string | null;
}

/* ───────────── Payroll ───────────── */
export interface SalaryStructure {
  employeeId?: number;
  basicSalary: number;
  housingAllowance: number;
  transportationAllowance: number;
  mealAllowance: number;
  otherAllowances: number;
  monthlyOvertime: number;
  socialInsurance: number;
  taxAmount: number;
  otherDeductions: number;
}

export interface Payslip {
  id: number;
  employeeId: number;
  employeeName?: string | null;
  departmentName?: string | null;
  month: number;
  year: number;
  basicSalary: number;
  totalAllowances: number;
  overtime: number;
  grossPay?: number;
  absentDays: number;
  absenceDeduction: number;
  totalLateMinutes: number;
  tardinessDeduction: number;
  taxAmount: number;
  socialInsurance: number;
  otherDeductions: number;
  totalDeductions?: number;
  netPay?: number;
}

export interface PayrollRunRequest {
  month: number;
  year: number;
  departmentId?: number | null;
  employeeId?: number | null;
}

export interface PayrollRunResult {
  processedCount: number;
  skippedCount: number;
  totalNetDisbursed: number;
}

export interface PayslipAdjustPayload {
  overtime: number;
  otherDeductions: number;
}
