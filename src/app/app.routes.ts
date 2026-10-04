import { Routes } from '@angular/router';
import { authGuard, guestGuard, homeGuard, roleGuard } from './core/auth/guards';

export const routes: Routes = [
  {
    path: 'login',
    title: 'تسجيل الدخول',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: 'hr',
        canActivate: [roleGuard('HR')],
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
          {
            path: 'dashboard',
            title: 'لوحة التحكم',
            loadComponent: () => import('./features/dashboard/hr-dashboard.component').then((m) => m.HrDashboardComponent),
          },
          {
            path: 'employees',
            title: 'الموظفون',
            loadComponent: () => import('./features/employees/employees.component').then((m) => m.EmployeesComponent),
          },
          {
            path: 'departments',
            title: 'الأقسام',
            loadComponent: () => import('./features/departments/departments.component').then((m) => m.DepartmentsComponent),
          },
          {
            path: 'positions',
            title: 'الوظائف',
            loadComponent: () => import('./features/positions/positions.component').then((m) => m.PositionsComponent),
          },
          {
            path: 'leaves',
            title: 'طلبات الإجازات',
            loadComponent: () => import('./features/leaves/leaves.component').then((m) => m.LeavesComponent),
          },
          {
            path: 'balances',
            title: 'أرصدة الإجازات',
            loadComponent: () => import('./features/balances/balances.component').then((m) => m.BalancesComponent),
          },
          {
            path: 'attendance',
            title: 'الحضور والبصمة',
            loadComponent: () => import('./features/attendance/hr-attendance.component').then((m) => m.HrAttendanceComponent),
          },
          {
            path: 'payroll',
            children: [
              { path: '', pathMatch: 'full', redirectTo: 'structures' },
              {
                path: 'structures',
                title: 'هيكل الرواتب',
                loadComponent: () =>
                  import('./features/payroll/salary-structures.component').then((m) => m.SalaryStructuresComponent),
              },
              {
                path: 'run',
                title: 'تشغيل الرواتب',
                loadComponent: () => import('./features/payroll/payroll-run.component').then((m) => m.PayrollRunComponent),
              },
            ],
          },
        ],
      },
      {
        path: 'portal',
        canActivate: [roleGuard('Employee')],
        children: [
          {
            path: '',
            pathMatch: 'full',
            title: 'بوابة الموظف',
            loadComponent: () => import('./features/portal/portal.component').then((m) => m.PortalComponent),
          },
          {
            path: 'attendance',
            title: 'حضوري',
            loadComponent: () => import('./features/portal/my-attendance.component').then((m) => m.MyAttendanceComponent),
          },
        ],
      },
      { path: '', pathMatch: 'full', canActivate: [homeGuard], children: [] },
    ],
  },
  { path: '**', canActivate: [homeGuard], children: [] },
];
