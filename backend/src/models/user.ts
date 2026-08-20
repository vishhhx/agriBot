import mongoose, { Document, Model, Schema } from "mongoose";

export interface IUser extends Document {
  userId: string;
  googleId?: string;

  email: string;
  name: string;
  avatarUrl?: string;

  services: string[];

  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    googleId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },

    avatarUrl: {
      type: String,
      default: null,
    },

    services: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", userSchema);

export default User;
