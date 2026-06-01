import bcrypt from "bcrypt";
import User from "../models/User.js";
import crypto from "crypto";
import { sendShareEmail } from "../utils/sendEmail.js"; // Use common mail utility

// ----- Register API -----
export const register = async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    // Validation
    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({
        message: "Name, email, password, and confirm password are required.",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    // Check if user exists
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "Email already in use." });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // Create user
    const user = new User({ name, email, password: hash });
    await user.save();

    // Do not send password hash in response
    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const genericResponse = {
      message: "If that email exists, a reset link will be sent.",
    };

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).json(genericResponse);
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashed = crypto.createHash("sha256").update(resetToken).digest("hex");

    user.resetPasswordToken = hashed;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    try {
      await sendShareEmail({
        to: email,
        link: resetUrl,
        password: null,
        expiryDays: 1,
        subject: "Password Reset",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: auto; padding: 24px;">
            <h2>Password Reset Request</h2>
            <p>You requested a password reset for your account.</p>
            <a 
              href="${resetUrl}" 
              style="display:inline-block; margin-top:16px; padding:10px 24px; background:#000; color:#fff; border-radius:8px; text-decoration:none; font-weight:600;">
              Reset Password
            </a>
            <p style="margin-top:16px; color:#555;">
              If you did not request this, please ignore this email.
            </p>
          </div>
        `,
      });
    } catch (mailError) {
      console.error("Mail send error (forgotPassword):", mailError);
    }

    return res.status(200).json(genericResponse);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
