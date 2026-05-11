
import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ["user", "assistant"],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Keep ChatCollection lean — messages + chat metadata only
const chatSchema = new mongoose.Schema({
  userId:    String,
  chatId:    { type: String, required: true, index: true },
  title:     { type: String, default: "New Chat" },
  messages:  [messageSchema],
  createdAt: Date,
  updatedAt: Date,
});

// auto update updatedAt
chatSchema.pre("save", async function () {
  this.updatedAt = Date.now();
  
});



export default mongoose.model("Chat", chatSchema);