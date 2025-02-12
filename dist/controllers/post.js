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
exports.getAllPosts = exports.getMyPosts = exports.deletePost = exports.editPost = exports.createPost = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const createPost = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { studentId, content } = req.body;
        if (!studentId || !content) {
            return res.status(400).json({ message: "Missing required fields" });
        }
        const student = yield prisma.student.findUnique({
            where: { id: studentId },
        });
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }
        const newPost = yield prisma.post.create({
            data: {
                content,
                student: { connect: { id: studentId } },
            },
        });
        res.status(201).json({ message: "Post created", post: newPost });
    }
    catch (error) {
        res
            .status(500)
            .json({ message: "Error creating post", error: error.message });
    }
});
exports.createPost = createPost;
const editPost = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { postId, content, studentId } = req.body;
        if (!postId || !content || !studentId) {
            return res.status(400).json({ message: "Missing required fields" });
        }
        const post = yield prisma.post.findUnique({
            where: { id: postId },
        });
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }
        if (post.studentId !== studentId) {
            return res.status(403).json({ message: "Unauthorized" });
        }
        const updatedPost = yield prisma.post.update({
            where: { id: postId },
            data: { content },
        });
        res.status(200).json({ message: "Post updated", post: updatedPost });
    }
    catch (error) {
        res
            .status(500)
            .json({ message: "Error updating post", error: error.message });
    }
});
exports.editPost = editPost;
const deletePost = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { postId, studentId } = req.body;
        if (!postId || !studentId) {
            return res.status(400).json({ message: "Missing required fields" });
        }
        const post = yield prisma.post.findUnique({
            where: { id: postId },
        });
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }
        if (post.studentId !== studentId) {
            return res.status(403).json({ message: "Unauthorized" });
        }
        yield prisma.post.delete({
            where: { id: postId },
        });
        res.status(200).json({ message: "Post deleted" });
    }
    catch (error) {
        res
            .status(500)
            .json({ message: "Error deleting post", error: error.message });
    }
});
exports.deletePost = deletePost;
const getMyPosts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { studentId } = req.body;
        if (!studentId) {
            return res.status(400).json({ message: "Missing required fields" });
        }
        const posts = yield prisma.post.findMany({
            where: { studentId },
        });
        res.status(200).json(posts);
    }
    catch (error) {
        res.status(500).json({
            message: "Error retrieving posts",
            error: error.message,
        });
    }
});
exports.getMyPosts = getMyPosts;
const getAllPosts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const posts = yield prisma.post.findMany({
            include: {
                student: {
                    select: {
                        id: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                        profilePic: true,
                        branch: true,
                        year: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });
        res.status(200).json(posts);
    }
    catch (error) {
        res.status(500).json({
            message: "Error retrieving posts",
            error: error.message,
        });
    }
});
exports.getAllPosts = getAllPosts;
