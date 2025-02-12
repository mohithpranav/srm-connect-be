"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyOtp = exports.generateOtp = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const redis = new ioredis_1.default();
// Generate OTP and store in Redis
const generateOtp = (email) => __awaiter(void 0, void 0, void 0, function* () {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    // Store OTP with email as key for 10 minutes
    yield redis.set(`otp:${email}`, otp, "EX", 600);
    return otp;
});
exports.generateOtp = generateOtp;
// Verify OTP from Redis
const verifyOtp = (email, inputOtp) => __awaiter(void 0, void 0, void 0, function* () {
    const storedOtp = yield redis.get(`otp:${email}`);
    if (storedOtp === inputOtp) {
        yield redis.del(`otp:${email}`); // Delete OTP after successful verification
        return true;
    }
    return false;
});
exports.verifyOtp = verifyOtp;
