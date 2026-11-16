import { ForgotPasswordRequest, ForgotPasswordResponse } from "@opsengine/api-contracts";
import { authRepository } from "../repositories/auth.repository";
import { generateOtp } from "../lib/crypto";
import { sendOtpEmail } from "../lib/ses";

export const OTP_EXPIRY_MINUTES = 10;

export async function forgotPasswordUseCase(input: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
  const { emailOrUsername, purpose } = input;

  // Find user by email or username within any tenant (root recovery channel)
  const user = await authRepository.findUserByEmailOrUsername(emailOrUsername);

  // Don't reveal whether user exists — return success anyway for security
  if (!user) {
    return { codeSent: true, expiresInMinutes: OTP_EXPIRY_MINUTES };
  }

  // Only root/superadmin can use this recovery channel
  if (!user.is_root_admin && !user.is_superadmin) {
    return { codeSent: true, expiresInMinutes: OTP_EXPIRY_MINUTES };
  }

  // Generate and store OTP (tenant-scoped)
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await authRepository.createOtpCode({
    tenantId: user.tenant_id,
    userId: user.id,
    code,
    purpose,
    expiresAt,
  });

  // Send via AWS SES
  await sendOtpEmail({
    to: user.email,
    code,
    expiresInMinutes: OTP_EXPIRY_MINUTES,
  });

  return { codeSent: true, expiresInMinutes: OTP_EXPIRY_MINUTES };
}
