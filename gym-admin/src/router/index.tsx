import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AuthLayout } from '@/layouts/AuthLayout'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { ProtectedRoute } from './ProtectedRoute'
import { RoleGuard } from './RoleGuard'
import { lazy, Suspense } from 'react'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

// Lazy-load all pages
const LoginPage                = lazy(() => import('@/pages/auth/LoginPage'))
const ForgotPasswordPage       = lazy(() => import('@/pages/auth/ForgotPasswordPage'))
const ResetPasswordPage        = lazy(() => import('@/pages/auth/ResetPasswordPage'))
const DashboardPage            = lazy(() => import('@/pages/dashboard/DashboardPage'))
const MembersListPage          = lazy(() => import('@/pages/members/MembersListPage'))
const MemberDetailPage         = lazy(() => import('@/pages/members/MemberDetailPage'))
const AddMemberPage            = lazy(() => import('@/pages/members/AddMemberPage'))
const PlansPage                = lazy(() => import('@/pages/plans/PlansPage'))
const SubscriptionsListPage    = lazy(() => import('@/pages/subscriptions/SubscriptionsListPage'))
const PaymentsListPage         = lazy(() => import('@/pages/payments/PaymentsListPage'))
const ClassesListPage          = lazy(() => import('@/pages/classes/ClassesListPage'))
const ClassDetailPage          = lazy(() => import('@/pages/classes/ClassDetailPage'))
const CreateClassPage          = lazy(() => import('@/pages/classes/CreateClassPage'))
const ExpensesListPage         = lazy(() => import('@/pages/expenses/ExpensesListPage'))
const BookingsListPage         = lazy(() => import('@/pages/bookings/BookingsListPage'))
const TrainersListPage         = lazy(() => import('@/pages/trainers/TrainersListPage'))
const TrainerDetailPage        = lazy(() => import('@/pages/trainers/TrainerDetailPage'))
const TrainerEditPage          = lazy(() => import('@/pages/trainers/TrainerEditPage'))
const AttendancePage           = lazy(() => import('@/pages/attendance/AttendancePage'))
const PromoCodesPage           = lazy(() => import('@/pages/promo-codes/PromoCodesPage'))
const FacilitiesPage           = lazy(() => import('@/pages/facilities/FacilitiesPage'))
const ReportsPage              = lazy(() => import('@/pages/reports/ReportsPage'))
const RevenueReportPage        = lazy(() => import('@/pages/reports/RevenueReportPage'))
const AttendanceReportPage     = lazy(() => import('@/pages/reports/AttendanceReportPage'))
const MembersReportPage        = lazy(() => import('@/pages/reports/MembersReportPage'))
const MonthlyReportPage        = lazy(() => import('@/pages/reports/MonthlyReportPage'))
const GSTReportPage            = lazy(() => import('@/pages/reports/GSTReportPage'))
const PackagesReportPage       = lazy(() => import('@/pages/reports/PackagesReportPage'))
const ClassesReportPage        = lazy(() => import('@/pages/reports/ClassesReportPage'))
const MembershipsReportPage    = lazy(() => import('@/pages/reports/MembershipsReportPage'))
const PTReportPage             = lazy(() => import('@/pages/reports/PTReportPage'))
const TrainerReportPage        = lazy(() => import('@/pages/reports/TrainerReportPage'))
const EnquiriesPage            = lazy(() => import('@/pages/enquiries/EnquiriesPage'))
const NotificationsPage        = lazy(() => import('@/pages/notifications/NotificationsPage'))
const AuditLogsPage            = lazy(() => import('@/pages/audit-logs/AuditLogsPage'))
const SettingsPage             = lazy(() => import('@/pages/settings/SettingsPage'))
const DietTemplatesPage        = lazy(() => import('@/pages/diet-templates/DietTemplatesPage'))
const TrainingTemplatesPage    = lazy(() => import('@/pages/training-templates/TrainingTemplatesPage'))
const DayPassesPage            = lazy(() => import('@/pages/day-passes/DayPassesPage'))
const DayPassDetailPage        = lazy(() => import('@/pages/day-passes/DayPassDetailPage'))
const FoodsPage                = lazy(() => import('@/pages/foods/FoodsPage'))
const InvoicesPage             = lazy(() => import('@/pages/billing/InvoicesPage'))
const ReceiptsPage             = lazy(() => import('@/pages/billing/ReceiptsPage'))
const TaxSettingsPage          = lazy(() => import('@/pages/billing/TaxSettingsPage'))
const PTPackagesPage           = lazy(() => import('@/pages/pt/PTPackagesPage'))
const PTSessionsPage           = lazy(() => import('@/pages/pt/PTSessionsPage'))
const ExerciseLibraryPage      = lazy(() => import('@/pages/coaching/ExerciseLibraryPage'))
const WorkoutAssignmentsPage   = lazy(() => import('@/pages/coaching/WorkoutAssignmentsPage'))
const DietAssignmentsPage      = lazy(() => import('@/pages/coaching/DietAssignmentsPage'))
const WorkoutLogsPage          = lazy(() => import('@/pages/coaching/WorkoutLogsPage'))
const TrainerFeedbackPage      = lazy(() => import('@/pages/coaching/TrainerFeedbackPage'))
const BodyMeasurementsPage     = lazy(() => import('@/pages/retention/BodyMeasurementsPage'))
const ProgressPhotosPage       = lazy(() => import('@/pages/retention/ProgressPhotosPage'))
const RetentionWorkspacePage   = lazy(() => import('@/pages/retention/RetentionWorkspacePage'))
const LeadsAndFollowUpsPage    = lazy(() => import('@/pages/crm/LeadsAndFollowUpsPage'))
const TrialVisitsPage          = lazy(() => import('@/pages/crm/TrialVisitsPage'))
const WaiversPage              = lazy(() => import('@/pages/waivers/WaiversPage'))
const LoyaltyPage              = lazy(() => import('@/pages/loyalty/LoyaltyPage'))
const POSPage                  = lazy(() => import('@/pages/pos/POSPage'))
const CommissionsPage          = lazy(() => import('@/pages/commissions/CommissionsPage'))
const BranchesPage             = lazy(() => import('@/pages/branches/BranchesPage'))
const LockersPage              = lazy(() => import('@/pages/lockers/LockersPage'))
const NotFoundPage             = lazy(() => import('@/pages/errors/NotFoundPage'))
const ForbiddenPage            = lazy(() => import('@/pages/errors/ForbiddenPage'))

