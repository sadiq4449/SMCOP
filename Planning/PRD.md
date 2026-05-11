Product Requirements Document
School Monitoring, Classroom Observation & Reporting Portal (PPP Node / IE)
1. Overview

This system is designed for monitoring government schools adopted under PPP (Public–Private Partnership) Nodes in Sindh. The platform enables:

Quarterly monitoring visits
Classroom observations
KPI-based evaluation
Infrastructure status tracking
Reports submission and comparisons
District-level and school-level dashboards
Proper role-based access control (RBAC)

The system will be used by:

Super Admin (Full Access)
IE Monitoring Team (Enumerators)
District Education Officers (DEOs)
Principals
Teachers
Government Users (Read-only only)

Importantly:
📌 Government users have monitoring-only access (no adding/editing/deleting).
📌 Super Admin has full CRUD access across the portal.

2. System Goals
Standardize monitoring of PPP schools.
Digitize quarterly monitoring reports.
Improve transparency for Government users.
Provide dashboards for performance tracking.
Enable IE enumerators to collect structured field data.
Keep historical data for comparing quarter-over-quarter results.
3. Core Modules
3.1 School Management Module
Full CRUD by Super Admin
View-only by Government
District → Taluka → UC → School structure
School profile
School facilities
Enrollment & staffing
GPS location + supporting images
3.2 Quarterly Monitoring Module
7 KPI-based evaluations:
Enrollment & Attendance
Classroom Instruction Quality
Teacher Availability
School Infrastructure
Student Learning Environment
Management & Governance
Community Engagement
Quarter selection (Q1–Q4)
Score, evidence photos, enumerator remarks
Auto-generate final monitoring score
3.3 Classroom Observation Module
Observe teachers inside classrooms
Indicators example:
Student engagement
Lesson planning
Instruction methods
Teaching aids
Classroom discipline
Upload photos and comments
Enumerator-only submission
DEO review
3.4 Attendance Module
Teacher attendance (Daily/Monthly)
Student attendance (Daily/Monthly)
Principal approval
Export attendance summaries
3.5 Reporting Module
Quarterly reports
DEO review & approval
Govt read-only access
PDF/Excel export
Comparison reports:
School vs School
District vs District
Quarter vs Quarter
3.6 Issue Tracking Module
Enumerator can create an issue
Tags: Infrastructure / Teachers / Students / Facility
Assign to Principal or DEO
Track progress
Govt can view issue status
3.7 Dashboard & Analytics
Super Admin dashboard
DEO dashboard (District-only)
Principal dashboard
Government dashboard (Read-only)
KPI graphs
Performance trends
Visit analytics
3.8 Notifications
Email or in-system alerts
Pending tasks
Reports requiring action
Issue escalations
3.9 Role & Permission Management
Super Admin full access
Enumerators assigned schools
DEO district-only
Principal school-only
Government read-only
Teachers attendance + academic tasks only
4. User Roles & Permissions Summary
Role	Access Level
Super Admin	Full CRUD (users, schools, KPIs, reports, forms)
IE Enumerators	Submit monitoring + observation forms only
DEO	Review/approve reports for their district
Principal	Manage timetable, attendance, school-level reporting
Teacher	Enter attendance, lesson plans, student grades
Government User	View-only (No Add/Edit/Delete)
5. Functional Requirements
5.1 Authentication
Username + Password
Role-based view upon login
Two-factor authentication (optional future phase)
5.2 Navigation
Role-based dashboards
Single sidebar UI
Mobile-responsive layout
5.3 Forms
Dynamic forms for KPI visits
Classroom observation checklist
Save-as-draft option
5.4 Data Management
All historical data stored by quarter
Ability to compare multiple quarters
Retain visit data for 5+ years
5.5 Search & Filters
By District, Taluka, UC, School, Principal, Teacher
Monitoring status filters
Attendance date filters
5.6 Reporting
Auto-generate summary from forms
Export to PDF/Excel
Graphs and visualizations
6. Non-Functional Requirements
6.1 Performance
Should load dashboards < 3 seconds
Handle up to 10,000 school records
6.2 Security
Encrypted password storage
All access role-restricted
Audit logs for Super Admin
6.3 Reliability
Cloud deployment (99% uptime)
Automatic backups of critical data
6.4 Usability
Simple UI for field officers
Accessible on mobile browsers
Offline mode (optional Phase 2)
6.5 Scalability
Multi-organizational support
Extendable modules
7. Assumptions
Each school receives quarterly monitoring.
Enumerators conduct on-site visits.
Government does not modify any school record.
Super Admin can change any system component.
8. Success Metrics
95% of schools visited each quarter
100% enumerators use digital forms
80% reduction in paper-based reporting
Faster DEO review time (< 7 days)
Transparent reporting for Govt dashboard
9. Future Features (Optional Phase 2)
AI-based report generation
Photo-to-KPI detection
