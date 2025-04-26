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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStudentProfile = exports.getAllStudents = exports.editStudentProfile = exports.setUpProfile = void 0;
const client_1 = require("@prisma/client");
const cloudinary_1 = require("../utils/cloudinary");
const prisma = new client_1.PrismaClient();
const setUpProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.body;
        if (!id) {
            return res.status(400).json({ message: "Student ID is required" });
        }
        const { firstName, lastName, branch, bio, year, state, skills, interests, profilePic, language, linkedinUrl, githubUrl, } = req.body;
        // Validate required fields
        if (!firstName || !lastName || !branch || !year || !state || !language) {
            return res.status(400).json({ message: "Missing required fields" });
        }
        // Check if student exists
        const existingStudent = yield prisma.student.findUnique({ where: { id } });
        if (!existingStudent) {
            return res.status(404).json({ message: "Student not found" });
        }
        // Update student profile
        const updatedStudent = yield prisma.student.update({
            where: { id },
            data: {
                firstName,
                lastName,
                branch,
                year,
                bio,
                state,
                profilePic: profilePic || "",
                skills: skills || [],
                interests: interests || [],
                language: language || [],
                linkedinUrl: linkedinUrl || "",
                githubUrl: githubUrl || "",
            },
        });
        res.status(200).json({
            message: "Profile setup successfully",
            student: updatedStudent,
        });
    }
    catch (error) {
        console.error("Error setting up student profile:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});
exports.setUpProfile = setUpProfile;
const editStudentProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.body;
        if (!id) {
            return res.status(400).json({ message: "Student ID is required" });
        }
        const { firstName, lastName, branch, year, bio, state, skills, interests, profilePic, language, linkedinUrl, githubUrl, } = req.body;
        // Check if student exists
        const existingStudent = yield prisma.student.findUnique({ where: { id } });
        if (!existingStudent) {
            return res.status(404).json({ message: "Student not found" });
        }
        // Handle profile picture upload if it's a base64 string
        let uploadedProfilePic = profilePic;
        if (profilePic && profilePic.startsWith("data:image")) {
            uploadedProfilePic = yield (0, cloudinary_1.uploadToCloudinary)(profilePic);
        }
        // Explicitly handle arrays to ensure they're not undefined
        const updateData = {
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            branch: branch || undefined,
            year: year ? parseInt(year.toString()) : undefined,
            state: state || undefined,
            skills: Array.isArray(skills) ? skills : existingStudent.skills,
            interests: Array.isArray(interests)
                ? interests
                : existingStudent.interests,
            language: Array.isArray(language) ? language : existingStudent.language,
            bio: bio || undefined,
            profilePic: uploadedProfilePic || undefined,
            linkedinUrl: linkedinUrl || undefined,
            githubUrl: githubUrl || undefined,
        };
        // Use type assertion when deleting undefined values
        Object.keys(updateData).forEach((key) => updateData[key] === undefined &&
            delete updateData[key]);
        console.log("Update data:", updateData);
        const updatedStudent = yield prisma.student.update({
            where: { id },
            data: updateData,
        });
        res.status(200).json({
            message: "Profile updated successfully",
            student: updatedStudent,
        });
    }
    catch (error) {
        console.error("Error updating student profile:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});
exports.editStudentProfile = editStudentProfile;
const getAllStudents = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log("Getting all students - Auth User:", req.user);
        const students = yield prisma.student.findMany({
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                branch: true,
                year: true,
                state: true,
                bio: true,
                skills: true,
                interests: true,
                profilePic: true,
                language: true,
                linkedinUrl: true,
                githubUrl: true,
            },
        });
        console.log("Found students:", students.length);
        res.status(200).json({
            message: "Students retrieved successfully",
            students,
        });
    }
    catch (error) {
        console.error("Error in getAllStudents:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});
exports.getAllStudents = getAllStudents;
const getStudentProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ message: "Student ID is required" });
        }
        const student = yield prisma.student.findUnique({
            where: { id: parseInt(id) },
            select: {
                firstName: true,
                lastName: true,
                email: true,
                branch: true,
                year: true,
                state: true,
                bio: true,
                skills: true,
                interests: true,
                language: true,
                profilePic: true,
                linkedinUrl: true,
                githubUrl: true,
                isOnline: true,
                createdAt: true,
            },
        });
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }
        res.status(200).json({
            message: "Student profile retrieved successfully",
            student,
        });
    }
    catch (error) {
        console.error("Error fetching student profile:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});
exports.getStudentProfile = getStudentProfile;
