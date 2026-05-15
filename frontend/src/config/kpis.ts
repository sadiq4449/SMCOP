/** Seven standardized PPP monitoring KPIs (names aligned with programme brief). */
export const STANDARD_KPIS = [
  {
    code: 1,
    title: 'Student Enrollment & Retention',
    description: 'Enrolled vs. attended, dropout rate',
  },
  {
    code: 2,
    title: 'Teacher Presence & Attendance',
    description: 'Teachers present/sanctioned, absenteeism',
  },
  {
    code: 3,
    title: 'Infrastructure & Facilities',
    description: 'Classrooms, WASH, boundary wall, electricity',
  },
  {
    code: 4,
    title: 'Teaching & Learning Materials',
    description: 'Textbooks, charts, teaching aids availability',
  },
  {
    code: 5,
    title: 'School Management & Governance',
    description: 'SMC functionality, timetable, records',
  },
  {
    code: 6,
    title: 'Student Learning Outcomes',
    description: 'Sample test scores, reading/numeracy levels',
  },
  {
    code: 7,
    title: 'Classroom Instruction Quality',
    description: 'Linked to classroom observation rubric',
  },
] as const
