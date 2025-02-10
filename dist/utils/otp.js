"use strict";
// import Redis from "ioredis";
// const redis = new Redis();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyOtp = exports.generateOtp = void 0;
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
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// 📌 **Generate OTP and Save to Database**
const generateOtp = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // OTP expires in 10 minutes
    yield prisma.student.update({
        where: { id: userId },
        data: { otp, createdAt: expiresAt },
    });
    return otp;
});
exports.generateOtp = generateOtp;
// 📌 **Verify OTP**
const verifyOtp = (userId, otp) => __awaiter(void 0, void 0, void 0, function* () {
    if (!userId) {
        throw new Error("User ID is required");
    }
    const user = yield prisma.student.findUnique({ where: { id: userId } });
    if (!user || user.otp !== otp) {
        return false;
    }
    yield prisma.student.update({
        where: { id: userId },
        data: { otp: null, isVerified: true }, // Clear OTP and mark user as verified
    });
    return true;
});
exports.verifyOtp = verifyOtp;