// Form pages (full-page create/edit routes)
const BookingFormPage          = lazy(() => import('@/pages/bookings/BookingFormPage'))
const DayPassFormPage          = lazy(() => import('@/pages/day-passes/DayPassFormPage'))
const PlanFormPage             = lazy(() => import('@/pages/plans/PlanFormPage'))
const SubscriptionFormPage     = lazy(() => import('@/pages/subscriptions/SubscriptionFormPage'))
const EnquiryFormPage          = lazy(() => import('@/pages/enquiries/EnquiryFormPage'))
const PromoCodeFormPage        = lazy(() => import('@/pages/promo-codes/PromoCodeFormPage'))
const ExpenseFormPage          = lazy(() => import('@/pages/expenses/ExpenseFormPage'))
const ExerciseFormPage         = lazy(() => import('@/pages/coaching/ExerciseFormPage'))
const WorkoutAssignmentFormPage = lazy(() => import('@/pages/coaching/WorkoutAssignmentFormPage'))
const DietAssignmentFormPage   = lazy(() => import('@/pages/coaching/DietAssignmentFormPage'))
const WorkoutLogFormPage       = lazy(() => import('@/pages/coaching/WorkoutLogFormPage'))
const TrainerFeedbackFormPage  = lazy(() => import('@/pages/coaching/TrainerFeedbackFormPage'))
const BodyMeasurementFormPage  = lazy(() => import('@/pages/retention/BodyMeasurementFormPage'))
const ProgressPhotoFormPage    = lazy(() => import('@/pages/retention/ProgressPhotoFormPage'))
const RetentionRiskFormPage    = lazy(() => import('@/pages/retention/RetentionRiskFormPage'))
const PTPackageFormPage        = lazy(() => import('@/pages/pt/PTPackageFormPage'))
const PTEnrollPage             = lazy(() => import('@/pages/pt/PTEnrollPage'))
const TrialVisitFormPage       = lazy(() => import('@/pages/crm/TrialVisitFormPage'))
const WaiverFormPage           = lazy(() => import('@/pages/waivers/WaiverFormPage'))
const CommissionRuleFormPage   = lazy(() => import('@/pages/commissions/CommissionRuleFormPage'))
const BranchFormPage           = lazy(() => import('@/pages/branches/BranchFormPage'))
const FoodFormPage             = lazy(() => import('@/pages/foods/FoodFormPage'))
const DietTemplateFormPage     = lazy(() => import('@/pages/diet-templates/DietTemplateFormPage'))
const TrainingTemplateFormPage = lazy(() => import('@/pages/training-templates/TrainingTemplateFormPage'))
const StaffListPage            = lazy(() => import('@/pages/staff/StaffListPage'))
const StaffFormPage            = lazy(() => import('@/pages/staff/StaffFormPage'))
const StaffAttendancePage      = lazy(() => import('@/pages/staff/StaffAttendancePage'))
const StaffPayrollPage         = lazy(() => import('@/pages/staff/StaffPayrollPage'))
const TrainerNewPage           = lazy(() => import('@/pages/trainers/TrainerNewPage'))
const InventoryPage                  = lazy(() => import('@/pages/inventory/InventoryPage'))
const WorkoutAssignmentsOldPage      = lazy(() => import('@/pages/coaching/WorkoutAssignmentsOldPage'))
const VendorsPage              = lazy(() => import('@/pages/purchases/VendorsPage'))
const DirectPurchasePage       = lazy(() => import('@/pages/purchases/DirectPurchasePage'))
const PurchaseFormPage         = lazy(() => import('@/pages/purchases/PurchaseFormPage'))

