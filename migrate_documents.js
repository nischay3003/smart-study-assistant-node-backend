import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import Chat from "./src/models/ChatCollection.js";

async function removeDocumentsField() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const result = await Chat.collection.updateMany(
      { documents: { $exists: true } },
      { $unset: { documents: "" } }
    );

    console.log(result);

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

removeDocumentsField();