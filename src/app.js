import express from "express"
import cors from "cors";
import dotenv from "dotenv"
import axios from "axios"
import mongoose from "mongoose"
import  {verifyToken}  from "./middleware/authMiddleware.js";
dotenv.config();
import quizRoutes from "./routes/quiz.js";
import chatRoutes from "./routes/chat.js"
import docRoutes from "./routes/document.js"
import askRoutes from "./routes/ask.js"
import authRoutes from "./routes/auth.js"
import userRoutes from "./routes/user.js"






const app = express();
app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization","x-session-id","x-chat-id"],
}));
app.use(express.json());
app.get("/", async(req, res) => {
  try{
    console.log("Performing health check to AI Service...", process.env.AI_SERVICE_URL+"/health");

  const response = await axios.get(process.env.AI_SERVICE_URL + "/health");
  console.log("AI Service Health Check:", response.data);
  res.send(response.data);}
  catch(err){
    console.error("Error during health check:", err);
    res.status(500).send("AI Service is not healthy");
  }
});
app.use("/api",verifyToken)

app.use("/api/quiz",quizRoutes);
app.use("/api/chat",chatRoutes);
app.use("/api/doc",docRoutes);
app.use("/api/ask",askRoutes);
app.use("/auth",authRoutes);
app.use("/api/user",userRoutes);



mongoose.connect(process.env.MONGO_URI).then(() => {
  console.log("Connected to MongoDB");
}).catch((err) => {
  console.error("Error connecting to MongoDB:", err);
  process.exit(1);
});

app.listen(process.env.PORT, () =>
  console.log(`Server running on port ${process.env.PORT}`)
);

