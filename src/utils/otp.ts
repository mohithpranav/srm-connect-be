import Redis from "ioredis";
const redis = new Redis();

// Generate OTP and store in Redis
export const generateOtp = async (email: string): Promise<string> => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  // Store OTP with email as key for 10 minutes
  await redis.set(`otp:${email}`, otp, "EX", 600);
  return otp;
};

// Verify OTP from Redis
export const verifyOtp = async (
  email: string,
  inputOtp: string
): Promise<boolean> => {
  const storedOtp = await redis.get(`otp:${email}`);
  if (storedOtp === inputOtp) {
    await redis.del(`otp:${email}`); // Delete OTP after successful verification
    return true;
  }
  return false;
};
