-- Per-stage "Is this a section title?" answers. Asked only when the stage
-- answered NO to "Is this a title page?"; NULL means the question was not
-- applicable (title page = YES) or the task predates this feature.
ALTER TABLE "Task" ADD COLUMN "is_section_title" BOOLEAN;
ALTER TABLE "Task" ADD COLUMN "reviewed_is_section_title" BOOLEAN;
ALTER TABLE "Task" ADD COLUMN "final_is_section_title" BOOLEAN;
