-- CreateEnum
CREATE TYPE "VideoEventType" AS ENUM ('PLAY', 'PAUSE', 'REWIND', 'FAST_FORWARD', 'SKIP_SECTION', 'SPEED_CHANGE', 'COMPLETE', 'DROP_OFF');

-- CreateEnum
CREATE TYPE "MistakeType" AS ENUM ('NONE', 'CONCEPT', 'CALCULATION', 'MEMORY', 'LOGIC', 'CARELESS');

-- CreateEnum
CREATE TYPE "RevisionTestTrigger" AS ENUM ('POST_LECTURE', 'WEAKNESS_DETECTED', 'SCHEDULED_REVIEW');

-- CreateEnum
CREATE TYPE "MasteryLevel" AS ENUM ('WEAK', 'DEVELOPING', 'PROFICIENT', 'STRONG');

-- CreateEnum
CREATE TYPE "PeerTeachingOutcome" AS ENUM ('PENDING', 'IMPROVED', 'NOT_IMPROVED', 'ESCALATED_TO_PEER');

-- CreateEnum
CREATE TYPE "CreditReason" AS ENUM ('QUIZ_COMPLETED', 'REVISION_TEST_PASSED', 'TAUGHT_AI_SUCCESSFULLY', 'TAUGHT_PEER_SUCCESSFULLY', 'PEER_IMPROVED_AFTER_TEACHING', 'STREAK_BONUS', 'WELL_CALIBRATED_CONFIDENCE', 'REDEEMED');

-- CreateEnum
CREATE TYPE "TeachingFormat" AS ENUM ('TEXT', 'VIDEO', 'DIAGRAM', 'EXAMPLE', 'SIMULATION');

-- CreateEnum
CREATE TYPE "StruggleAction" AS ENUM ('RETRIED', 'USED_HINT', 'SWITCHED_METHOD', 'VIEWED_SOLUTION', 'GAVE_UP', 'PERSISTED_TO_CORRECT');

