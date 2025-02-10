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
exports.resendOtp = exports.verifyOtpController = exports.signin = exports.signup = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const email_1 = require("../utils/email");
const otp_1 = require("../utils/otp");
const prisma = new client_1.PrismaClient();
// 📌 **Signup with OTP Email Verification**
const signup = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password, username } = req.body;
        // Check if user already exists
        const existingUser = yield prisma.student.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }
        const hashedPassword = yield bcrypt_1.default.hash(password, 10);
        const newUser = yield prisma.student.create({
            data: { email, username, password: hashedPassword },
        });
        // Generate OTP
        const otp = yield (0, otp_1.generateOtp)(newUser.id);
        // Send OTP via email
        yield (0, email_1.sendEmail)(email, "Your OTP Code", `Your OTP is: ${otp}`);
        return res.status(201).json({
            message: "User created. Please verify OTP sent to your email.",
            userId: newUser.id,
        });
    }
    catch (error) {
        return res.status(500).json({
            message: "Signup failed",
            error: error.message,
        });
    }
});
exports.signup = signup;
// 📌 **Verify OTP and Activate Account**
const verifyOtpController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId, otp } = req.body;
        const isValid = yield (0, otp_1.verifyOtp)(userId, otp);
        if (!isValid) {
            return res.status(400).json({ message: "Invalid OTP" });
        }
        // Activate user
        yield prisma.student.update({
            where: { id: userId },
            data: { isVerified: true },
        });
        // Generate JWT Token
        const token = jsonwebtoken_1.default.sign({ userId }, process.env.JWT_SECRET, {
            expiresIn: "7d",
        });
        return res
            .status(200)
            .json({ message: "OTP Verified, Account Activated", token });
    }
    catch (error) {
        return res.status(500).json({
            message: "OTP verification failed",
            error: error.message,
        });
    }
});
exports.verifyOtpController = verifyOtpController;
// 📌 **Signin (Email & Password Login)**
const signin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        // Check if user exists
        const user = yield prisma.student.findUnique({ where: { email } });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        if (!user.isVerified) {
            return res
                .status(403)
                .json({ message: "Account not verified. Please verify OTP." });
        }
        // Compare password
        const isMatch = yield bcrypt_1.default.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        // Generate JWT Token
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET, {
            expiresIn: "7d",
        });
        return res.status(200).json({ message: "Signin successful", token });
    }
    catch (error) {
        return res
            .status(500)
            .json({ message: "Signin failed", error: error.message });
    }
});
exports.signin = signin;
const resendOtp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email } = req.body;
    try {
        const user = yield prisma.student.findUnique({ where: { email } });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const otp = yield (0, otp_1.generateOtp)(user.id);
        // Send OTP via email
        yield (0, email_1.sendEmail)(email, "Your OTP Code", `Your OTP is: ${otp}`);
        return res.status(201).json({
            message: "User created. Please verify OTP sent to your email.",
            userId: user.id,
        });
    }
    catch (error) {
        return res.status(500).json({
            message: "Signup failed",
            error: error.message,
        });
    }
});
exports.resendOtp = resendOtp;
