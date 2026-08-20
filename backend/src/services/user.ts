import crypto from "node:crypto";
import User from "../models/user";

interface CreateGoogleUserParams {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export const findUserByEmail = async (email: string) => {
  return User.findOne({
    email: email.toLowerCase(),
  });
};

export const findUserById = async (userId: string) => {
  return User.findOne({
    userId,
  });
};

export const findUserByGoogleId = async (googleId: string) => {
  return User.findOne({
    googleId,
  });
};

export const createGoogleUser = async ({
  googleId,
  email,
  name,
  avatarUrl,
}: CreateGoogleUserParams) => {
  return User.create({
    userId: crypto.randomUUID(),
    googleId,
    email: email.toLowerCase(),
    name: name.slice(0, 30),
    avatarUrl,
    services: [],
  });
};

export const updateGoogleUser = async (
  userId: string,
  data: {
    googleId?: string;
    name?: string;
    avatarUrl?: string;
  },
) => {
  return User.findOneAndUpdate(
    { userId },
    {
      $set: data,
    },
    {
      new: true,
    },
  );
};
