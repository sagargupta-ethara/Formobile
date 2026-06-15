import "server-only";
import { prisma } from "./db";

export interface NotificationInput {
  type: string;
  title: string;
  body?: string;
  link?: string;
}

/** Fan a notification out to a set of users. Never throws into the request path. */
export async function notify(
  userIds: string[],
  n: NotificationInput
): Promise<void> {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (ids.length === 0) return;
  try {
    await prisma.notification.createMany({
      data: ids.map((userId) => ({
        userId,
        type: n.type,
        title: n.title,
        body: n.body,
        link: n.link,
      })),
    });
  } catch (err) {
    console.error("notify failed", err);
  }
}

/** Active on-site reviewers a category routes to (matching or unset specialization). */
export async function routedReviewerIds(
  specializationId: string | null
): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      role: "ONSITE",
      status: "ACTIVE",
      ...(specializationId
        ? { OR: [{ specializationId }, { specializationId: null }] }
        : {}),
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/** All active admins. */
export async function adminIds(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE" },
    select: { id: true },
  });
  return users.map((u) => u.id);
}
