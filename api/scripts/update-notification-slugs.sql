-- Add slug to existing ad notifications
UPDATE "Notification" 
SET "data" = jsonb_set(
  jsonb_set(
    "data",
    '{adId}',
    COALESCE(("data"->>'adId')::text, ('"id": ' || "data"->>'adId')::jsonb)
  ),
  '{adSlug}',
  (
    SELECT slug FROM "Ad" 
    WHERE "Ad"."id" = (("data"->>'adId')::uuid)
  )
)
WHERE type IN ('AD_APPROVED', 'AD_REJECTED') 
  AND "data"->>'adId' IS NOT NULL
  AND "data"->>'adSlug' IS NULL;