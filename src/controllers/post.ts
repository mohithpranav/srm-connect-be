import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import { getEffectiveTypeParameterDeclarations } from "typescript";

const prisma = new PrismaClient();

const createPost = async (req: Request, res: Response): Promise<any> => {
  try {
    const { studentId, content } = req.body;

    if (!studentId || !content) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const newPost = await prisma.post.create({
      data: {
        content,
        student: { connect: { id: studentId } },
      },
    });

    res.status(201).json({ message: "Post created", post: newPost });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating post", error: (error as any).message });
  }
};

const editPost = async (req: Request, res: Response): Promise<any> => {
  try {
    const { postId, content, studentId } = req.body;

    if (!postId || !content || !studentId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (post.studentId !== studentId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: { content },
    });

    res.status(200).json({ message: "Post updated", post: updatedPost });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating post", error: (error as any).message });
  }
};

const deletePost = async (req: Request, res: Response): Promise<any> => {
  try {
    const { postId, studentId } = req.body;

    if (!postId || !studentId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (post.studentId !== studentId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await prisma.post.delete({
      where: { id: postId },
    });

    res.status(200).json({ message: "Post deleted" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting post", error: (error as any).message });
  }
};

const getMyPosts = async (req: Request, res: Response): Promise<any> => {
  try {
    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const posts = await prisma.post.findMany({
      where: { studentId },
    });
    res.status(200).json(posts);
  } catch (error) {
    res.status(500).json({
      message: "Error retrieving posts",
      error: (error as any).message,
    });
  }
};

const getAllPosts = async (req: Request, res: Response): Promise<any> => {
  try {
    const posts = await prisma.post.findMany({
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
  } catch (error) {
    res.status(500).json({
      message: "Error retrieving posts",
      error: (error as any).message,
    });
  }
};

export { createPost, editPost, deletePost, getMyPosts, getAllPosts };
