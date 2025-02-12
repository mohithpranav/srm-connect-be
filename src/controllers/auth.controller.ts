import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { sendEmail } from "../utils/email";
import { generateOtp, verifyOtp } from "../utils/otp";
import Redis from "ioredis";

const prisma = new PrismaClient();
const redis = new Redis();

// Step 1: Store user data in Redis and send OTP
const initiateSignup = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password, firstName, lastName, username, gender } = req.body;

    // Validate required fields
    if (
      !firstName ||
      !lastName ||
      !email ||
      !password ||
      !username ||
      !gender
    ) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    // Check if user already exists
    const existingUser = await prisma.student.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      return res.status(400).json({
        message:
          existingUser.email === email
            ? "Email already registered"
            : "Username already taken",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Store user data in Redis temporarily (10 minutes)
    const userData = {
      firstName,
      lastName,
      email,
      username,
      password: hashedPassword,
      gender,
    };

    await redis.set(`userData:${email}`, JSON.stringify(userData), "EX", 600);

    // Generate and send OTP
    const otp = await generateOtp(email);
    await sendEmail(
      email,
      "Verify Your Email",
      `Welcome to SRM Connect! Your verification code is: ${otp}`
    );

    const student = await prisma.student.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        username,
        gender,
        otp: otp,
      },
    });

    return res.status(201).json({
      message: "Please verify your email to complete signup",
      email,
    });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({
      message: "Signup failed",
      error: (error as any).message,
    });
  }
};

// Step 2: Verify OTP and create user
const verifyOtpController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        message: "Email and OTP are required",
      });
    }

    // Verify OTP
    const isValid = await verifyOtp(email, otp);
    if (!isValid) {
      return res.status(400).json({
        message: "Invalid or expired OTP",
      });
    }

    // Find and update the existing user instead of creating a new one
    const user = await prisma.student.update({
      where: { email },
      data: { isVerified: true },
    });

    // Generate JWT Token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });

    return res.status(200).json({
      message: "Email verified successfully",
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        gender: user.gender,
      },
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    return res.status(500).json({
      message: "Verification failed",
      error: (error as any).message,
    });
  }
};

// Step 3: Sign in
const signin = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    // Check if user exists
    const user = await prisma.student.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        message: "Please verify your email first",
        userId: user.id,
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    // Generate JWT Token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });

    // Update online status
    await prisma.student.update({
      where: { id: user.id },
      data: { isOnline: true },
    });

    return res.status(200).json({
      message: "Signin successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        gender: user.gender,
      },
    });
  } catch (error) {
    console.error("Signin error:", error);
    return res.status(500).json({
      message: "Signin failed",
      error: (error as any).message,
    });
  }
};

// Resend OTP
const resendOtp = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    // Check if we have userData in Redis (meaning they started signup)
    const userDataString = await redis.get(`userData:${email}`);
    if (!userDataString) {
      return res.status(404).json({
        message: "No pending registration found for this email",
      });
    }

    // Generate and send new OTP
    const otp = await generateOtp(email);
    await sendEmail(
      email,
      "Your New Verification Code",
      `Your new verification code is: ${otp}`
    );

    return res.status(200).json({
      message: "New OTP sent successfully",
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    return res.status(500).json({
      message: "Failed to resend OTP",
      error: (error as any).message,
    });
  }
};

// Initiate forgot password process
const forgotPassword = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    // Check if user exists
    const user = await prisma.student.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({
        message: "No account found with this email",
      });
    }

    // Generate and send OTP
    const otp = await generateOtp(email);
    await sendEmail(
      email,
      "Password Reset Request",
      `Your password reset code is: ${otp}`
    );

    return res.status(200).json({
      message: "Password reset code sent to your email",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({
      message: "Failed to process request",
      error: (error as any).message,
    });
  }
};

// Verify reset OTP
const verifyResetOtp = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        message: "Email and OTP are required",
      });
    }

    const isValid = await verifyOtp(email, otp);
    if (!isValid) {
      return res.status(400).json({
        message: "Invalid or expired OTP",
      });
    }

    // Generate a temporary reset token
    const resetToken = jwt.sign(
      { email, purpose: "reset" },
      process.env.JWT_SECRET!,
      { expiresIn: "5m" }
    );

    return res.status(200).json({
      message: "OTP verified successfully",
      resetToken,
    });
  } catch (error) {
    console.error("Verify reset OTP error:", error);
    return res.status(500).json({
      message: "Failed to verify OTP",
      error: (error as any).message,
    });
  }
};

// Reset password
const resetPassword = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, resetToken, newPassword } = req.body;

    if (!email || !resetToken || !newPassword) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    // Verify reset token
    try {
      const decoded = jwt.verify(resetToken, process.env.JWT_SECRET!) as {
        email: string;
        purpose: string;
      };

      if (decoded.email !== email || decoded.purpose !== "reset") {
        return res.status(401).json({
          message: "Invalid reset token",
        });
      }
    } catch (err) {
      return res.status(401).json({
        message: "Reset session expired",
      });
    }

    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.student.update({
      where: { email },
      data: { password: hashedPassword },
    });

    return res.status(200).json({
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({
      message: "Failed to reset password",
      error: (error as any).message,
    });
  }
};

export {
  initiateSignup,
  signin,
  verifyOtpController,
  resendOtp,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
};
