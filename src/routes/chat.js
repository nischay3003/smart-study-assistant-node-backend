import express from "express";
import { v4 as uuidv4 } from 'uuid';
const router=express.Router();


import Chat from "../models/ChatCollection.js   ";

router.get("/title",async(req,res)=>{
    try{
        const chatId=req.headers["x-chat-id"];
        if(!chatId){
          return res.status(400).json({
            error:"Chat ID header (x-chat-id) is required"
          })
        }
        const chatHistory=await Chat.findOne({chatId});
        if(!chatHistory || chatHistory.messages.length===0){
          return res.json({
            title:"New Chat"
          })
        }
        const lastUserMessage=[...chatHistory.messages].reverse().find(m=>m.role==="user");
        const title=lastUserMessage ? lastUserMessage.content.slice(0,20)+"...": "Chat";
        res.json({
          title
        })
    }
    catch(err){
      console.error("Error fetching chat title:", err);
      res.status(500).json({ error: "Failed to fetch chat title" });
    }
})

router.get("/history/:chatId",async(req,res)=>{
  try{
    const chatId=req.params.chatId;
    if(!chatId){
      return res.status(400).json({
        error:"Chat ID required"
      })
    }
    const chatHistory=await Chat.findOne({chatId});
    if(!chatHistory){
      return res.json({
        messages:[]
      })
    }
    res.json({
    messages: chatHistory.messages,
    documents: chatHistory.documents // ✅ add this
    });
  }
  catch(err){
    console.error("Error fetching chat history:", err);
    res.status(500).json({ error: "Failed to fetch chat history" });
  }
});
router.post("/create",async(req,res)=>{
  try{
    const userId=req.user.userId;
    console.log("UserId in create chat:",userId);
    if(!userId){
      return res.status(400).json({
        error:"User ID required"
      })
    }
    const chatId=uuidv4();
    const newChat=await Chat.findOneAndUpdate(
      { chatId },
      {
        $setOnInsert: { chatId, userId },
        $push: {
          messages: {
            $each: [],
          },
        },
      },
      { upsert: true, returnDocument: "after" }
    );
    
    res.json({
      newChat
    })
  }catch(err){
    console.error("Error creating chat:", err);
    res.status(500).json({ error: "Failed to create chat" });
  }
});
router.get("/", async (req, res) => {
  const userId = req.user.userId;

  const chats = await Chat.find({ userId })
    .sort({ updatedAt: -1 })
    .select("chatId title updatedAt documents");

  res.json(chats);
});
router.get("/:$chatId",async(req,res)=>{
    const { chatId } = req.params;
  const userId = req.user.userId;
  console.log("UserId in chats:",userId)

  const chat = await Chat.findOne({ chatId, userId });

  if (!chat) {
    return res.status(404).json({ message: "Chat not found" });
  }

  res.json(chat);
})
export default router;

