import express from "express";
import {
  initiateSignup,
  resendOtp,
  signin,
  verifyOtpController,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
} from "../controllers/auth.controller";
import {
  createPost,
  deletePost,
  editPost,
  getAllPosts,
  getMyPosts,
} from "../controllers/post";
import {
  editStudentProfile,
  getAllStudents,
  getStudentProfile,
  setUpProfile,
} from "../controllers/student";
import {
  getConnections,
  sendConnectionRequest,
  updateConnectionRequest,
} from "../controllers/connection";
import { getChat } from "../controllers/getChat";
import { auth } from "../middleware/auth.middleware";
const router = express.Router(); // ✅ Use `Router()` instead of `express()`

// Public routes (no auth required)
router.post("/signup", initiateSignup);
router.post("/verifyOtpController", verifyOtpController);
router.post("/resendOtp", resendOtp);
router.post("/signin", signin);
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-otp", verifyResetOtp);
router.post("/reset-password", resetPassword);

// Protected routes (auth required)
router.post("/setUpProfile", auth, setUpProfile);
router.put("/editStudentProfile", auth, editStudentProfile);
router.get("/getAllStudents", auth, getAllStudents);
router.get("/getStudentProfile/:id", auth, getStudentProfile);

// ✅ Create a new route for creating posts
router.post("/createPost", auth, createPost);
router.put("/editPost", auth, editPost);
router.delete("/deletePost", auth, deletePost);
router.get("/getMyPosts", auth, getMyPosts);
router.get("/getAllPosts", auth, getAllPosts);

// ✅ Create a new route for sending and accepting connections
router.post("/send-request", auth, sendConnectionRequest);
router.put("/update-request", auth, updateConnectionRequest);
router.get("/connections/:userId", auth, getConnections);

// ✅ Create a new route for getting chat history
router.get("/getChat/:userId/:otherId", auth, getChat);

export default router;
