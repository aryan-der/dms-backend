import express from "express";
import {
  forgotPassword,
  logout,
  refreshTokenHandler,
  resetPassword,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/RefreshToken", refreshTokenHandler);
router.post("/ForgotPassword", forgotPassword);
router.post("/ResetPassword", resetPassword);
router.post("/Logout", logout);

export default router;
