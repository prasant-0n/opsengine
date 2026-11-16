import { VerifyOtpRequest, VerifyOtpResponse } from "@opsengine/api-contracts";
import { authRepository } from "../repositories/auth.repository";

export async function verifyOtpUseCase(input: VerifyOtpRequest): Promise<VerifyOtpResponse> {
  const { code, purpose } = input;

  const otp = await authRepository.findValidOtp(code, purpose);
  if (!otp) {
    throw new Error("Invalid or expired code");
  }

  // Mark OTP as used (single-use)
  await authRepository.markOtpUsed(otp.id);

  // Issue a reset token scoped to the tenant/user
  const resetToken = await authRepository.createResetToken({
    userId: otp.user_id,
    tenantId: otp.tenant_id,
  });

  return { verified: true, resetToken: resetToken.token };
}
