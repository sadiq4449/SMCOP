import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AppShell } from './components/layout/AppShell'
import { AuthProvider } from './context/AuthContext'
import { ActivityLogsPage } from './pages/ActivityLogsPage'
import { AssignedSchoolsPage } from './pages/AssignedSchoolsPage'
import { DashboardPage } from './pages/DashboardPage'
import { DistrictsBrowsePage } from './pages/DistrictsBrowsePage'
import { ApiRoutingHintPage } from './pages/ApiRoutingHintPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { GeographyPage } from './pages/GeographyPage'
import { IeSchoolAssignmentsPage } from './pages/IeSchoolAssignmentsPage'
import { IssuesPage } from './pages/IssuesPage'
import { LoginPage } from './pages/LoginPage'
import { MonitoringVisitsPage } from './pages/MonitoringVisitsPage'
import { ObservationsPage } from './pages/ObservationsPage'
import { PartnerOrgsPage } from './pages/PartnerOrgsPage'
import { ReportsWorkspacePage } from './pages/ReportsWorkspacePage'
import { ReportComparePage } from './pages/ReportComparePage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { SettingsPage } from './pages/SettingsPage'
import { SchoolDetailPage } from './pages/SchoolDetailPage'
import { SchoolFormPage } from './pages/SchoolFormPage'
import { SchoolsListPage } from './pages/SchoolsListPage'
import { UserFormPage } from './pages/UserFormPage'
import { UsersListPage } from './pages/UsersListPage'
import { VisitCalendarPage } from './pages/VisitCalendarPage'
import { VisitFormPage } from './pages/VisitFormPage'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
