import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectToMongoDB } from "../connect/mongodb";
import { RobotConnection } from "../models/robotConnection";
import { Robot } from "../models/robot";
import User from "../models/user";

const robotId = "robot_prash_001";
const ownerPermissions = {
  view: true,
  control: true,
  configure: true,
  manageConnections: true,
};

async function seedRobot(): Promise<void> {
  const ownerEmail = process.env.ROBOT_OWNER_EMAIL?.trim().toLowerCase();

  if (!ownerEmail) {
    throw new Error("ROBOT_OWNER_EMAIL is required to assign the robot owner.");
  }

  await connectToMongoDB();

  const owner = await User.findOne({ email: ownerEmail });
  if (!owner) {
    throw new Error(`No user exists for ${ownerEmail}. Sign in with Google first.`);
  }

  let robot = await Robot.findOne({ robotId });
  let robotSecret: string | null = null;

  if (!robot) {
    robotSecret = crypto.randomBytes(32).toString("base64url");
    const robotSecretHash = await bcrypt.hash(robotSecret, 12);

    robot = await Robot.create({
      robotId,
      name: "prash",
      robotSecretHash,
      model: {
        name: "AgriBot X1",
        version: "1.0",
        manufacturer: "AgriBot",
      },
      firmwareVersion: "1.0.0",
      status: "offline",
    });
  }

  await RobotConnection.findOneAndUpdate(
    { robotId: robot._id, userId: owner._id },
    {
      $set: {
        role: "owner",
        status: "active",
        permissions: ownerPermissions,
      },
      $setOnInsert: {
        robotId: robot._id,
        userId: owner._id,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  console.log(`Robot ${robot.robotId} is assigned to ${owner.email} as owner.`);

  if (robotSecret) {
    console.log("Robot secret (save it now; it is not stored in MongoDB):");
    console.log(robotSecret);
  } else {
    console.log("Robot already existed; its secret was not regenerated.");
  }
}

void seedRobot()
  .catch((error: unknown) => {
    console.error("Robot seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
