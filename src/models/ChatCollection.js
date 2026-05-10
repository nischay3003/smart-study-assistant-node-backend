
import mongoose from "mongoose";
console.log("Updated 2 Model Schema......")

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

// const chatSchema = new mongoose.Schema({
//   userId:{
//     type:String,
//     required:true,
//     index:true,
//   },
//   chatId: {
//     type: String,
//     required: true,
//     index: true,
//   },

//   title: {
//     type: String,
//     default: "New Chat",
//   },

//   messages: [messageSchema],
//     documents: {
//     type: [
//         {
//         name: String,
//         doc_id: { type: String, required: true },
//         uploadedAt: {
//             type: Date,
//             default: Date.now
//         },
//         fileHash: { type: String ,required:true},
//         }
//     ],
//     default: []
    
//     },

//   createdAt: {
//     type: Date,
//     default: Date.now,
//   },

//   updatedAt: {
//     type: Date,
//     default: Date.now,
//   },
// });

const documentSchema = new mongoose.Schema({

  // 🔥 display title
  title: {
    type: String,
    default: "Untitled"
  },

  // 🔥 original filename
  filename: {
    type: String,
    default: null
  },

  // 🔥 internal document id
  doc_id: {
    type: String,
    required: true,
    index: true
  },

  // 🔥 GridFS file reference
  gridfs_file_id: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },

  // 🔥 mime type
  mimeType: {
    type: String,
    default: null
  },

  // 🔥 file size
  size: {
    type: Number,
    default: 0
  },

  // 🔥 optional category
  category: {
    type: String,
    default: "General"
  },

  // 🔥 optional description
  description: {
    type: String,
    default: ""
  },

  // 🔥 file hash for dedupe
  fileHash: {
    type: String,
    required: true
  },

  // 🔥 file or raw text
  type: {
    type: String,
    enum: ["file", "text"],
    default: "file"
  },

  // 🔥 personal/global/system
  source: {
    type: String,
    enum: ["personal", "global"],
    default: "personal"
  },

  uploadedAt: {
    type: Date,
    default: Date.now
  }

});


const chatSchema = new mongoose.Schema({

  userId: {

    type: String,

    required: function () {
      return this.chatId !== "global";
    },

    index: true
  },

  chatId: {

    type: String,

    required: true,

    index: true
  },

  title: {

    type: String,

    default: "New Chat"
  },

  messages: [messageSchema],

  // 🔥 upgraded documents schema
  documents: {

    type: [documentSchema],

    default: []
  },

  createdAt: {

    type: Date,

    default: Date.now
  },

  updatedAt: {

    type: Date,

    default: Date.now
  }

});

// auto update updatedAt
chatSchema.pre("save", async function () {
  this.updatedAt = Date.now();
  
});



export default mongoose.model("Chat", chatSchema);