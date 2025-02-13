import express from "express";
import { getChat, getLastMessage, getUserChats } from "../controllers/getChat";
import { auth } from "../middleware/auth.middleware";

const router = express.Router();

router.get("/user/:userId", auth, getUserChats);
router.get("/:userId/:otherId", auth, getChat);
router.get("/last-message/:userId/:otherId", auth, getLastMessage);

export default router;
