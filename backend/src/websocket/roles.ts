import { type BotRole } from "./state";

export const botRoles: BotRole[] = [
  "MOVEMENT_AND_OTHER",
  "CAMERA",
  "SERVO",
  "WATER_PUMP",
];

export const isBotRole = (value: unknown): value is BotRole => {
  return typeof value === "string" && botRoles.includes(value as BotRole);
};
