import mongoose, { type Model, Schema, type Types } from "mongoose";

export const robotRoles = [
  "owner",
  "operator",
  "viewer",
  "technician",
] as const;

export const robotConnectionStatuses = ["active", "revoked"] as const;

export type RobotRole = (typeof robotRoles)[number];
export type RobotConnectionStatus = (typeof robotConnectionStatuses)[number];

export interface RobotPermissions {
  view: boolean;
  control: boolean;
  configure: boolean;
  manageConnections: boolean;
}

export interface IRobotConnection {
  robotId: Types.ObjectId;
  userId: Types.ObjectId;
  role: RobotRole;
  status: RobotConnectionStatus;
  permissions: RobotPermissions;
  connectedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const robotConnectionSchema = new Schema<IRobotConnection>(
  {
    robotId: {
      type: Schema.Types.ObjectId,
      ref: "Robot",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: robotRoles,
      required: true,
      default: "viewer",
    },
    status: {
      type: String,
      enum: robotConnectionStatuses,
      default: "active",
    },
    permissions: {
      view: {
        type: Boolean,
        default: true,
      },
      control: {
        type: Boolean,
        default: false,
      },
      configure: {
        type: Boolean,
        default: false,
      },
      manageConnections: {
        type: Boolean,
        default: false,
      },
    },
    connectedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

robotConnectionSchema.index({ robotId: 1, userId: 1 }, { unique: true });

export const RobotConnection: Model<IRobotConnection> =
  mongoose.models.RobotConnection ||
  mongoose.model<IRobotConnection>("RobotConnection", robotConnectionSchema);
