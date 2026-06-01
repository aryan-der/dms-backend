import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import User from "../models/User.js";
import nodemailer from "nodemailer";
import crypto from "crypto";

const generateAccessToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });
};

const generateRefreshToken = (user) => {
  return jwt.sign({ id: user._id }, process.env.REFRESH_SECRET, {
    expiresIn: "7d",
  });
};

export const refreshTokenHandler = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) return res.sendStatus(401);

  const user = await User.findOne({ refreshToken });

  if (!user) return res.sendStatus(403);

  jwt.verify(refreshToken, process.env.REFRESH_SECRET, (err, decoded) => {
    if (err) return res.sendStatus(403);

    const newAccessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.json({ jwtToken: newAccessToken });
  });
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Save refresh token in DB
    user.refreshToken = refreshToken;
    await user.save();

    res.json({
      userId: user._id,
      email: user.email,
      role: user.role,
      jwtToken: accessToken,
      refreshToken,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ----- Reset Password -----
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ message: "Token and new password are required." });
    }

    // Find user by hashed token and check expiry
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid or expired password reset token." });
    }

    // Security: invalidate existing sessions by updating password
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // (Optional: You could notify user by email that password has been reset)

    res.status(200).json({ message: "Password has been reset successfully." });
  } catch (error) {
    // Prevent revealing internal info
    console.error("[ResetPassword] error:", error);
    res.status(500).json({ message: "Failed to reset password." });
  }
};

export const logout = async (req, res) => {
  try {
    // Check if refresh token is provided
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res
        .status(400)
        .json({ message: "Refresh token required for logout." });
    }

    // Attempt to find and update user by refresh token
    const user = await User.findOne({ refreshToken });
    if (user) {
      user.refreshToken = undefined;
      await user.save();
    }
    // For security, always send a generic response (even if token/user not found)
    res.status(200).json({ message: "Logged out successfully." });
  } catch (error) {
    console.error("[Logout] error:", error);
    res.status(500).json({ message: "Logout failed." });
  }
};
