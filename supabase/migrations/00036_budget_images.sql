BEGIN;

-- Preserve existing bucket privacy, size limit and any previously allowed types.
UPDATE storage.buckets
SET allowed_mime_types = CASE
  WHEN allowed_mime_types IS NULL THEN NULL
  ELSE ARRAY(
    SELECT DISTINCT mime
    FROM unnest(allowed_mime_types || ARRAY[
      'application/pdf', 'image/jpeg', 'image/png', 'image/webp'
    ]::TEXT[]) AS mime
  )
END
WHERE id = 'budget-pdfs';

COMMIT;
