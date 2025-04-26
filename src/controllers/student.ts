import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import { uploadToCloudinary } from "../utils/cloudinary";

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
      bio,
      year,
      state,
      skills,
      interests,
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
      bio,
      state,
      skills,
      interests,
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

    // Handle profile picture upload if it's a base64 string
    let uploadedProfilePic = profilePic;
    if (profilePic && profilePic.startsWith("data:image")) {
      uploadedProfilePic = await uploadToCloudinary(profilePic);
    }

    // Explicitly handle arrays to ensure they're not undefined
    const updateData: UpdateData = {
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
    Object.keys(updateData).forEach(
      (key) =>
        updateData[key as keyof UpdateData] === undefined &&
        delete updateData[key as keyof UpdateData]
    );

    console.log("Update data:", updateData);

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
    console.log("Getting all students - Auth User:", req.user);

    const students = await prisma.student.findMany({
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
  } catch (error) {
    console.error("Error in getAllStudents:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getStudentProfile = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

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
  } catch (error) {
    console.error("Error fetching student profile:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Add type for updateData
type UpdateData = {
  firstName?: string;
  lastName?: string;
  branch?: string;
  year?: number;
  bio?: string; // Added bio field
  state?: string;
  skills: string[];
  interests: string[];
  language: string[];
  profilePic?: string;
  linkedinUrl?: string;
  githubUrl?: string;
};

export { setUpProfile, editStudentProfile, getAllStudents, getStudentProfile };
