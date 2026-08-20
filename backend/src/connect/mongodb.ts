import { connect } from "mongoose";

const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/agriBot";

export const connectToMongoDB = async (): Promise<void> => {
  try {
    await connect(mongoUri);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    throw error;
  }
};
