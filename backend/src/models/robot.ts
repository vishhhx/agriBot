import mongoose, { type Model, Schema } from "mongoose";

export const robotStatuses = [
  "online",
  "offline",
  "idle",
  "busy",
  "maintenance",
] as const;

export type RobotStatus = (typeof robotStatuses)[number];

export interface IRobot {
  robotId: string;
  name: string;
  robotSecretHash: string;
  model: {
    name: string;
    version: string;
    manufacturer: string;
  };
  firmwareVersion: string;
  status: RobotStatus;
  createdAt: Date;
  updatedAt: Date;
}

const robotSchema = new Schema<IRobot>(
  {
    robotId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // Never return this field in normal queries or API responses.
    robotSecretHash: {
      type: String,
      required: true,
      select: false,
    },
    model: {
      name: {
        type: String,
        required: true,
      },
      version: {
        type: String,
        required: true,
      },
      manufacturer: {
        type: String,
        required: true,
      },
    },
    firmwareVersion: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: robotStatuses,
      default: "offline",
    },
  },
  { timestamps: true },
);

export const Robot: Model<IRobot> =
  mongoose.models.Robot || mongoose.model<IRobot>("Robot", robotSchema);
