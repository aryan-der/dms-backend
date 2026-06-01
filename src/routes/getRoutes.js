import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
  getFolderContent,
  getShareInfo,
} from "../controllers/getController.js";

const router = express.Router();

// Get folder content
router.get("/content", verifyToken, getFolderContent);
router.get("/share/:token", getShareInfo);
export default router;
