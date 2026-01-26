# ClassPoints Security Overview

**For IT Departments and Security Reviews**

---

## Executive Summary

ClassPoints is a classroom behavior management application with a minimal data footprint. It stores only student names and behavioral point records—no sensitive PII, no student accounts, no academic records.

| Security Aspect | Implementation                     |
| --------------- | ---------------------------------- |
| Authentication  | Supabase Auth (email/password)     |
| Authorization   | Row-Level Security (RLS)           |
| Encryption      | TLS in transit, AES-256 at rest    |
| Infrastructure  | Supabase on AWS                    |
| Compliance      | FERPA-compatible, COPPA-compatible |
| Student Access  | None (teacher-only application)    |

---

## Architecture

### Technology Stack

| Component      | Technology            | Security Certifications |
| -------------- | --------------------- | ----------------------- |
| Frontend       | React (Vite)          | N/A (client-side)       |
| Hosting        | Vercel                | SOC 2 Type II           |
| Database       | Supabase PostgreSQL   | SOC 2 Type II           |
| Authentication | Supabase Auth         | SOC 2 Type II           |
| Storage        | AWS S3 (via Supabase) | SOC 2, ISO 27001        |

### Data Flow

```
┌──────────────┐                    ┌──────────────┐
│   Teacher    │───── HTTPS ────────│   Vercel     │
│   Browser    │                    │   (CDN)      │
└──────────────┘                    └──────┬───────┘
                                           │
                                      HTTPS + JWT
                                           │
                                           ▼
                                    ┌──────────────┐
                                    │   Supabase   │
                                    │  PostgreSQL  │
                                    └──────────────┘
```

---

## Authentication

### Method

- Email/password authentication via Supabase Auth
- JWT tokens for session management
- Tokens stored in browser localStorage with httpOnly flag for refresh tokens

### Password Security

- Minimum password requirements enforced
- Passwords hashed using bcrypt
- Rate limiting on authentication endpoints
- Account lockout after repeated failed attempts

### Session Management

- JWT access tokens (short-lived)
- Refresh tokens for session continuity
- Automatic token refresh
- Explicit logout capability

---

## Authorization

### Row-Level Security (RLS)

Every database table has RLS policies ensuring teachers can only access their own data:

```sql
-- Example: Students table policy
CREATE POLICY "Teachers can only view their own students"
ON students FOR SELECT
USING (
  classroom_id IN (
    SELECT id FROM classrooms WHERE user_id = auth.uid()
  )
);
```

### Data Isolation

| Resource       | Access Control                      |
| -------------- | ----------------------------------- |
| Classrooms     | Only creator (user_id = auth.uid()) |
| Students       | Only via parent classroom           |
| Transactions   | Only via parent classroom           |
| Behaviors      | Only creator                        |
| Seating Charts | Only via parent classroom           |

### No Cross-Tenant Access

- Teachers cannot see other teachers' data
- No shared classrooms or collaborative features
- No administrative access to individual teacher data

---

## Encryption

### In Transit

- **Protocol:** TLS 1.2+ (TLS 1.3 preferred)
- **All connections:** HTTPS enforced
- **API calls:** Encrypted between browser and Supabase
- **Certificate management:** Handled by Vercel and Supabase

### At Rest

- **Database:** AES-256 encryption
- **Backups:** Encrypted with separate keys
- **Key management:** Handled by Supabase/AWS KMS

---

## Infrastructure Security

### Supabase (Database Provider)

- SOC 2 Type II certified
- Built on AWS infrastructure
- Automated security patching
- DDoS protection
- Network isolation between projects

### Vercel (Hosting Provider)

- SOC 2 Type II certified
- Edge network with global CDN
- Automatic HTTPS provisioning
- No persistent data storage

### AWS (Underlying Infrastructure)

- ISO 27001 certified
- SOC 1/2/3 certified
- FedRAMP authorized
- Physical security controls

---

## Data Protection

### What We Store

| Data Type           | Storage Location | Encryption      | Retention                |
| ------------------- | ---------------- | --------------- | ------------------------ |
| Teacher credentials | Supabase Auth    | Hashed (bcrypt) | Until account deletion   |
| Student names       | Supabase DB      | AES-256         | Until deleted by teacher |
| Point transactions  | Supabase DB      | AES-256         | Until deleted by teacher |
| Seating charts      | Supabase DB      | AES-256         | Until deleted by teacher |

### What We DON'T Store

- Student passwords or accounts (students don't log in)
- Academic records or grades
- Sensitive PII (SSN, government IDs)
- Contact information (addresses, phone numbers)
- Health or demographic data
- Biometric data or photos

### Data Minimization

ClassPoints follows data minimization principles:

- Only student names are required
- Avatar colors are optional
- Notes on transactions are optional
- No mandatory demographic fields

---

## Vulnerability Management

### Application Security

- Dependencies monitored via Dependabot
- Regular npm audit for JavaScript dependencies
- TypeScript for type safety
- Input validation on all user inputs

### Infrastructure Security

- Managed by Supabase and Vercel
- Automatic security updates
- 24/7 monitoring by platform providers

### Security Testing

- Static code analysis via ESLint security plugins
- Type checking prevents common vulnerabilities
- No SQL injection risk (parameterized queries via Supabase client)
- XSS protection via React's default escaping

---

## Incident Response

### Breach Notification

- Discovery within 24 hours
- Assessment within 48 hours
- Notification to affected users within 72 hours
- Coordination with school IT departments

### Response Steps

1. Contain the incident
2. Assess scope and impact
3. Notify affected parties
4. Remediate vulnerability
5. Post-incident review

---

## Compliance

### FERPA

- Supports "school official" exception
- Minimal PII collection
- Teacher-controlled data management
- Data export and deletion capabilities

### COPPA

- Teacher-only application (no child accounts)
- Schools provide consent for student name usage
- No direct collection from children

### State Privacy Laws

- Compatible with state student privacy laws
- Data localization: US-based storage
- Export functionality for data portability

---

## Audit Capabilities

### Available Documentation

- This security overview
- Privacy policy
- Data Processing Agreement (DPA) template
- Supabase SOC 2 Type II report (via Supabase)
- Vercel SOC 2 Type II report (via Vercel)

### Logging

- Authentication events logged
- API access logged at infrastructure level
- No application-level user activity logging

---

## Contact

For security questions or to report vulnerabilities:

**Security Contact:** [Insert security email]

For responsible disclosure, please include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact assessment

---

## Appendix: Security Checklist for IT Departments

### Pre-Deployment

- [ ] Review Privacy Policy
- [ ] Review this Security Overview
- [ ] Execute DPA if required by district policy
- [ ] Verify data storage location meets requirements
- [ ] Confirm FERPA school official exception applies

### Ongoing

- [ ] Monitor for security notifications from ClassPoints
- [ ] Review teacher access periodically
- [ ] Ensure teachers understand data deletion procedures
- [ ] Include in annual security awareness training

### Offboarding

- [ ] Export data if needed for records retention
- [ ] Confirm account and data deletion
- [ ] Request deletion confirmation in writing
