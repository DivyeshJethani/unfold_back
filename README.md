# Cognify Backend

Backend for **Cognify**, an adaptive learning platform designed to understand how individual students learn and continuously personalize their learning journey.

Cognify collects learning interactions, assessment performance, confidence, engagement, and mastery signals to build a dynamic **Learning DNA** for each student. This data is used to generate explainable, personalized learning recommendations.

## How Cognify Works

Student Learning Activity
↓
Interaction & Assessment Data
↓
Behavioral Feature Extraction
↓
Learning DNA & Topic Mastery
↓
Adaptive Recommendation Engine
↓
Personalized Learning Intervention
↓
New Student Evidence
↓
Updated Learning DNA

The system continuously updates its understanding of the student as new learning evidence is generated.

## Core Capabilities

### Authentication
- Student registration and login
- JWT-based authentication
- Password hashing using bcrypt
- Protected API routes
- Student-specific data isolation

### Curriculum
- Subjects
- Topics
- Lectures
- Questions and assessments
- Structured curriculum resources

### Learning Interaction Tracking

Cognify records learning interactions such as:

- Play
- Pause
- Seek
- Rewind
- Fast-forward
- Playback progress
- Replay
- Completion

These events form the behavioural evidence used by the adaptive system.

### Assessment & Mastery

- Quiz attempts and answers
- Question-level performance
- Confidence records
- Topic mastery
- Mastery history
- Longitudinal mastery trajectories

### Behavioral Intelligence

The backend derives learning signals including:

- Watch time
- Completion rate
- Pause and rewind behaviour
- Rewatch tendency
- Playback speed
- Quiz accuracy
- Response time
- Accuracy trends
- Mistake patterns
- Confidence calibration
- Engagement and struggle signals

### Learning DNA

Cognify maintains longitudinal learning signals that help represent how a student is progressing across topics over time.

The Learning DNA can incorporate:

- Topic mastery
- Learning behaviour
- Assessment performance
- Confidence
- Engagement
- Struggle patterns
- Improvement trajectories

### Adaptive Recommendations

The recommendation engine uses persisted student evidence to generate explainable learning recommendations based on factors such as:

- Weak topics
- Topic mastery
- Recent performance
- Learning behaviour
- Struggle signals
- Previous learning evidence
- Available curriculum resources

Recommendations are generated from the student's stored learning data rather than fabricated student profiles.

## Technology Stack

### Backend
- Node.js
- NestJS
- TypeScript

### Database
- PostgreSQL
- Prisma ORM

### Authentication & Security
- JWT
- Passport
- bcrypt

### Background Processing
- Redis
- BullMQ

### API & Development
- REST APIs
- Swagger / OpenAPI
- Jest
- Docker

## Architecture

```text
                   Cognify Frontend
                         |
                         v
                   NestJS API
                   + JWT Auth
                         |
        +----------------+----------------+
        |                |                |
        v                v                v
 Interaction        Assessment       Curriculum
  Tracking            Data              Data
        |                |                |
        +----------------+----------------+
                         |
                         v
                    PostgreSQL
                      + Prisma
                         |
                         v
                Behavioral Features
                    & Mastery
                         |
                         v
                    Learning DNA
                         |
                         v
              Recommendation Engine
                         |
                         v
             Personalized Intervention
