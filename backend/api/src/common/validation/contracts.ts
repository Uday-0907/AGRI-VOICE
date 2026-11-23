import { Type } from '@sinclair/typebox';

export const UserRegistrationSchema = Type.Object({
  phone: Type.String({ pattern: '^\+[1-9][0-9]{7,14}$' }), // Basic E.164
});

export const OtpVerificationSchema = Type.Object({
  phone: Type.String({ pattern: '^\+[1-9][0-9]{7,14}$' }),
  otp: Type.String({ pattern: '^[0-9]{6}$' }),
});
