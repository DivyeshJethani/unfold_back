-- CreateTable
CREATE TABLE "TopicMasteryHistory" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "masteryScore" DOUBLE PRECISION NOT NULL,
    "masteryLevel" "MasteryLevel" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "needsReview" BOOLEAN NOT NULL,
    "dominantMistakeType" "MistakeType",
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicMasteryHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TopicMasteryHistory_studentId_topicId_recordedAt_idx" ON "TopicMasteryHistory"("studentId", "topicId", "recordedAt");

-- CreateIndex
CREATE INDEX "TopicMasteryHistory_studentId_recordedAt_idx" ON "TopicMasteryHistory"("studentId", "recordedAt");

-- AddForeignKey
ALTER TABLE "TopicMasteryHistory" ADD CONSTRAINT "TopicMasteryHistory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicMasteryHistory" ADD CONSTRAINT "TopicMasteryHistory_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
