import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AppShell } from './components/layout/AppShell'
import { AuthProvider } from './context/AuthContext'
import { ActivityLogsPage } from './pages/ActivityLogsPage'
import { AssignedSchoolsPage } from './pages/AssignedSchoolsPage'
import { AttendancePage } from './pages/AttendancePage'
import { ClassAttendancePage } from './pages/ClassAttendancePage'
import { DashboardPage } from './pages/DashboardPage'
import { ApiRoutingHintPage } from './pages/ApiRoutingHintPage'
import { LoginPage } from './pages/LoginPage'
import { MonitoringVisitsPage } from './pages/MonitoringVisitsPage'
import { MyAttendancePage } from './pages/MyAttendancePage'
import { ObservationsPage } from './pages/ObservationsPage'
import { PartnerOrgsPage } from './pages/PartnerOrgsPage'
import { GovernmentSchoolReportsPage } from './pages/GovernmentSchoolReportsPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { ReportApprovalsPage } from './pages/ReportApprovalsPage'
import { ReportComparisonsPage } from './pages/ReportComparisonsPage'
import { ReportsWorkspacePage } from './pages/ReportsWorkspacePage'
import { SchoolDetailPage } from './pages/SchoolDetailPage'
import { SchoolFormPage } from './pages/SchoolFormPage'
import { SchoolsListPage } from './pages/SchoolsListPage'
import { UserFormPage } from './pages/UserFormPage'
import { UsersListPage } from './pages/UsersListPage'
import { VisitFormPage } from './pages/VisitFormPage'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/health/*" element={<ApiRoutingHintPage />} />
          <Route path="/docs/*" element={<ApiRoutingHintPage />} />
          <Route path="/docs" element={<ApiRoutingHintPage />} />
          <Route path="/openapi.json" element={<ApiRoutingHintPage />} />
          <Route path="/redoc" element={<ApiRoutingHintPage />} />
          <Route path="/api/*" element={<ApiRoutingHintPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/dashboard/users/new" element={<UserFormPage />} />
              <Route path="/dashboard/users/:userId/edit" element={<UserFormPage />} />
              <Route path="/dashboard/users" element={<UsersListPage />} />
              <Route path="/dashboard/audit-log" element={<ActivityLogsPage />} />
              <Route path="/dashboard/partner-orgs" element={<PartnerOrgsPage />} />
              <Route path="/dashboard/schools/new" element={<SchoolFormPage />} />
              <Route path="/dashboard/schools/:schoolId/edit" element={<SchoolFormPage />} />
              <Route path="/dashboard/schools/:schoolId" element={<SchoolDetailPage />} />
              <Route path="/dashboard/schools" element={<SchoolsListPage />} />
              <Route path="/dashboard/reports" element={<ReportsWorkspacePage />} />
              <Route path="/dashboard/settings" element={<PlaceholderPage title="Settings" />} />
              <Route path="/dashboard/districts" element={<PlaceholderPage title="Districts" />} />
              <Route path="/dashboard/school-reports" element={<GovernmentSchoolReportsPage />} />
              <Route path="/dashboard/comparisons" element={<ReportComparisonsPage />} />
              <Route path="/dashboard/approvals" element={<ReportApprovalsPage />} />
              <Route path="/dashboard/monitoring/new" element={<VisitFormPage />} />
              <Route path="/dashboard/monitoring/:visitId" element={<VisitFormPage />} />
              <Route path="/dashboard/monitoring" element={<MonitoringVisitsPage />} />
              <Route path="/dashboard/visits" element={<MonitoringVisitsPage />} />
              <Route path="/dashboard/assigned-schools" element={<AssignedSchoolsPage />} />
              <Route path="/dashboard/observations" element={<ObservationsPage />} />
              <Route path="/dashboard/attendance" element={<AttendancePage />} />
              <Route path="/dashboard/timetable" element={<PlaceholderPage title="Timetable" />} />
              <Route path="/dashboard/my-attendance" element={<MyAttendancePage />} />
              <Route path="/dashboard/class-attendance" element={<ClassAttendancePage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
