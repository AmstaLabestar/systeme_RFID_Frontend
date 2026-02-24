-- Remove legacy WhatsApp OTP/two-factor challenge persistence.
DROP TABLE IF EXISTS "otp_requests" CASCADE;
DROP TABLE IF EXISTS "two_factor_challenges" CASCADE;

DROP TYPE IF EXISTS "OtpPurpose";
DROP TYPE IF EXISTS "OtpChannel";
