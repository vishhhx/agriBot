import type { Request, Response } from "express";
import { RobotConnection } from "../models/robotConnection";
import { Robot, type IRobot } from "../models/robot";
import User from "../models/user";

type RobotSummary = Pick<
  IRobot,
  "robotId" | "name" | "model" | "firmwareVersion" | "status"
>;

const getUserWithRobotAccess = async (userId: string, robotId: string) => {
  const user = await User.findOne({ userId }).select("_id");

  if (!user) {
    return null;
  }

  const connection = await RobotConnection.findOne({
    userId: user._id,
    status: "active",
    "permissions.view": true,
  }).populate<{ robotId: RobotSummary }>({
    path: "robotId",
    model: Robot,
    match: { robotId },
    select: "robotId name model firmwareVersion status",
  });

  if (!connection || !connection.robotId || typeof connection.robotId !== "object") {
    return null;
  }

  return { connection, robot: connection.robotId };
};

export const getMyBots = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const user = await User.findOne({ userId: req.user.userId }).select("_id");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User session is no longer valid",
      });
    }

    const connections = await RobotConnection.find({
      userId: user._id,
      status: "active",
      "permissions.view": true,
    })
      .populate<{ robotId: RobotSummary }>({
        path: "robotId",
        model: Robot,
        select: "robotId name model firmwareVersion status",
      })
      .lean();

    const bots = connections.flatMap((connection) => {
      const robot = connection.robotId;

      if (!robot || typeof robot !== "object" || !("robotId" in robot)) {
        return [];
      }

      return [
        {
          robotId: robot.robotId,
          name: robot.name,
          model: robot.model,
          firmwareVersion: robot.firmwareVersion,
          status: robot.status,
          role: connection.role,
          permissions: connection.permissions,
          connectedAt: connection.connectedAt,
        },
      ];
    });

    return res.status(200).json({
      success: true,
      data: bots,
    });
  } catch (error) {
    console.error("Get my bots error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load your bots",
    });
  }
};

export const getBotById = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const robotId = req.params.robotId;

    if (typeof robotId !== "string" || !robotId) {
      return res.status(400).json({
        success: false,
        message: "A robotId is required",
      });
    }

    const access = await getUserWithRobotAccess(req.user.userId, robotId);

    if (!access) {
      return res.status(404).json({
        success: false,
        message: "Bot not found or you do not have access to it",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        robotId: access.robot.robotId,
        name: access.robot.name,
        model: access.robot.model,
        firmwareVersion: access.robot.firmwareVersion,
        status: access.robot.status,
        role: access.connection.role,
        permissions: access.connection.permissions,
        connectedAt: access.connection.connectedAt,
      },
    });
  } catch (error) {
    console.error("Get bot error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load this bot",
    });
  }
};
