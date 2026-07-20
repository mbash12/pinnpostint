-- Move booking support toggle from category to subcategory level
ALTER TABLE "subcategories"
ADD COLUMN "supportsBooking" BOOLEAN NOT NULL DEFAULT false;
