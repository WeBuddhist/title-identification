-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TRANSCRIBER', 'REVIEWER', 'FINAL_REVIEWER');

-- CreateEnum
CREATE TYPE "State" AS ENUM ('transcribing', 'trashed', 'submitted', 'accepted', 'finalised');

-- CreateTable
CREATE TABLE "Group" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "group_id" INTEGER NOT NULL,
    "state" "State" NOT NULL DEFAULT 'transcribing',
    "transcriber_id" INTEGER,
    "reviewer_id" INTEGER,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "duration" TEXT,
    "batch_id" VARCHAR(255) NOT NULL,
    "final_reviewer_id" INTEGER,
    "final_reviewed_at" TIMESTAMP(3),
    "final_reviewer_rejected_count" INTEGER DEFAULT 0,
    "reviewer_rejected_count" INTEGER DEFAULT 0,
    "image_name" TEXT,
    "url" TEXT NOT NULL,
    "diplomatic_context" TEXT NOT NULL,
    "normalised_context" TEXT NOT NULL,
    "is_title_page" BOOLEAN,
    "corrected_diplomatic" TEXT,
    "corrected_normalised" TEXT,
    "reviewed_is_title" BOOLEAN,
    "reviewed_diplomatic" TEXT,
    "reviewed_normalised" TEXT,
    "final_is_title" BOOLEAN,
    "final_diplomatic" TEXT,
    "final_normalised" TEXT,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "group_id" INTEGER NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'TRANSCRIBER',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Task_group_id_state_transcriber_id_idx" ON "Task"("group_id", "state", "transcriber_id");

-- CreateIndex
CREATE INDEX "Task_group_id_state_reviewer_id_idx" ON "Task"("group_id", "state", "reviewer_id");

-- CreateIndex
CREATE INDEX "Task_group_id_state_final_reviewer_id_idx" ON "Task"("group_id", "state", "final_reviewer_id");

-- CreateIndex
CREATE INDEX "Task_group_id_state_batch_id_idx" ON "Task"("group_id", "state", "batch_id");

-- CreateIndex
CREATE INDEX "Task_transcriber_id_state_group_id_idx" ON "Task"("transcriber_id", "state", "group_id");

-- CreateIndex
CREATE INDEX "Task_reviewer_id_state_group_id_idx" ON "Task"("reviewer_id", "state", "group_id");

-- CreateIndex
CREATE INDEX "Task_final_reviewer_id_state_group_id_idx" ON "Task"("final_reviewer_id", "state", "group_id");

-- Partial indexes for the unassigned-task assignment hot path (see src/model/action.js)
CREATE INDEX "Task_unassigned_transcriber_idx" ON "Task"("group_id", "state", "batch_id") WHERE "transcriber_id" IS NULL;

CREATE INDEX "Task_unassigned_reviewer_idx" ON "Task"("group_id", "state", "batch_id") WHERE "reviewer_id" IS NULL;

CREATE INDEX "Task_unassigned_final_reviewer_idx" ON "Task"("group_id", "state", "batch_id") WHERE "final_reviewer_id" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_name_key" ON "User"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_transcriber_id_fkey" FOREIGN KEY ("transcriber_id") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_final_reviewer_id_fkey" FOREIGN KEY ("final_reviewer_id") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
