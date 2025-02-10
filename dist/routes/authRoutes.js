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
const router = express_1.default.Router(); // ✅ Use `Router()` instead of `express()`
// ✅ Create a new route for authentication
router.post("/signup", auth_controller_1.signup);
router.post("/verifyOtpController", auth_controller_1.verifyOtpController);
router.post("resendOtp", auth_controller_1.resendOtp);
router.post("/signin", auth_controller_1.signin);
// Create a new route for getting all students
router.post("/setUpProfile", student_1.setUpProfile);
router.put("/editStudentProfile", student_1.editStudentProfile);
router.get("/getAllStudents", student_1.getAllStudents);
router.get("/getStudentProfile", student_1.getStudentProfile);
// ✅ Create a new route for creating posts
router.post("/createPost", post_1.createPost);
router.put("/editPost", post_1.editPost);
router.delete("/deletePost", post_1.deletePost);
router.get("/getMyPosts", post_1.getMyPosts);
router.get("/getAllPosts", post_1.getAllPosts);
// ✅ Create a new route for sending and accepting connections
router.post("/send-request", connection_1.sendConnectionRequest);
router.put("/update-request", connection_1.updateConnectionRequest);
router.get("/connections/:userId", connection_1.getConnections);
// ✅ Create a new route for getting chat history
router.get("/getChat/:userId/:otherId", getChat_1.getChat);
exports.default = router;
