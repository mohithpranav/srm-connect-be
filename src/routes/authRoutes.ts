import express from "express";
import {
  resendOtp,
  signin,
  signup,
  verifyOtpController,
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
const router = express.Router(); // ✅ Use `Router()` instead of `express()`

// ✅ Create a new route for authentication
router.post("/signup", signup);
router.post("/verifyOtpController", verifyOtpController);
router.post("resendOtp", resendOtp);
router.post("/signin", signin);

// Create a new route for getting all students
router.post("/setUpProfile", setUpProfile);
router.put("/editStudentProfile", editStudentProfile);
router.get("/getAllStudents", getAllStudents);
router.get("/getStudentProfile", getStudentProfile);

// ✅ Create a new route for creating posts
router.post("/createPost", createPost);
router.put("/editPost", editPost);
router.delete("/deletePost", deletePost);
router.get("/getMyPosts", getMyPosts);
router.get("/getAllPosts", getAllPosts);

// ✅ Create a new route for sending and accepting connections
router.post("/send-request", sendConnectionRequest);
router.put("/update-request", updateConnectionRequest);
router.get("/connections/:userId", getConnections);

// ✅ Create a new route for getting chat history
router.get("/getChat/:userId/:otherId", getChat);

export default router;
