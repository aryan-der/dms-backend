import express from "express";
import {
  login,
  logout,
  refreshTokenHandler,
  resetPassword,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/Login", login);
router.post("/RefreshToken", refreshTokenHandler);
router.post("/ResetPassword", resetPassword);
router.post("/Logout", logout);

export default router;
