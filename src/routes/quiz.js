import express from "express";
const router=express.Router();
import { generateQuizAI } from "../services/aiProxy.js";
import  StudentProgress  from "../models/StudentProgess.js";

router.post("/submit",async(req,res)=>{
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

router.post("/generate", async (req, res) => {
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
export default router;