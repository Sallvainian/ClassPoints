# Data Processing Agreement (DPA) Template

**For use between ClassPoints and Educational Institutions**

---

## Parties

**Data Controller:** ****************\_**************** ("School/District")
Address: ****************\_****************
Contact: ****************\_****************

**Data Processor:** ClassPoints ("Provider")
Contact: [Insert contact email]

**Effective Date:** ****************\_****************

---

## 1. Definitions

- **"Personal Data"** means any information relating to an identified or identifiable student, as entered by School staff into the ClassPoints application.
- **"Processing"** means any operation performed on Personal Data, including collection, storage, use, and deletion.
- **"Student Data"** means Personal Data related to students, limited to names, behavioral point records, and seating chart positions.
- **"Services"** means the ClassPoints classroom behavior management application.

---

## 2. Scope of Data Processing

### 2.1 Data Collected

Provider processes the following categories of Student Data on behalf of School:

| Data Category       | Examples                                 | Purpose                             |
| ------------------- | ---------------------------------------- | ----------------------------------- |
| Student identifiers | First name, display name                 | Identify students in classroom view |
| Behavioral records  | Points awarded/deducted, behavior labels | Track classroom behavior            |
| Organizational data | Seating positions, avatar colors         | Visual classroom management         |

### 2.2 Data NOT Collected

Provider does NOT collect:

- Student email addresses or contact information
- Parent/guardian information
- Social Security numbers or government IDs
- Academic records, grades, or transcripts
- Demographic information
- Health or medical records
- Photos or biometric data

### 2.3 Purpose Limitation

Provider shall process Student Data **only** for:

- Providing the classroom management Services
- Technical support and troubleshooting
- Service improvements (aggregated, de-identified data only)

---

## 3. FERPA Compliance

### 3.1 School Official Designation

School designates Provider as a "school official" with legitimate educational interest under FERPA (34 CFR § 99.31(a)(1)), subject to the following conditions:

- Provider performs institutional services on behalf of School
- Provider is under direct control of School regarding use of education records
- Provider uses Student Data only for authorized purposes
- Provider complies with FERPA's use and re-disclosure requirements

### 3.2 Provider Obligations

Provider agrees to:

- Use Student Data solely for providing Services to School
- Not disclose Student Data to third parties except as authorized
- Maintain reasonable security measures to protect Student Data
- Return or delete Student Data upon termination of this Agreement

---

## 4. Security Measures

Provider implements the following security measures:

### 4.1 Technical Safeguards

- Encryption in transit (TLS 1.2+)
- Encryption at rest (AES-256)
- Row-Level Security (RLS) database policies
- Secure authentication (email/password with rate limiting)

### 4.2 Access Controls

- Teacher accounts isolated from each other
- No student accounts or direct student access
- No administrative "super user" access to individual data

### 4.3 Infrastructure

- Hosted on Supabase (SOC 2 Type II certified)
- Built on AWS infrastructure
- Automatic encrypted backups
- US-based data storage

---

## 5. Subprocessors

Provider uses the following subprocessors:

| Subprocessor  | Service                   | Data Processed           |
| ------------- | ------------------------- | ------------------------ |
| Supabase Inc. | Database & authentication | All application data     |
| Vercel Inc.   | Web hosting               | IP addresses (logs only) |

Provider will notify School of any material changes to subprocessors.

---

## 6. Data Breach Notification

### 6.1 Notification Timeline

In the event of a security breach involving Student Data, Provider shall:

- Notify School within **72 hours** of discovering the breach
- Provide details of the breach, data affected, and remediation steps
- Cooperate with School's investigation and notification requirements

### 6.2 Breach Response

Provider shall:

- Take immediate steps to contain and remediate the breach
- Preserve evidence for investigation
- Provide updates as additional information becomes available

---

## 7. Data Subject Rights

### 7.1 Access and Correction

Provider enables School to fulfill data subject requests by:

- Providing teacher access to all classroom data
- Allowing teachers to edit student information
- Supporting data export in CSV format

### 7.2 Deletion

Provider enables deletion through:

- Individual student deletion (immediate)
- Classroom deletion (immediate, cascades to all students)
- Account deletion (within 30 days)

---

## 8. Data Retention and Return

### 8.1 During Agreement

Provider retains Student Data for the duration of School's use of Services.

### 8.2 Upon Termination

Upon termination of this Agreement, Provider shall:

- Provide School 30 days to export data
- Delete all Student Data within 30 days of termination
- Provide written confirmation of deletion upon request

---

## 9. Audit Rights

School may request:

- Documentation of security measures
- Confirmation of compliance with this Agreement
- Third-party audit reports (e.g., SOC 2) from Provider's infrastructure providers

---

## 10. Term and Termination

### 10.1 Term

This Agreement is effective from the Effective Date and continues until terminated.

### 10.2 Termination

Either party may terminate this Agreement:

- For convenience with 30 days written notice
- Immediately upon material breach by the other party

---

## 11. Limitation of Liability

Provider's liability under this Agreement is limited to:

- Direct damages arising from Provider's breach
- The fees paid by School in the 12 months preceding the claim
- Excludes indirect, consequential, or punitive damages

---

## 12. Governing Law

This Agreement is governed by the laws of the State of ******\_******.

---

## Signatures

**School/District:**

Signature: ****************\_****************
Name: ****************\_****************
Title: ****************\_****************
Date: ****************\_****************

**ClassPoints:**

Signature: ****************\_****************
Name: ****************\_****************
Title: ****************\_****************
Date: ****************\_****************

---

## Exhibit A: Technical and Organizational Measures

### Authentication

- Email/password authentication with secure hashing
- Session management with automatic expiration
- Rate limiting on authentication endpoints

### Authorization

- Row-Level Security (RLS) policies on all database tables
- Teachers can only access their own classrooms and students
- No cross-tenant data access

### Encryption

- TLS 1.2+ for all data in transit
- AES-256 encryption for data at rest
- Encrypted database backups

### Monitoring

- Server access logging
- Error monitoring and alerting
- Regular security updates

### Disaster Recovery

- Automatic daily backups
- Point-in-time recovery capability
- Multi-availability-zone deployment

---

## Exhibit B: Data Flow Diagram

```
┌─────────────┐     HTTPS/TLS     ┌─────────────┐
│   Teacher   │ ────────────────► │  ClassPoints │
│   Browser   │ ◄──────────────── │   (Vercel)   │
└─────────────┘                   └──────┬──────┘
                                         │
                                    HTTPS/TLS
                                         │
                                         ▼
                                  ┌─────────────┐
                                  │   Supabase   │
                                  │  (Database)  │
                                  └─────────────┘
                                         │
                                    Encrypted
                                         │
                                         ▼
                                  ┌─────────────┐
                                  │     AWS      │
                                  │   Storage    │
                                  └─────────────┘
```

**Data at each stage:**

- Teacher Browser: Displays classroom data, no local storage
- ClassPoints (Vercel): Stateless, no data persistence
- Supabase: All application data (encrypted)
- AWS Storage: Encrypted backups only
