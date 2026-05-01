const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const Groq = require("groq-sdk");
require("dotenv").config();
const mongoose = require("mongoose");

mongoose.connect("mongodb+srv://vishalkumar2257r_db_user:oPKxmiOQQF09554e@cluster0.pmyxiym.mongodb.net/myDatabase")
.then(() => console.log("MongoDB Connected "))
.catch((err) => console.log("Error:", err));

const Blog = require("./blog");

// Create Blog API
app.post("/api/blog", async (req, res) => {
  try {
    const { title, content } = req.body;

    const newBlog = new Blog({ title, content });
    await newBlog.save();

    res.json({ message: "Blog saved successfully " });
  } catch (error) {
    res.status(500).json({ error: "Error saving blog" });
  }
});



app.use(cors());
app.use(bodyParser.json());

// Health check route (for Render)
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Root route (for testing)
app.get("/", (req, res) => {
  res.send("✅ iBlog backend is running. Use /api/ask-ai for AI chat, /api/health for health check.");
});

// Groq AI client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// AI chat endpoint
app.post("/api/ask-ai", async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ reply: "Please send a message." });
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
      model: "llama-3.1-8b-instant",   // ✅ CHANGED THIS LINE
      temperature: 0.7,
    });
    const reply = chatCompletion.choices[0]?.message?.content || "Sorry, I could not generate a reply.";
    res.json({ reply });
  } catch (error) {
    console.error("Groq API error:", error);
    res.status(500).json({ reply: "AI service error. Please try again later." });
  }
});

// Contact form endpoint
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