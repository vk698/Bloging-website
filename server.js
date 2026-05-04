const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");
const Groq = require("groq-sdk");
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const crypto = require("crypto");
const sgMail = require('@sendgrid/mail');

const User = require("./user");

mongoose.connect(process.env.MONGO_URI || "mongodb+srv://vishalkumar2257r_db_user:oPKxmiOQQF09554e@cluster0.pmyxiym.mongodb.net/myDatabase")
.then(() => console.log("MongoDB Connected "))
.catch((err) => console.log("Error:", err));

const Blog = require("./blog");

app.use(cors());
app.use(bodyParser.json());

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: "Access denied" });
  jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret_key", (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
};

const storage = multer.memoryStorage();
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password, profilePicture, bio } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: "Email already exists" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      profilePicture: profilePicture || "",
      bio: bio || "",
    });
    await newUser.save();
    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET || "your_jwt_secret_key", { expiresIn: "7d" });
    res.json({ token, user: { id: newUser._id, name: newUser.name, email: newUser.email, profilePicture: newUser.profilePicture, bio: newUser.bio } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Signup failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "Invalid credentials" });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: "Invalid credentials" });
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || "your_jwt_secret_key", { expiresIn: "7d" });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, profilePicture: user.profilePicture, bio: user.bio } });
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
});

app.get("/api/auth/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/api/auth/update", authenticateToken, upload.single("profilePicture"), async (req, res) => {
  try {
    const { name, bio } = req.body;
    const updateData = { name, bio };
    if (req.file) {
      const base64 = req.file.buffer.toString('base64');
      const mimeType = req.file.mimetype;
      updateData.profilePicture = `data:${mimeType};base64,${base64}`;
    }
    const user = await User.findByIdAndUpdate(req.user.userId, updateData, { new: true }).select("-password");
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Update failed" });
  }
});

app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "No account with that email" });

    const token = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    const resetUrl = `https://vk698.github.io/Bloging-website/reset-password.html?token=${token}`;
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const msg = {
      to: user.email,
      from: process.env.FROM_EMAIL,
      subject: "iBlog - Password Reset",
      text: `You requested a password reset. Please copy and paste this link into your browser:\n\n${resetUrl}\n\nThis link expires in 1 hour.`,
      html: `<p>You requested a password reset. Click <a href="${resetUrl}">here</a> to reset your password.</p>
             <p>If the button doesn't work, copy and paste this link into your browser:</p>
             <p>${resetUrl}</p>
             <p>This link expires in 1 hour.</p>`,
    };
    await sgMail.send(msg);
    res.json({ message: "Reset email sent" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to send reset email" });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });
    if (!user) return res.status(400).json({ error: "Invalid or expired token" });
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = "";
    user.resetPasswordExpires = null;
    await user.save();
    res.json({ message: "Password updated. You can now login." });
  } catch (error) {
    res.status(500).json({ error: "Reset failed" });
  }
});

app.post("/api/blog", async (req, res) => {
  try {
    const { title, content, author, authorProfilePic, tags, userId } = req.body;
    const newBlog = new Blog({ title, content, author, authorProfilePic, tags, userId });
    await newBlog.save();
    res.json({ message: "Blog saved successfully " });
  } catch (error) {
    res.status(500).json({ error: "Error saving blog" });
  }
});

app.get("/api/blog", async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 });
    res.json(blogs);
  } catch (error) {
    console.error("Error fetching blogs:", error);
    res.status(500).json({ error: "Error fetching blogs" });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.get("/", (req, res) => {
  res.send("✅ iBlog backend is running. Use /api/ask-ai for AI chat, /api/health for health check.");
});

let groq = null;
if (process.env.GROQ_API_KEY) {
  groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  console.log("✅ Groq AI initialized");
} else {
  console.warn("⚠️ GROQ_API_KEY not set. AI features disabled.");
}

app.post("/api/ask-ai", async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ reply: "Please send a message." });
  }
  if (!groq) {
    return res.status(503).json({ reply: "AI service not configured. Please set GROQ_API_KEY." });
  }
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are Kittu, a helpful AI assistant for iBlog. Reply in the same language as the user. Be friendly and concise.",
        },
        {
          role: "user",
          content: message,
        },
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
    });
    const reply = chatCompletion.choices[0]?.message?.content || "Sorry, I could not generate a reply.";
    res.json({ reply });
  } catch (error) {
    console.error("Groq API error:", error);
    res.status(500).json({ error: "AI service error" });
  }
});

app.get("/api/blog/user/:userId", async (req, res) => {
  try {
    const blogs = await Blog.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(blogs);
  } catch (error) {
    res.status(500).json({ error: "Error fetching user blogs" });
  }
});

app.delete("/api/blog/:blogId", authenticateToken, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.blogId);
    if (!blog) return res.status(404).json({ error: "Blog not found" });
    if (blog.userId && blog.userId.toString() !== req.user.userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    await Blog.findByIdAndDelete(req.params.blogId);
    res.json({ message: "Blog deleted" });
  } catch (error) {
    res.status(500).json({ error: "Delete failed" });
  }
});

app.post("/api/blog/:blogId/like", authenticateToken, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.blogId);
    if (!blog) return res.status(404).json({ error: "Blog not found" });
    const userId = req.user.userId;
    const liked = blog.likes.includes(userId);
    if (liked) {
      blog.likes = blog.likes.filter(id => id.toString() !== userId);
    } else {
      blog.likes.push(userId);
    }
    await blog.save();
    res.json({ liked: !liked, count: blog.likes.length });
  } catch (error) {
    res.status(500).json({ error: "Error toggling like" });
  }
});

app.post("/api/blog/:blogId/comment", authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Comment text required" });
    const blog = await Blog.findById(req.params.blogId);
    if (!blog) return res.status(404).json({ error: "Blog not found" });
    const user = await User.findById(req.user.userId).select("name profilePicture");
    blog.comments.push({
      userId: user._id,
      userName: user.name,
      userProfilePic: user.profilePicture || "",
      text: text
    });
    await blog.save();
    const newComment = blog.comments[blog.comments.length - 1];
    res.json(newComment);
  } catch (error) {
    res.status(500).json({ error: "Error adding comment" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});