// import Redis from "ioredis";
// const redis = new Redis();

// Generate OTP
// export const generateOtp = async (userId: number) => {
//   const otp = Math.floor(100000 + Math.random() * 900000).toString();
//   await redis.set(`otp:${userId}`, otp, "EX", 300); // Store OTP for 5 minutes
//   return otp;
// };

// Verify OTP
// export const verifyOtp = async (userId: number, inputOtp: string) => {
//   const storedOtp = await redis.get(`otp:${userId}`);
//   if (storedOtp === inputOtp) {
//     await redis.del(`otp:${userId}`); // Delete OTP after use
//     return true;
//   }
//   return false;
// };

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// 📌 **Generate OTP and Save to Database**
export const generateOtp = async (userId: number): Promise<string> => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // OTP expires in 10 minutes

  await prisma.student.update({
    where: { id: userId },
    data: { otp, createdAt: expiresAt },
  });

  return otp;
};

// 📌 **Verify OTP**
export const verifyOtp = async (
  userId: number | undefined,
  otp: string
): Promise<boolean> => {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const user = await prisma.student.findUnique({ where: { id: userId } });

  if (!user || user.otp !== otp) {
    return false;
  }

  await prisma.student.update({
    where: { id: userId },
    data: { otp: null, isVerified: true }, // Clear OTP and mark user as verified
  });

  return true;
};
