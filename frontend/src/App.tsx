import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AppShell } from './components/layout/AppShell'
import { AuthProvider } from './context/AuthContext'
import { ApiRoutingHintPage } from './pages/ApiRoutingHintPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { LoginPage } from './pages/LoginPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'

const ActivityLogsPage = lazy(() =>
  import('./pages/ActivityLogsPage').then((m) => ({ default: m.ActivityLogsPage })),
)
const AssignedSchoolsPage = lazy(() =>
  import('./pages/AssignedSchoolsPage').then((m) => ({ default: m.AssignedSchoolsPage })),
)
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const DistrictsBrowsePage = lazy(() =>
  import('./pages/DistrictsBrowsePage').then((m) => ({ default: m.DistrictsBrowsePage })),
)
const GeographyPage = lazy(() =>
  import('./pages/GeographyPage').then((m) => ({ default: m.GeographyPage })),
)
const IeSchoolAssignmentsPage = lazy(() =>
  import('./pages/IeSchoolAssignmentsPage').then((m) => ({ default: m.IeSchoolAssignmentsPage })),
)
const IssuesPage = lazy(() => import('./pages/IssuesPage').then((m) => ({ default: m.IssuesPage })))
const MonitoringVisitsPage = lazy(() =>
  import('./pages/MonitoringVisitsPage').then((m) => ({ default: m.MonitoringVisitsPage })),
)
const ObservationsPage = lazy(() =>
  import('./pages/ObservationsPage').then((m) => ({ default: m.ObservationsPage })),
)
const PartnerOrgsPage = lazy(() =>
  import('./pages/PartnerOrgsPage').then((m) => ({ default: m.PartnerOrgsPage })),
)
const ReportsWorkspacePage = lazy(() =>
  import('./pages/ReportsWorkspacePage').then((m) => ({ default: m.ReportsWorkspacePage })),
)
const ReportComparePage = lazy(() =>
  import('./pages/ReportComparePage').then((m) => ({ default: m.ReportComparePage })),
)
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
const SchoolDetailPage = lazy(() =>
  import('./pages/SchoolDetailPage').then((m) => ({ default: m.SchoolDetailPage })),
)
const SchoolFormPage = lazy(() =>
  import('./pages/SchoolFormPage').then((m) => ({ default: m.SchoolFormPage })),
)
const SchoolsListPage = lazy(() =>
  import('./pages/SchoolsListPage').then((m) => ({ default: m.SchoolsListPage })),
)
const UserFormPage = lazy(() =>
  import('./pages/UserFormPage').then((m) => ({ default: m.UserFormPage })),
)
const UsersListPage = lazy(() =>
  import('./pages/UsersListPage').then((m) => ({ default: m.UsersListPage })),
)
const VisitCalendarPage = lazy(() =>
  import('./pages/VisitCalendarPage').then((m) => ({ default: m.VisitCalendarPage })),
)
const VisitFormPage = lazy(() =>
  import('./pages/VisitFormPage').then((m) => ({ default: m.VisitFormPage })),
)

function AppRouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-text-muted">
      <p className="animate-premium-in text-sm font-medium tracking-tight">Loading…</p>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<AppRouteFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/health/*" element={<ApiRoutingHintPage />} />
            <Route path="/docs/*" element={<ApiRoutingHintPage />} />
            <Route path="/docs" element={<ApiRoutingHintPage />} />
            <Route path="/openapi.json" element={<ApiRoutingHintPage />} />
            <Route path="/redoc" element={<ApiRoutingHintPage />} />
            <Route path="/svc/*" element={<ApiRoutingHintPage />} />
            <Route path="/api/*" element={<ApiRoutingHintPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/dashboard/users/new" element={<UserFormPage />} />
                <Route path="/dashboard/users/:userId/edit" element={<UserFormPage />} />
                <Route path="/dashboard/users" element={<UsersListPage />} />
                <Route path="/dashboard/ie-assignments" element={<IeSchoolAssignmentsPage />} />
                <Route path="/dashboard/audit-log" element={<ActivityLogsPage />} />
                <Route path="/dashboard/partner-orgs" element={<PartnerOrgsPage />} />
                <Route path="/dashboard/geography" element={<GeographyPage />} />
                <Route path="/dashboard/schools/new" element={<SchoolFormPage />} />
                <Route path="/dashboard/schools/:schoolId/edit" element={<SchoolFormPage />} />
                <Route path="/dashboard/schools/:schoolId" element={<SchoolDetailPage />} />
                <Route path="/dashboard/schools" element={<SchoolsListPage />} />
                <Route path="/dashboard/reports/compare" element={<ReportComparePage />} />
                <Route path="/dashboard/reports" element={<ReportsWorkspacePage />} />
                <Route path="/dashboard/settings" element={<SettingsPage />} />
                <Route path="/dashboard/districts" element={<DistrictsBrowsePage />} />
                <Route path="/dashboard/monitoring/new" element={<VisitFormPage />} />
                <Route path="/dashboard/monitoring/:visitId" element={<VisitFormPage />} />
                <Route path="/dashboard/monitoring" element={<MonitoringVisitsPage />} />
                <Route path="/dashboard/visit-calendar" element={<VisitCalendarPage />} />
                <Route path="/dashboard/visits" element={<Navigate to="/dashboard/monitoring" replace />} />
                <Route path="/dashboard/approvals" element={<Navigate to="/dashboard/reports" replace />} />
                <Route path="/dashboard/assigned-schools" element={<AssignedSchoolsPage />} />
                <Route path="/dashboard/issues" element={<IssuesPage />} />
                <Route path="/dashboard/observations" element={<ObservationsPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
