ALTER TABLE "Participant" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'EMPLOYEE';

ALTER TABLE "Winner" ADD COLUMN "prizeName" TEXT;
ALTER TABLE "Winner" ADD COLUMN "prizeCategory" TEXT;

CREATE TABLE "Prize" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "remaining" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Prize_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Prize_eventId_category_idx" ON "Prize"("eventId", "category");
