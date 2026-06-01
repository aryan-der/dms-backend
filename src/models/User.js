import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 64,
    },
    email: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 128,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: true,
    },
    role: {
      type: String,
      enum: ["Admin", "User"],
      default: "User",
    },
    refreshToken: {
      type: String,
      select: false,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
  },
  { timestamps: true },
);

export default mongoose.model("User", userSchema);