const wrap = (el: React.ReactNode) => (
  <Suspense fallback={<LoadingSpinner fullPage />}>{el}</Suspense>
)

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '/subscriptions', element: <Navigate to="/memberships" replace /> },
  { path: '/subscriptions/new', element: <Navigate to="/memberships/new" replace /> },

  // Auth routes
  {
    element: <AuthLayout />,
    children: [
      { path: '/login',            element: wrap(<LoginPage />) },
      { path: '/forgot-password',  element: wrap(<ForgotPasswordPage />) },
      { path: '/reset-password',   element: wrap(<ResetPasswordPage />) },
    ],
  },

  // Protected routes
  {
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: '/dashboard',              element: wrap(<DashboardPage />) },
      { path: '/members',                element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><MembersListPage /></RoleGuard>) },
      { path: '/members/new',            element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><AddMemberPage /></RoleGuard>) },
      { path: '/members/:id',            element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><MemberDetailPage /></RoleGuard>) },
      { path: '/enquiries',              element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><EnquiriesPage /></RoleGuard>) },
      { path: '/plans',                  element: <Navigate to="/membership-plans" replace /> },
      { path: '/membership-plans',       element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><PlansPage /></RoleGuard>) },
      { path: '/memberships',             element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><SubscriptionsListPage /></RoleGuard>) },
      { path: '/payments',               element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><PaymentsListPage /></RoleGuard>) },
      { path: '/classes',                element: wrap(<ClassesListPage />) },
      { path: '/classes/new',            element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><CreateClassPage /></RoleGuard>) },
      { path: '/classes/:id',            element: wrap(<ClassDetailPage />) },
      { path: '/bookings',               element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><BookingsListPage /></RoleGuard>) },
      { path: '/trainers',               element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><TrainersListPage /></RoleGuard>) },
      { path: '/trainers/new',           element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><TrainerNewPage /></RoleGuard>) },
      { path: '/trainers/:id',           element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><TrainerDetailPage /></RoleGuard>) },
      { path: '/trainers/:id/edit',      element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><TrainerEditPage /></RoleGuard>) },
      { path: '/attendance',             element: wrap(<AttendancePage />) },
      { path: '/promo-codes',            element: wrap(<RoleGuard allowedRoles={['admin']}><PromoCodesPage /></RoleGuard>) },
      { path: '/facilities',             element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><FacilitiesPage /></RoleGuard>) },
      { path: '/reports',                element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><ReportsPage /></RoleGuard>) },
      { path: '/reports/revenue',        element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><RevenueReportPage /></RoleGuard>) },
      { path: '/reports/attendance',     element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><AttendanceReportPage /></RoleGuard>) },
      { path: '/reports/members',        element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><MembersReportPage /></RoleGuard>) },
      { path: '/reports/monthly',        element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><MonthlyReportPage /></RoleGuard>) },
      { path: '/reports/gst',            element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><GSTReportPage /></RoleGuard>) },
      { path: '/reports/packages',       element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><PackagesReportPage /></RoleGuard>) },
      { path: '/reports/classes',        element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><ClassesReportPage /></RoleGuard>) },
      { path: '/reports/memberships',    element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><MembershipsReportPage /></RoleGuard>) },
      { path: '/reports/pt',             element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><PTReportPage /></RoleGuard>) },
      { path: '/reports/trainers/:id',   element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><TrainerReportPage /></RoleGuard>) },
      { path: '/inventory',               element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><InventoryPage /></RoleGuard>) },
      { path: '/purchases/vendors',       element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><VendorsPage /></RoleGuard>) },
      { path: '/purchases/direct',        element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><DirectPurchasePage /></RoleGuard>) },
      { path: '/purchases/direct/new',    element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><PurchaseFormPage /></RoleGuard>) },
      { path: '/purchases/direct/:id/edit', element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><PurchaseFormPage /></RoleGuard>) },
      { path: '/notifications',          element: wrap(<NotificationsPage />) },
      { path: '/audit-logs',             element: wrap(<RoleGuard allowedRoles={['admin']}><AuditLogsPage /></RoleGuard>) },
      { path: '/settings',               element: wrap(<SettingsPage />) },
      { path: '/diet-templates',         element: wrap(<DietTemplatesPage />) },
      { path: '/training-templates',     element: wrap(<TrainingTemplatesPage />) },
      { path: '/day-passes',             element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><DayPassesPage /></RoleGuard>) },
      { path: '/day-passes/:id',         element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><DayPassDetailPage /></RoleGuard>) },
      { path: '/expenses',               element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><ExpensesListPage /></RoleGuard>) },
      { path: '/foods',                  element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><FoodsPage /></RoleGuard>) },
      { path: '/billing/invoices',       element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><InvoicesPage /></RoleGuard>) },
      { path: '/billing/receipts',       element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><ReceiptsPage /></RoleGuard>) },
      { path: '/billing/tax-settings',   element: wrap(<RoleGuard allowedRoles={['admin']}><TaxSettingsPage /></RoleGuard>) },
      { path: '/pt/packages',            element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><PTPackagesPage /></RoleGuard>) },
      { path: '/pt/sessions',            element: wrap(<PTSessionsPage />) },
      // Month 3: Coaching loop
      { path: '/coaching/exercises',     element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><ExerciseLibraryPage /></RoleGuard>) },
      { path: '/coaching/workouts',      element: wrap(<WorkoutAssignmentsPage />) },
      { path: '/coaching/workouts-old',  element: wrap(<WorkoutAssignmentsOldPage />) },
      { path: '/coaching/diet',          element: wrap(<DietAssignmentsPage />) },
      { path: '/coaching/logs',          element: wrap(<WorkoutLogsPage />) },
      { path: '/coaching/feedback',      element: wrap(<TrainerFeedbackPage />) },
      // Month 4: Retention workspace
      { path: '/retention/measurements', element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><BodyMeasurementsPage /></RoleGuard>) },
      { path: '/retention/photos',       element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><ProgressPhotosPage /></RoleGuard>) },
      { path: '/retention/workspace',    element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><RetentionWorkspacePage /></RoleGuard>) },
      // Month 5: CRM depth + waivers
      { path: '/crm/leads',              element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><LeadsAndFollowUpsPage /></RoleGuard>) },
      { path: '/crm/trials',             element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><TrialVisitsPage /></RoleGuard>) },
      { path: '/waivers',                element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><WaiversPage /></RoleGuard>) },
      // Month 6: Loyalty, POS, Commissions, Branches
      { path: '/loyalty',                element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><LoyaltyPage /></RoleGuard>) },
      { path: '/pos',                    element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><POSPage /></RoleGuard>) },
      { path: '/commissions',            element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><CommissionsPage /></RoleGuard>) },
      { path: '/branches',               element: wrap(<RoleGuard allowedRoles={['admin']}><BranchesPage /></RoleGuard>) },
      { path: '/lockers',                element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><LockersPage /></RoleGuard>) },
      { path: '/staff',                  element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><StaffListPage /></RoleGuard>) },
      { path: '/staff/new',              element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><StaffFormPage /></RoleGuard>) },
      { path: '/staff/:id/edit',         element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><StaffFormPage /></RoleGuard>) },
      { path: '/staff/attendance',       element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><StaffAttendancePage /></RoleGuard>) },
      { path: '/staff/payroll',          element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><StaffPayrollPage /></RoleGuard>) },

      // Form pages (full-page create/edit)
      { path: '/bookings/new',                   element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><BookingFormPage /></RoleGuard>) },
      { path: '/day-passes/new',                 element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><DayPassFormPage /></RoleGuard>) },
      { path: '/day-passes/:id/edit',            element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><DayPassFormPage /></RoleGuard>) },
      { path: '/plans/new',                      element: <Navigate to="/membership-plans/new" replace /> },
      { path: '/plans/:id/edit',                 element: <Navigate to="/membership-plans/:id/edit" replace /> },
      { path: '/membership-plans/new',           element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><PlanFormPage /></RoleGuard>) },
      { path: '/membership-plans/:id/edit',      element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><PlanFormPage /></RoleGuard>) },
      { path: '/memberships/new',                element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><SubscriptionFormPage /></RoleGuard>) },
      { path: '/enquiries/new',                  element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><EnquiryFormPage /></RoleGuard>) },
      { path: '/enquiries/:id/edit',             element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><EnquiryFormPage /></RoleGuard>) },
      { path: '/promo-codes/new',                element: wrap(<RoleGuard allowedRoles={['admin']}><PromoCodeFormPage /></RoleGuard>) },
      { path: '/promo-codes/:id/edit',           element: wrap(<RoleGuard allowedRoles={['admin']}><PromoCodeFormPage /></RoleGuard>) },
      { path: '/expenses/new',                   element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><ExpenseFormPage /></RoleGuard>) },
      { path: '/expenses/:id/edit',              element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><ExpenseFormPage /></RoleGuard>) },
      { path: '/coaching/exercises/new',         element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><ExerciseFormPage /></RoleGuard>) },
      { path: '/coaching/exercises/:id/edit',    element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><ExerciseFormPage /></RoleGuard>) },
      { path: '/coaching/workouts/new',          element: wrap(<WorkoutAssignmentFormPage />) },
      { path: '/coaching/diet/new',              element: wrap(<DietAssignmentFormPage />) },
      { path: '/coaching/logs/new',              element: wrap(<WorkoutLogFormPage />) },
      { path: '/coaching/feedback/new',          element: wrap(<TrainerFeedbackFormPage />) },
      { path: '/retention/measurements/new',     element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><BodyMeasurementFormPage /></RoleGuard>) },
      { path: '/retention/photos/new',           element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><ProgressPhotoFormPage /></RoleGuard>) },
      { path: '/retention/workspace/new',        element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><RetentionRiskFormPage /></RoleGuard>) },
      { path: '/pt/packages/new',                element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><PTPackageFormPage /></RoleGuard>) },
      { path: '/pt/packages/:id',               element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><PTPackageFormPage /></RoleGuard>) },
      { path: '/pt/enroll',                      element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><PTEnrollPage /></RoleGuard>) },
      { path: '/crm/trials/new',                 element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><TrialVisitFormPage /></RoleGuard>) },
      { path: '/waivers/new',                    element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><WaiverFormPage /></RoleGuard>) },
      { path: '/commissions/rules/new',          element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><CommissionRuleFormPage /></RoleGuard>) },
      { path: '/branches/new',                   element: wrap(<RoleGuard allowedRoles={['admin']}><BranchFormPage /></RoleGuard>) },
      { path: '/foods/new',                      element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><FoodFormPage /></RoleGuard>) },
      { path: '/foods/:id/edit',                 element: wrap(<RoleGuard allowedRoles={['admin', 'manager']}><FoodFormPage /></RoleGuard>) },
      { path: '/diet-templates/new',             element: wrap(<DietTemplateFormPage />) },
      { path: '/diet-templates/:id/edit',        element: wrap(<DietTemplateFormPage />) },
      { path: '/training-templates/new',         element: wrap(<TrainingTemplateFormPage />) },
      { path: '/training-templates/:id/edit',    element: wrap(<TrainingTemplateFormPage />) },

      { path: '/403',                    element: wrap(<ForbiddenPage />) },
      { path: '*',                       element: wrap(<NotFoundPage />) },
    ],
  },
])
