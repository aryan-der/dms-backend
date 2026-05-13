import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { getFolderContent } from "../controllers/getController.js";

const router = express.Router();

router.use(verifyToken);

// Get folder content
router.get("/content", getFolderContent);

export default router;
