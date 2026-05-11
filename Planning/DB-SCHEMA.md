School Monitoring & Classroom Observation Portal (SMCOP)
Database Schema (PostgreSQL)
Version: 1.0

1. ERD Overview

Main modules:

Users & Roles
Partner Organizations
Schools
School → Enrollment, Teachers, Infrastructure
Quarterly Monitoring
KPIs & Scores
Classroom Observations
Documents & Evidence
Notifications & Activity Logs
2. TABLES
2.1 users

Stores all portal users across all roles.

Field	Type	Notes
id	uuid (PK)	
full_name	varchar(120)	
email	varchar(150)	unique
password_hash	text	
role	enum('super_admin','gov_ppp','partner_admin','ia_field_monitor','school_principal','viewer')	
partner_org_id	uuid	FK → partner_orgs.id (nullable)
assigned_schools	uuid[]	Schools allowed for field monitors
status	enum('active','inactive')	
created_at	timestamp	
updated_at	timestamp	
2.2 partner_orgs

Organizations adopting schools.

Field	Type
id	uuid (PK)
name	varchar(150)
contact_person	varchar(120)
email	varchar(150)
phone	varchar(50)
address	text
created_at	timestamp
2.3 schools
Field	Type	Notes
id	uuid (PK)	
emis_code	varchar(50)	unique
name	varchar(200)	
district	varchar(120)	
taluka	varchar(120)	
uc	varchar(120)	
level	enum('primary','middle','high','higher_secondary')	
gender	enum('boys','girls','mixed')	
partner_org_id	uuid	FK → partner_orgs.id
principal_name	varchar(120)	
principal_phone	varchar(50)	
status	enum('active','inactive')	
created_at	timestamp	
2.4 school_enrollment

Tracks enrollment each quarter.

Field	Type
id	uuid
school_id	uuid FK
quarter	varchar(20)
boys	int
girls	int
total	int
created_at	timestamp
2.5 teachers

Teacher directory.

Field	Type
id	uuid
school_id	uuid FK
name	varchar(150)
gender	enum('male','female')
subject	varchar(150)
status	enum('active','inactive')
created_at	timestamp
2.6 visits

Each school’s quarterly Monitoring Visit.

Field	Type	Notes
id	uuid	
school_id	uuid FK	
quarter	varchar(20)	
visit_date	date	
visited_by	uuid FK → users.id	
overall_status	enum('completed','pending')	
remarks	text	
created_at	timestamp	
2.7 kpis

Master list of KPIs.

Field	Type
id	uuid
name	varchar(200)
description	text
max_score	int
category	varchar(120)
sort_order	int
2.8 kpi_scores

KPI scoring per visit (per school per quarter).

Field	Type
id	uuid
visit_id	uuid FK
kpi_id	uuid FK
score	int
remarks	text
2.9 classroom_observations

Observations for individual teachers.

Field	Type
id	uuid
visit_id	uuid
teacher_id	uuid
subject	varchar(120)
grade	varchar(50)
observation_date	date
score	numeric(5,2)
strengths	text
weaknesses	text
recommendations	text
2.10 infrastructure_checklist

High-level school checks.

Field	Type
id	uuid
visit_id	uuid
item_name	varchar(150)
status	enum('available','not_available','needs_repair')
remarks	text
2.11 documents

Upload visit evidence, PDFs, pictures etc.

Field	Type
id	uuid
school_id	uuid
visit_id	uuid (nullable)
file_name	varchar
file_url	text
file_type	varchar(50)
uploaded_by	uuid
created_at	timestamp
2.12 notifications

System notifications.

Field	Type
id	uuid
user_id	uuid
title	varchar
message	text
is_read	boolean
created_at	timestamp
2.13 activity_logs

Tracks actions for auditing.

Field	Type
id	uuid
user_id	uuid
action	varchar(200)
target	varchar(200)
metadata	jsonb
created_at	timestamp
3. PERMISSION MODEL IN DB TERMS
Role	Allowed Tables Write Access
Super Admin	All tables
Gov / PPP Node	NONE (full read-only)
Partner Admin	Schools THEY own, teachers, visits, observations
IA Field Monitor	visits, kpi_scores, observations, infrastructure_checklist
School Principal	read-only for their school
Viewer	read-only
4. RELATIONSHIPS
partner_orgs 1—M schools
schools 1—M teachers
schools 1—M visits
visits 1—M kpi_scores
visits 1—M classroom_observations
visits 1—M infrastructure_checklist
users 1—M visits (visited_by)
5. SAMPLE QUARTER WORKFLOW (schema-based)
IA visits school → visits row created
KPI evaluation → records stored in kpi_scores
Classroom observations → stored in classroom_observations
Evidence uploaded → stored in documents
Final visit summary → stored in visits.remarks
Gov/PPP Node logs in → view only all tables
Partner sees their schools only via partner_org_id
6. FUTURE SCALABILITY

Prepared for:

Multi-year data
Multiple PPP partners
Large number of schools
API-based mobile app
Role-based row-level security