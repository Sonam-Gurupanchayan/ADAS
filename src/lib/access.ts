import type { Firmware, Group, SensorUser } from "./types";

/** Union of sensor models granted to a user through their groups. */
export function entitledModelIds(user: Pick<SensorUser, "groupIds">, groups: Pick<Group, "_id" | "modelIds">[]) {
  const mine = new Set(user.groupIds);
  const ids = new Set<string>();
  for (const g of groups) if (mine.has(g._id)) for (const m of g.modelIds) ids.add(m);
  return [...ids];
}

/** A sensor user may see/download firmware only if it is published and covers one of their models. */
export function canSensorUserAccess(
  user: Pick<SensorUser, "status" | "groupIds">,
  groups: Pick<Group, "_id" | "modelIds">[],
  fw: Pick<Firmware, "status" | "modelIds">,
) {
  if (user.status !== "active") return false;
  if (fw.status !== "published") return false;
  const models = new Set(entitledModelIds(user, groups));
  return fw.modelIds.some((m) => models.has(m));
}
