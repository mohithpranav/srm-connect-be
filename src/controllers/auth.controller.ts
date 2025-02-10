import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { sendEmail } from "../utils/email";
import { generateOtp, verifyOtp } from "../utils/otp";

const prisma = new PrismaClient();

// 📌 **Signup with OTP Email Verification**
const signup = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password, username } = req.body;

    // Check if user already exists
    const existingUser = await prisma.student.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.student.create({
      data: { email, username, password: hashedPassword },
    });

    // Generate OTP
    const otp = await generateOtp(newUser.id);

    // Send OTP via email
    await sendEmail(email, "Your OTP Code", `Your OTP is: ${otp}`);

    return res.status(201).json({
      message: "User created. Please verify OTP sent to your email.",
      userId: newUser.id,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Signup failed",
      error: (error as any).message,
    });
  }
};

// 📌 **Verify OTP and Activate Account**
const verifyOtpController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { userId, otp } = req.body;

    const isValid = await verifyOtp(userId, otp);
    if (!isValid) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Activate user
    await prisma.student.update({
      where: { id: userId },
      data: { isVerified: true },
    });

    // Generate JWT Token
    const token = jwt.sign({ userId }, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });

    return res
      .status(200)
      .json({ message: "OTP Verified, Account Activated", token });
  } catch (error) {
    return res.status(500).json({
      message: "OTP verification failed",

      error: (error as any).message,
    });
  }
};

// 📌 **Signin (Email & Password Login)**
const signin = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await prisma.student.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.isVerified) {
      return res
        .status(403)
        .json({ message: "Account not verified. Please verify OTP." });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate JWT Token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });

    return res.status(200).json({ message: "Signin successful", token });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Signin failed", error: (error as any).message });
  }
};

const resendOtp = async (req: Request, res: Response): Promise<any> => {
  const { email } = req.body;
  try {
    const user = await prisma.student.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const otp = await generateOtp(user.id);

    // Send OTP via email
    await sendEmail(email, "Your OTP Code", `Your OTP is: ${otp}`);

    return res.status(201).json({
      message: "User created. Please verify OTP sent to your email.",
      userId: user.id,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Signup failed",
      error: (error as any).message,
    });
  }
};

export { signup, signin, verifyOtpController, resendOtp };