-- CreateEnum
CREATE TYPE "StretchGoalStatus" AS ENUM ('SUGGESTED', 'ACCEPTED', 'DECLINED', 'ACHIEVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'STUDENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "standardId" TEXT NOT NULL,
    "streamId" TEXT,
    "boardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "prerequisiteTopicId" TEXT,
    "difficultyBaseline" DOUBLE PRECISION NOT NULL DEFAULT 0.5,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lecture" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "durationSec" INTEGER NOT NULL,

    CONSTRAINT "Lecture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoInteractionEvent" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "eventType" "VideoEventType" NOT NULL,
    "atSecond" INTEGER NOT NULL,
    "toSecond" INTEGER,
    "playbackSpeed" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoInteractionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizQuestion" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctOptionId" TEXT NOT NULL,
    "difficulty" DOUBLE PRECISION NOT NULL DEFAULT 0.5,

    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "score" DOUBLE PRECISION,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOptionId" TEXT,
    "isCorrect" BOOLEAN NOT NULL,
    "timeTakenMs" INTEGER NOT NULL,
    "mistakeType" "MistakeType" NOT NULL DEFAULT 'NONE',
    "workingText" TEXT,

    CONSTRAINT "QuizAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevisionTest" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "triggeredBy" "RevisionTestTrigger" NOT NULL,
    "questions" JSONB NOT NULL,
    "responses" JSONB,
    "score" DOUBLE PRECISION,
    "nemotronFeedback" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RevisionTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "examName" TEXT NOT NULL,
    "marksObtained" DOUBLE PRECISION NOT NULL,
    "maxMarks" DOUBLE PRECISION NOT NULL,
    "examDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoCurricularRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "activityName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "achievedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "CoCurricularRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicMastery" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "masteryScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "masteryLevel" "MasteryLevel" NOT NULL DEFAULT 'DEVELOPING',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "lastEvaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "dominantMistakeType" "MistakeType",

    CONSTRAINT "TopicMastery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttentionProfile" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "estimatedAttentionSpanSec" INTEGER NOT NULL DEFAULT 900,
    "memoryRetentionScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "bestFocusWindowStart" INTEGER,
    "bestFocusWindowEnd" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttentionProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "standardId" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyGroupMember" (
    "id" TEXT NOT NULL,
    "studyGroupId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeerTeachingSession" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "tutorId" TEXT,
    "isAiTutor" BOOLEAN NOT NULL DEFAULT false,
    "tuteeId" TEXT NOT NULL,
    "transcript" JSONB,
    "nemotronEvaluation" JSONB,
    "outcome" "PeerTeachingOutcome" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "PeerTeachingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditWallet" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "lifetimeEarned" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" "CreditReason" NOT NULL,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardCatalogItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "creditCost" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RewardCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfidenceRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "refType" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "predictedConfidence" DOUBLE PRECISION NOT NULL,
    "wasCorrect" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfidenceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeachingContent" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "format" "TeachingFormat" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,

    CONSTRAINT "TeachingContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormatEffectiveness" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "format" "TeachingFormat" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "avgScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormatEffectiveness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StruggleEvent" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "questionId" TEXT,
    "action" "StruggleAction" NOT NULL,
    "secondsStuckBefore" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StruggleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpacedRetentionCheck" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "intervalDays" INTEGER NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "score" DOUBLE PRECISION,

    CONSTRAINT "SpacedRetentionCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningDnaProfile" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "learningSpeed" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "memoryRetention" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "attentionSpanSec" INTEGER NOT NULL DEFAULT 900,
    "problemSolvingScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "confidenceCalibration" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "resilienceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "preferredFormat" "TeachingFormat",
    "dominantMistakePattern" "MistakeType",
    "summary" TEXT NOT NULL,
    "rawSnapshot" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningDnaProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StretchGoal" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "originalGoalPercent" DOUBLE PRECISION NOT NULL,
    "projectedCapabilityPercent" DOUBLE PRECISION NOT NULL,
    "status" "StretchGoalStatus" NOT NULL DEFAULT 'SUGGESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "StretchGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");

-- CreateIndex
CREATE INDEX "Student_standardId_boardId_idx" ON "Student"("standardId", "boardId");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_code_key" ON "Subject"("code");

-- CreateIndex
CREATE INDEX "Topic_subjectId_idx" ON "Topic"("subjectId");

-- CreateIndex
CREATE INDEX "Lecture_topicId_idx" ON "Lecture"("topicId");

-- CreateIndex
CREATE INDEX "VideoInteractionEvent_studentId_lectureId_idx" ON "VideoInteractionEvent"("studentId", "lectureId");

-- CreateIndex
CREATE INDEX "VideoInteractionEvent_lectureId_atSecond_idx" ON "VideoInteractionEvent"("lectureId", "atSecond");

-- CreateIndex
CREATE INDEX "RevisionTest_studentId_lectureId_idx" ON "RevisionTest"("studentId", "lectureId");

-- CreateIndex
CREATE INDEX "TopicMastery_studentId_needsReview_idx" ON "TopicMastery"("studentId", "needsReview");

-- CreateIndex
CREATE UNIQUE INDEX "TopicMastery_studentId_topicId_key" ON "TopicMastery"("studentId", "topicId");

-- CreateIndex
CREATE UNIQUE INDEX "AttentionProfile_studentId_key" ON "AttentionProfile"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyGroupMember_studyGroupId_studentId_key" ON "StudyGroupMember"("studyGroupId", "studentId");

-- CreateIndex
CREATE INDEX "PeerTeachingSession_tuteeId_topicId_idx" ON "PeerTeachingSession"("tuteeId", "topicId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditWallet_studentId_key" ON "CreditWallet"("studentId");

-- CreateIndex
CREATE INDEX "TeachingContent_topicId_format_idx" ON "TeachingContent"("topicId", "format");

-- CreateIndex
CREATE UNIQUE INDEX "FormatEffectiveness_studentId_topicId_format_key" ON "FormatEffectiveness"("studentId", "topicId", "format");

-- CreateIndex
CREATE INDEX "SpacedRetentionCheck_studentId_scheduledFor_idx" ON "SpacedRetentionCheck"("studentId", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "LearningDnaProfile_studentId_key" ON "LearningDnaProfile"("studentId");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lecture" ADD CONSTRAINT "Lecture_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoInteractionEvent" ADD CONSTRAINT "VideoInteractionEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoInteractionEvent" ADD CONSTRAINT "VideoInteractionEvent_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionTest" ADD CONSTRAINT "RevisionTest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionTest" ADD CONSTRAINT "RevisionTest_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamRecord" ADD CONSTRAINT "ExamRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoCurricularRecord" ADD CONSTRAINT "CoCurricularRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicMastery" ADD CONSTRAINT "TopicMastery_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicMastery" ADD CONSTRAINT "TopicMastery_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttentionProfile" ADD CONSTRAINT "AttentionProfile_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGroupMember" ADD CONSTRAINT "StudyGroupMember_studyGroupId_fkey" FOREIGN KEY ("studyGroupId") REFERENCES "StudyGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGroupMember" ADD CONSTRAINT "StudyGroupMember_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeerTeachingSession" ADD CONSTRAINT "PeerTeachingSession_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeerTeachingSession" ADD CONSTRAINT "PeerTeachingSession_tuteeId_fkey" FOREIGN KEY ("tuteeId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditWallet" ADD CONSTRAINT "CreditWallet_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfidenceRecord" ADD CONSTRAINT "ConfidenceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfidenceRecord" ADD CONSTRAINT "ConfidenceRecord_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingContent" ADD CONSTRAINT "TeachingContent_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormatEffectiveness" ADD CONSTRAINT "FormatEffectiveness_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormatEffectiveness" ADD CONSTRAINT "FormatEffectiveness_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StruggleEvent" ADD CONSTRAINT "StruggleEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StruggleEvent" ADD CONSTRAINT "StruggleEvent_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpacedRetentionCheck" ADD CONSTRAINT "SpacedRetentionCheck_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpacedRetentionCheck" ADD CONSTRAINT "SpacedRetentionCheck_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningDnaProfile" ADD CONSTRAINT "LearningDnaProfile_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StretchGoal" ADD CONSTRAINT "StretchGoal_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
