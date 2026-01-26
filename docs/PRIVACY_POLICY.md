# ClassPoints Privacy Policy

**Last Updated:** January 2025

## Overview

ClassPoints is a classroom behavior management application designed for teachers. This privacy policy explains what data we collect, how we use it, and how we protect it.

## Data We Collect

### Student Data

- **Student names** (first name or display name as entered by the teacher)
- **Avatar color** (optional visual identifier)
- **Point totals** (cumulative positive and negative points)
- **Seating chart positions** (optional classroom layout)

### Transaction Data

- **Behavior name and points** (e.g., "Helped a classmate +2")
- **Timestamp** (when points were awarded)
- **Optional notes** (teacher-entered context)

### Teacher Data

- **Email address** (for authentication)
- **Display name** (optional profile field)
- **Classroom names** (organizational labels)

## Data We Do NOT Collect

ClassPoints intentionally minimizes data collection. We do **not** collect:

- Student email addresses or contact information
- Parent/guardian information
- Student ID numbers, Social Security numbers, or government IDs
- Academic records, grades, or transcripts
- Demographic information (age, gender, ethnicity)
- Photos, videos, or biometric data
- Health or medical information
- Home addresses or phone numbers
- Device fingerprints or tracking data

## How Data Is Used

Student data is used **exclusively** for:

- Tracking classroom behavior points
- Displaying point history and trends
- Organizing students within classroom views
- Generating seating charts (optional feature)

We do **not**:

- Sell or share data with third parties
- Use data for advertising or marketing
- Analyze data for purposes beyond classroom management
- Retain data after account deletion

## How Data Is Protected

### Technical Security

- **Encryption in transit:** All data is transmitted over HTTPS/TLS
- **Encryption at rest:** Database storage uses AES-256 encryption
- **Row-Level Security (RLS):** Each teacher can only access their own classrooms and students
- **Authentication:** Secure email/password authentication via Supabase Auth

### Access Control

- Only the teacher who created a classroom can view or modify its data
- Students never have accounts or direct access to the system
- No administrative "super user" access to individual teacher data

### Infrastructure

- Hosted on Supabase (built on AWS infrastructure)
- Supabase maintains SOC 2 Type II certification
- Automatic encrypted backups with point-in-time recovery

## Data Retention

- **Active accounts:** Data is retained while the account is active
- **Deleted students:** Removed immediately with cascade to transactions
- **Deleted classrooms:** All associated students and transactions removed
- **Closed accounts:** All data permanently deleted within 30 days

Teachers can export their data at any time and delete individual students, classrooms, or their entire account through the application.

## Student Interaction

ClassPoints is designed for **teacher-only** interaction:

- Students do not create accounts
- Students do not enter any data
- Students may view the teacher's screen during class (visual only)
- No student login, authentication, or direct system access

## FERPA Compliance

ClassPoints supports FERPA compliance for educational institutions:

- Minimal PII collection (names only)
- Teacher-controlled data entry and deletion
- No student accounts or authentication
- Data isolation between teachers
- Export functionality for data portability

Schools can designate ClassPoints as a "school official" under FERPA's school official exception when used for legitimate educational purposes.

## Third-Party Services

ClassPoints uses the following third-party services:

| Service  | Purpose                   | Data Shared                |
| -------- | ------------------------- | -------------------------- |
| Supabase | Database & authentication | All application data       |
| Vercel   | Web hosting               | IP addresses (server logs) |

No data is shared with advertising networks, analytics services, or social media platforms.

## Children's Privacy (COPPA)

ClassPoints is designed for use by teachers (adults). Students interact only by viewing the teacher's screen—they do not create accounts, enter data, or directly interact with the application.

If a school uses ClassPoints for students under 13, the school acts as the parent/guardian under COPPA and provides consent for the teacher's use of student names.

## Your Rights

Teachers have the right to:

- **Access** all data stored about their classrooms
- **Export** data in CSV format at any time
- **Correct** any inaccurate student information
- **Delete** individual students, classrooms, or their entire account
- **Withdraw** consent by closing their account

## Changes to This Policy

We will notify users of material changes to this privacy policy via email and/or in-app notification. Continued use after changes constitutes acceptance of the updated policy.

## Contact

For privacy questions or data requests, contact:

**ClassPoints Support**
Email: [Insert contact email]

---

## Summary for School Administrators

| Question                        | Answer                                |
| ------------------------------- | ------------------------------------- |
| What student data is collected? | Names only (as entered by teacher)    |
| Are student accounts created?   | No                                    |
| Can students access the system? | No (visual only via teacher's screen) |
| Where is data stored?           | Supabase (AWS infrastructure, US)     |
| Is data encrypted?              | Yes (transit and at rest)             |
| Can teachers delete data?       | Yes (immediate deletion)              |
| Is a DPA available?             | Yes (see DPA_TEMPLATE.md)             |
| FERPA compatible?               | Yes                                   |
