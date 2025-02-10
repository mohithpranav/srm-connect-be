import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";

const prisma = new PrismaClient();

const setUpProfile = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Student ID is required" });
    }

    const {
      firstName,
      lastName,
      branch,
      year,
      state,
      skills,
      profilePic,
      language,
      linkedinUrl,
      githubUrl,
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !branch || !year || !state || !language) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Check if student exists
    const existingStudent = await prisma.student.findUnique({ where: { id } });

    if (!existingStudent) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Update student profile
    const updatedStudent = await prisma.student.update({
      where: { id },
      data: {
        firstName,
        lastName,
        branch,
        year,
        state,
        profilePic: profilePic || "",
        skills: skills || [],
        language: language || [],
        linkedinUrl: linkedinUrl || "",
        githubUrl: githubUrl || "",
      },
    });

    res.status(200).json({
      message: "Profile setup successfully",
      student: updatedStudent,
    });
  } catch (error) {
    console.error("Error setting up student profile:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const editStudentProfile = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Student ID is required" });
    }

    const {
      firstName,
      lastName,
      branch,
      year,
      state,
      skills,
      profilePic,
      language,
      linkedinUrl,
      githubUrl,
    } = req.body;

    // Check if student exists
    const existingStudent = await prisma.student.findUnique({ where: { id } });

    if (!existingStudent) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Update only the provided fields
    const updateData: any = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (branch) updateData.branch = branch;
    if (year) updateData.year = year;
    if (state) updateData.state = state;
    if (skills) updateData.skills = skills;
    if (profilePic) updateData.profilePic = profilePic;
    if (language) updateData.language = language;
    if (linkedinUrl) updateData.linkedinUrl = linkedinUrl;
    if (githubUrl) updateData.githubUrl = githubUrl;

    const updatedStudent = await prisma.student.update({
      where: { id },
      data: updateData,
    });

    res.status(200).json({
      message: "Profile updated successfully",
      student: updatedStudent,
    });
  } catch (error) {
    console.error("Error updating student profile:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
const getAllStudents = async (req: Request, res: Response): Promise<any> => {
  try {
    const students = await prisma.student.findMany({
      select: {
        firstName: true,
        lastName: true,
        branch: true,
        year: true,
        state: true,
        skills: true,
        interests: true,
      },
    });

    res.status(200).json({
      message: "Students retrieved successfully",
      students,
    });
  } catch (error) {
    console.error("Error fetching students:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getStudentProfile = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Student ID is required" });
    }

    const student = await prisma.student.findUnique({
      where: { id: parseInt(id) },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        branch: true,
        year: true,
        state: true,
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
  } catch (error) {
    console.error("Error fetching student profile:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export { setUpProfile, editStudentProfile, getAllStudents, getStudentProfile };
