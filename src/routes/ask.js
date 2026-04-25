import express from "express";
const router=express.Router();
import { askAI } from "../services/aiProxy.js";
import StudentProgress from "../models/StudentProgess.js";
import Chat from "../models/ChatCollection.js";
import isWeakTopic from "../services/weakTopic.js";
import ChatCollection from "../models/ChatCollection.js";
router.post("/", async (req, res) => {
    if(!req.headers["x-chat-id"]){
      return res.status(400).json({
        error:"Chat ID header (x-chat-id) is required"
      })
    }
  try{


    const {question,chat_history}=req.body;
    const chatId=req.headers["x-chat-id"] ;
    if(!question){
      return res.status(400).json({
        errpr:"Question is required",
      })
    }
    let title = question.replace(/\n/g, " ").slice(0, 40);
    await Chat.updateOne(
    { chatId, "messages.0": { $exists: false } },
    {
        $set: {
        title: question.replace(/\n/g, " ").slice(0, 40)
        }
    }
    );
    
    console.log("Chat ID in ask route:", chatId);
    const result= await askAI(question,chat_history,chatId);

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
    const assistantMessage = Array.isArray(result.answer)? result.answer.join("\n\n"): result.answer;
    await Chat.findOneAndUpdate(
      { chatId },
      {
        $setOnInsert: { chatId },
        $push: {
          messages: {
            $each: [
              { role: "user", content: question },
              { role: "assistant", content:   assistantMessage },
            ],
          },
        },
      },
      {
        upsert: true,
        returnDocument: "after"
      }
      );
    
  res.json({...result, weakTopic,suggestion});
  }catch (err) {
  console.error("Ask route error:", err);

  res.status(500).json({
    error: "AI service temporarily unavailable"
  });
}
 
  
});
export default router;