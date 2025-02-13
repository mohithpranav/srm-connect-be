"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const getChat_1 = require("../controllers/getChat");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
router.get("/user/:userId", auth_middleware_1.auth, getChat_1.getUserChats);
router.get("/:userId/:otherId", auth_middleware_1.auth, getChat_1.getChat);
router.get("/last-message/:userId/:otherId", auth_middleware_1.auth, getChat_1.getLastMessage);
exports.default = router;
