import express from "express";
import { v4 as uuidv4 } from "uuid";
const router = express.Router();

import Chat from "../models/ChatCollection.js   ";
import Document from "../models/Document.js";
import axios from "axios";
import mongoose from "mongoose";

router.get("/title", async (req, res) => {
  try {
    const chatId = req.headers["x-chat-id"];
    if (!chatId) {
      return res.status(400).json({
        error: "Chat ID header (x-chat-id) is required",
      });
    }
    const chatHistory = await Chat.findOne({ chatId });
    if (!chatHistory || chatHistory.messages.length === 0) {
      return res.json({
        title: "New Chat",
      });
    }
    const lastUserMessage = [...chatHistory.messages]
      .reverse()
      .find((m) => m.role === "user");
    const title = lastUserMessage
      ? lastUserMessage.content.slice(0, 20) + "..."
      : "Chat";
    res.json({
      title,
    });
  } catch (err) {
    console.error("Error fetching chat title:", err);
    res.status(500).json({ error: "Failed to fetch chat title" });
  }
});

router.get("/history/:chatId", async (req, res) => {
  try {
    const chatId = req.params.chatId;
    if (!chatId) {
      return res.status(400).json({
        error: "Chat ID required",
      });
    }
    const chatHistory = await Chat.findOne({ chatId });
    if (!chatHistory) {
      return res.json({
        messages: [],
      });
    }
    const documents = await Document.find({ chatId }).sort({ uploadedAt: -1 });
    res.json({
      messages: chatHistory.messages,
      documents,
    });
  } catch (err) {
    console.error("Error fetching chat history:", err);
    res.status(500).json({ error: "Failed to fetch chat history" });
  }
});
router.post("/create", async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log("UserId in create chat:", userId);
    if (!userId) {
      return res.status(400).json({
        error: "User ID required",
      });
    }
    const chatId = uuidv4();
    const newChat = await Chat.findOneAndUpdate(
      { chatId },
      {
        $setOnInsert: { chatId, userId },
        $push: {
          messages: {
            $each: [],
          },
        },
      },
      { upsert: true, returnDocument: "after" },
    );

    res.json({
      newChat,
    });
  } catch (err) {
    console.error("Error creating chat:", err);
    res.status(500).json({ error: "Failed to create chat" });
  }
});
router.get("/", async (req, res) => {
  const userId = req.user.userId;

  const chats = await Chat.find({ userId })
    .sort({ updatedAt: -1 })
    .select("chatId title updatedAt");

  res.json(chats);
});
router.get("/:$chatId", async (req, res) => {
  const { chatId } = req.params;
  const userId = req.user.userId;
  console.log("UserId in chats:", userId);

  const chat = await Chat.findOne({ chatId, userId });

  if (!chat) {
    return res.status(404).json({ message: "Chat not found" });
  }

  res.json(chat);
});

router.delete("/:chatId", async (req, res) => {
  console.log("Delete chat request received");
  try {
    const { chatId } = req.params;
    const userId = req.user.userId;
    const userChat = await Chat.findOne({ chatId, userId });
    if (!userChat) {
      return res.status(404).json({ message: "Chat not found" });
    }
   
    const chatDocs=await Document.find({ chatId });
    console.log(`Found ${chatDocs.length} documents associated with chat`,chatDocs);

    const docIds = chatDocs
      .filter((doc) => doc.source === "personal")
      .map((doc) => doc.doc_id);

    if (docIds.length > 0) {
      const aiResponse = await axios.post(
        `${process.env.AI_SERVICE_URL}/doc/bulk-delete`,
        {
          chat_id: chatId,
          doc_ids: docIds,
        },
      );

      // check backend success
      if (aiResponse.status !== 200 || !aiResponse.data.success) {
        console.log("AI Service bulk delete failed:", aiResponse.data);
        return res.status(500).json({
          error: "Failed to delete embeddings",
          failed_docs: aiResponse.data.failed_docs || [],
        });
      }
    }
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "documents",
    });
    

    for (const doc of chatDocs) {
      if (!doc.gridfs_file_id) continue;

      try {
        await bucket.delete(doc.gridfs_file_id);
      } catch (err) {
        console.error(`GridFS delete failed for ${doc.doc_id}:`, err.message);
      }
    }

    await Chat.deleteOne({ chatId, userId });
    return res.json({
      success: true,
      message: "Chat and associated documents deleted",
    });
  } catch (err) {
    console.error("Error deleting chat:", err);

    return res.status(500).json({
      success: false,
      error: "Failed to delete chat",
    });
  }
});
export default router;
