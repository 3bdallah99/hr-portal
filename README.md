# HR Portal — Angular 19

واجهة HRMS كاملة (Standalone Components + Signals + Reactive Forms) فوق الـ ASP.NET Core 8 API.
اللغة: عربي RTL (Bootstrap 5.3 RTL + FontAwesome 6 + طبقة CSS مخصّصة بالـ CSS variables).

## التشغيل

```bash
# Backend (https://localhost:7087)
dotnet run --project PL.API --launch-profile "https"

# Frontend
npm install
npm start          # http://localhost:4200  — /api يمرّ عبر proxy.conf.json إلى https://localhost:7087
npm run build      # الإنتاج: dist/hr-portal/browser  (عدّل apiUrl في environment.prod.ts)
```

> المهم: الـ proxy يستهدف **https** مباشرة. لو وجّهته لـ http والـ Backend يعمل `UseHttpsRedirection`
> فسيحصل 307 والمتصفح يُسقط `Authorization` عند تغيّر الـ origin (فيظهر 401).


## الواجهة (Aurora design system)

- **وضع داكن/فاتح** بزر في الشريط العلوي: يُحفظ الاختيار ويتبع إعداد النظام أول مرة (بدون وميض عند التحميل).
- **بحث سريع Ctrl/⌘ + K**: انتقال فوري بين الصفحات (حسب دور المستخدم) بالأسهم وEnter.
- **Sidebar قابل للطي** لشريط أيقونات (يُحفظ الاختيار)، ودرج جانبي كامل على الموبايل.
- **لوحة HR**: بطاقة ترحيب + مؤشرات + رسم دائري لحالات الإجازات + أعمدة الموظفين حسب القسم (بيانات فعلية فقط، بدون أرقام وهمية).
- **بوابة الموظف**: بطاقة ملخّص (الإجازات المتبقية، الطلبات المعلّقة، تأخير الشهر) + حلقات الأرصدة + عدّاد التأخير.
- Avatars بتدرّجات ثابتة لكل اسم، حركات دخول متتابعة، skeletons، وتحترم `prefers-reduced-motion`.

## الأدوار والمسارات

| الدور | المسارات |
|---|---|
| HR | `/hr/dashboard` · `/hr/employees` · `/hr/departments` · `/hr/positions` · `/hr/leaves` · `/hr/balances` · `/hr/attendance` · `/hr/payroll/structures` · `/hr/payroll/run` |
| Employee | `/portal` (أرصدة + عدّاد التأخير + طلباتي) · `/portal/attendance` (سجل الشهر) |

الحماية: `authGuard` + `roleGuard('HR' | 'Employee')` + lazy loading لكل شاشة.

## البنية

```
src/app
├── core/    auth (AuthService + guards) · http (jwtInterceptor, errorInterceptor, ApiError)
│            services (employee, department, position, leave, attendance, payroll) · models.ts · util/
├── shared/  ui (Modal, Drawer, Confirm, Toast, KPI, TardinessMeter, BalanceCard, StatusBadge,
│            Skeleton, EmptyState, ChangePasswordDialog, AllocateBalanceDialog) · pipes/money
├── layout/  ShellComponent (Sidebar بمجموعات + Badge الطلبات المعلّقة + قائمة المستخدم)
└── features/ auth · dashboard · employees · departments · positions · leaves · balances
              attendance · payroll · portal
```

## سلوك الـ Interceptors

- `jwtInterceptor`: يضيف `Authorization: Bearer` لطلبات `/api` فقط.
- `errorInterceptor`:
  - 401 مع جلسة قائمة ⇒ تسجيل خروج + تنبيه.
  - فشل أي عملية كتابة (POST/PUT/DELETE) ⇒ Toast برسالة الـ API (`message` / `errors`) أو رسالة عربية احتياطية.
  - فشل القراءة (GET) ⇒ لا Toast؛ كل شاشة تعرض حالة خطأ مع «إعادة المحاولة».
  - لمنع Toast طلب معيّن: `context: new HttpContext().set(SILENT_ERRORS, true)`.
- انتهاء التوكن: تسجيل خروج تلقائي لحظة الانتهاء (مؤقّت داخل `AuthService`).
- «تذكّرني»: `localStorage`، وإلا `sessionStorage`.

## افتراضات الـ API (راجِعها مع الـ Backend وعدّل `core/services/*` و`core/models.ts`)

الـ endpoints المذكورة في المتطلبات نفّذتها كما هي. اللي **افترضته** لأن الـ DTOs غير متاحة لي:

| الموضوع | الافتراض |
|---|---|
| سجل حضور موظف (بوابة الموظف) | `GET /api/attendance/employee/{id}?year=&month=` |
| قراءة هيكل راتب | `GET /api/payroll/salary-structure/{id}` (404 = غير معرّف) |
| تشغيل الرواتب | `POST /api/payroll/run` body `{month, year, departmentId?, employeeId?}` ⇒ `{processedCount, skippedCount, totalNetDisbursed}` |
| كشوف الشهر | `GET /api/payroll?month=&year=&departmentId=` |
| تعديل قسيمة | `PUT /api/payroll/{id}` body `{overtime, otherDeductions}` |
| تصحيح الحضور | `PUT /api/attendance/{id}` body `{clockIn, clockOut, lateMinutes, notes}`؛ الوقت بنفس شكل الأصل (TimeSpan `HH:mm:00` أو DateTime) |
| رفض الإجازة | يُرسل `rejectionNote` و`rejectionReason` معًا لتوافق الـ DTO |
| `SalaryStructure` | `basicSalary, housingAllowance, transportationAllowance, mealAllowance, otherAllowances, monthlyOvertime, socialInsurance, taxAmount, otherDeductions` |
| `Payslip` | `basicSalary, totalAllowances, overtime, absentDays, absenceDeduction, totalLateMinutes, tardinessDeduction, taxAmount, socialInsurance, otherDeductions` (+ `grossPay/totalDeductions/netPay` اختيارية؛ تُحسب محليًا لو غابت) |
| `TardinessSummary` | `totalOccurrences, totalLateMinutes, allowedMinutes, deductibleMinutes` |
| `DeviceLog` | `deviceSerial, userPin, logTime|timestamp, inOutMode, processed, errorMessage` |
| حالة الحضور | رقم (`0=Present,1=Late,2=Absent`) أو اسم، وإلا تُستنتج من البصمة والتأخير |

لو اختلف اسم حقل: عدّله في `models.ts` فقط ثم صحّح الـ template اللي يستخدمه (يظهر كخطأ type واضح عند `ng build`).

## ملاحظات

- قسم «رؤساء الأقسام» يظهر لو رجع `headName` في `Department`، وإلا يُخفى.
- المبالغ بصيغة `1,234.50 ج.م` (أرقام لاتينية tabular).
- طباعة قسيمة الراتب: زر «طباعة / تنزيل PDF» يطبع القسيمة فقط (اختر Save as PDF من نافذة الطباعة).
