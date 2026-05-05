import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import User from "../models/User.js";

dotenv.config();

await mongoose.connect(process.env.MONGO_URI);

const args = process.argv.slice(2);

const name = args[0];
const email = args[1];
const password = args[2];
const role = args[3] || "User";

if (!name || !email || !password) {
  console.log("Usage: node createUser.js name email password role");
  process.exit();
}

const hashedPassword = await bcrypt.hash(password, 10);

const user = await User.create({
  name,
  email,
  password: hashedPassword,
  role,
});

console.log("User created:", user);

process.exit();
