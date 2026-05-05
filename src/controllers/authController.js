import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import User from "../models/User.js";
import nodemailer from "nodemailer";
import crypto from "crypto";

const generateAccessToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "15m",
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
      { expiresIn: "15m" },
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

// ----- Utility: Email Sending -----
// Reusable, free, custom SMTP mail sender (using Nodemailer's `sendmail` transport for development/freemail)
// Use environment variable to toggle dev/prod mail sending in production!
const transporter =
  process.env.NODE_ENV === "production"
    ? nodemailer.createTransport({
        service: "gmail", // Or use SMTP config for production mail service
        auth: {
          user: process.env.EMAIL_ADDRESS,
          pass: process.env.EMAIL_PASSWORD,
        },
      })
    : nodemailer.createTransport({
        sendmail: true,
        newline: "unix",
        path: "/usr/sbin/sendmail",
      });

/**
 * Send Mail Utility
 * @param {Object} mailOptions - nodemailer message options
 * @returns {Promise}
 */
const sendMail = async (mailOptions) => {
  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    // Log for system admins, prevent leaking info to client
    console.error("Mail send error:", err);
    throw new Error("There was a problem sending the email.");
  }
};

// ----- Forgot Password -----
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Always return same output for privacy, never confirm user existence
    const genericResponse = {
      message: "If that email exists, a reset link will be sent.",
    };

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).json(genericResponse);
    }

    // Generate secure unique token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Set expiry (1 hour from now)
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    // Production-grade HTML email template can be improved further
    const mailOptions = {
      from: process.env.EMAIL_ADDRESS || "no-reply@example.com",
      to: user.email,
      subject: "Password Reset Request",
      html: `
        <h3>Password Reset Requested</h3>
        <p>We received a request to reset your password. If this was you, please click the link below to reset your password. This link will expire in 1 hour.</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>If you did not request this, please ignore this email.</p>
      `,
    };

    try {
      await sendMail(mailOptions);
    } catch (e) {
      // Prefer not to reveal mail send status to the client
      return res.status(200).json(genericResponse);
    }

    return res.status(200).json(genericResponse);
  } catch (error) {
    // Log server errors, send generic error message
    console.error("[ForgotPassword] error:", error);
    res
      .status(500)
      .json({ message: "Failed to process password reset request." });
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
/**
 * Logout user by invalidating their refresh token.
 * - Expects refresh token on cookie or body (for stateless JWT, token is just removed client-side)
 * - Ensures server-side refresh token storage is cleared for security
 */
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
