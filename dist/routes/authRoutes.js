"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_controller_1 = require("../controllers/auth.controller");
const post_1 = require("../controllers/post");
const student_1 = require("../controllers/student");
const connection_1 = require("../controllers/connection");
const getChat_1 = require("../controllers/getChat");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router(); // ✅ Use `Router()` instead of `express()`
// Public routes (no auth required)
router.post("/signup", auth_controller_1.initiateSignup);
router.post("/verifyOtpController", auth_controller_1.verifyOtpController);
router.post("/resendOtp", auth_controller_1.resendOtp);
router.post("/signin", auth_controller_1.signin);
router.post("/forgot-password", auth_controller_1.forgotPassword);
router.post("/verify-reset-otp", auth_controller_1.verifyResetOtp);
router.post("/reset-password", auth_controller_1.resetPassword);
// Protected routes (auth required)
router.post("/setUpProfile", auth_middleware_1.auth, student_1.setUpProfile);
router.put("/editStudentProfile", auth_middleware_1.auth, student_1.editStudentProfile);
router.get("/getAllStudents", auth_middleware_1.auth, student_1.getAllStudents);
router.get("/getStudentProfile", auth_middleware_1.auth, student_1.getStudentProfile);
// ✅ Create a new route for creating posts
router.post("/createPost", auth_middleware_1.auth, post_1.createPost);
router.put("/editPost", auth_middleware_1.auth, post_1.editPost);
router.delete("/deletePost", auth_middleware_1.auth, post_1.deletePost);
router.get("/getMyPosts", auth_middleware_1.auth, post_1.getMyPosts);
router.get("/getAllPosts", auth_middleware_1.auth, post_1.getAllPosts);
// ✅ Create a new route for sending and accepting connections
router.post("/send-request", auth_middleware_1.auth, connection_1.sendConnectionRequest);
router.put("/update-request", auth_middleware_1.auth, connection_1.updateConnectionRequest);
router.get("/connections/:userId", auth_middleware_1.auth, connection_1.getConnections);
// ✅ Create a new route for getting chat history
router.get("/getChat/:userId/:otherId", auth_middleware_1.auth, getChat_1.getChat);
exports.default = router;
