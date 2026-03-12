const express = require("express");
const cors = require("cors");
const { askAI } = require("./services/aiProxy");
require("dotenv").config();
const axios = require("axios");
const StudentProgress = require("./models/StudentProgess");
const mongoose = require("mongoose");
const { generateQuizAI } = require("./services/aiProxy");
const isWeakTopic = require("./services/weakTopic");
const multer=require("multer");
const storage=multer.memoryStorage();
const upload=multer({storage});
const FormData=require("form-data");


const app = express();
app.use(cors());
app.use(express.json());
app.get("/", async(req, res) => {
  try{const response = await axios.get(process.env.AI_SERVICE_URL + "/health");
  console.log("AI Service Health Check:", response.data);
  res.send(response.data);}
  catch(err){
    console.error("Error during health check:", err);
    res.status(500).send("AI Service is not healthy");
  }
});
app.post("/api/ask", async (req, res) => {
  try{
    const {question,chat_history}=req.body;
    const sessionId=req.headers["x-session-id"] ;
    if(!question){
      return res.status(400).json({
        errpr:"Question is required",
      })
    }
    console.log("Session ID in ask route:", sessionId);
    const result= await askAI(question,chat_history,sessionId);

    let record=await StudentProgress.findOne({topic:result.topic});
    if(!record){
      record=new StudentProgress({topic:result.topic})
    }
    record.questionAsked+=1;
    if(result.confidence==="low"){
      record.lowConfidence+=1;
    }
    await record.save();
    let weakTopic = false;

    let suggestion=null;


    if (result.topic) {
      weakTopic = isWeakTopic(record);
    }

    if(weakTopic && result.topic){
      suggestion={
        type:"quiz",
        message:`You seem weak in ${result.topic}. Would you like to take a quiz to improve?`,
        topic:result.topic,
      }
    }

  res.json({...result, weakTopic,suggestion});
  }catch (err) {
  console.error("Ask route error:", err);

  res.status(500).json({
    error: "AI service temporarily unavailable"
  });
}
 
  
});

app.post("/ingest/pdf",upload.single("file"), async (req, res) => {
  const file = req.file;

  const sessionId=req.headers["x-session-id"] ;
  
  if (!file) {
    return res.status(400).json({ error: "PDF file is required" });
  }


  try {
    const formData = new FormData();
    formData.append("file", file.buffer, file.originalname);


    const response = await axios.post(process.env.AI_SERVICE_URL + "/ingest/pdf", formData, {
      headers: {
        ...formData.getHeaders(),
        "x-session-id": sessionId

      },
    });

    res.json(response.data);
  } catch (err) {
    console.error("PDF Ingestion error:", err);
    res.status(500).json({ error: "Failed to ingest PDF" });
  }
});

app.post("/api/quiz/submit",async(req,res)=>{
      try{
        const {topic,answers,questions}=req.body;

        let correct=0;
        questions.forEach((q,idx)=>{
          if(answers[idx]===q.answerIndex){
            correct++;
          }
        });

        let record=await StudentProgress.findOne({topic});
        if(!record){
          record=new StudentProgress({topic})
        }
        record.quizAttempts+=1;
        record.quizCorrect+=correct;
        await record.save();
        res.json({
          score:correct,
          total:questions.length
        })
      }
      catch(err){
        console.error("Error submitting quiz:", err);
        res.status(500).json({ error: "Quiz submission failed" });
        }
  });

app.post("/api/quiz", async (req, res) => {
  try {
    const { topic, difficulty } = req.body;

    if(!topic){
      return res.status(400).json({
        error:"Topic required"
      })
    }
    const result = await generateQuizAI(topic, difficulty);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Quiz generation failed" });
  }
});


  


mongoose.connect(process.env.MONGO_URI).then(() => {
  console.log("Connected to MongoDB");
}).catch((err) => {
  console.error("Error connecting to MongoDB:", err);
  process.exit(1);
});

app.listen(process.env.PORT, () =>
  console.log(`Server running on port ${process.env.PORT}`)
);

