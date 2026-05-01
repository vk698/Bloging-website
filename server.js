const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const Groq = require("groq-sdk");
require("dotenv").config();
const mongoose = require("mongoose");

mongoose.connect(process.env.MONGO_URI || "mongodb+srv://vishalkumar2257r_db_user:oPKxmiOQQF09554e@cluster0.pmyxiym.mongodb.net/myDatabase")
.then(() => console.log("MongoDB Connected "))
.catch((err) => console.log("Error:", err));

const Blog = require("./blog");

app.use(cors());
app.use(bodyParser.json());

app.post("/api/blog", async (req, res) => {
  try {
    const { title, content, author, tags } = req.body;
    const newBlog = new Blog({ title, content, author, tags });
    await newBlog.save();
    res.json({ message: "Blog saved successfully " });
  } catch (error) {
    res.status(500).json({ error: "Error saving blog" });
  }
});
// GET - Fetch all blogs (latest first)
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
    res.status(500).json({ reply: "AI service error. Please try again later." });
  }
});

app.post("/send-message", async (req, res) => {
  const { name, email, phone, message } = req.body;
  let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL,
      pass: process.env.PASSWORD,
    },
  });
  let mailOptions = {
    from: email,
    to: process.env.EMAIL,
    subject: "New Contact Form Message",
    text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\nMessage: ${message}`,
  };
  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.json({ success: false, error });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
