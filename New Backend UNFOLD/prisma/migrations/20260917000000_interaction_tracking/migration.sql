-- AlterEnum
ALTER TYPE "VideoEventType" ADD VALUE 'SEEK';
ALTER TYPE "VideoEventType" ADD VALUE 'FORWARD';
ALTER TYPE "VideoEventType" ADD VALUE 'PROGRESS';
ALTER TYPE "VideoEventType" ADD VALUE 'WATCH_PROGRESS';
ALTER TYPE "VideoEventType" ADD VALUE 'REPLAY';

-- CreateIndex
CREATE INDEX "VideoInteractionEvent_studentId_createdAt_idx" ON "VideoInteractionEvent"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "QuizAttempt_studentId_startedAt_idx" ON "QuizAttempt"("studentId", "startedAt");

-- CreateIndex
CREATE INDEX "QuizAnswer_attemptId_idx" ON "QuizAnswer"("attemptId");

-- CreateIndex
CREATE INDEX "QuizAnswer_questionId_idx" ON "QuizAnswer"("questionId");

-- CreateIndex
CREATE INDEX "ConfidenceRecord_studentId_topicId_idx" ON "ConfidenceRecord"("studentId", "topicId");

-- CreateIndex
CREATE INDEX "ConfidenceRecord_studentId_createdAt_idx" ON "ConfidenceRecord"("studentId", "createdAt");
