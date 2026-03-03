DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'otp_codes'
      AND column_name = 'code'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'otp_codes'
      AND column_name = 'otp_hash'
  ) THEN
    ALTER TABLE "otp_codes" RENAME COLUMN "code" TO "otp_hash";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'otp_codes'
      AND column_name = 'otp_hash'
  ) THEN
    ALTER TABLE "otp_codes"
      ALTER COLUMN "otp_hash" TYPE varchar(128);
  END IF;
END $$;
