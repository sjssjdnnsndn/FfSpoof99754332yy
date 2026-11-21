import { getTelegramUsersCollection } from "@workspace/db";

export interface BotStatistics {
  totalUsers: number;
  last7Days: number;
  last24Hours: number;
  today: number;
  yesterday: number;
  thisWeekDaily: { date: string; count: number }[];
  updatedAt: Date;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0,0,0,0);
  return d;
}

export async function getBotStatistics(): Promise<BotStatistics> {
  const col = await getTelegramUsersCollection();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7*24*60*60*1000);
  const oneDayAgo = new Date(now.getTime() - 24*60*60*1000);
  const todayStart = startOfDay(now);
  const yesterdayStart = new Date(todayStart.getTime() - 24*60*60*1000);
  const yesterdayEnd = new Date(todayStart.getTime() - 1);

  const [totalUsers, last7Days, last24Hours, today, yesterday] = await Promise.all([
    col.countDocuments({}),
    col.countDocuments({ firstSeenAt: { $gte: sevenDaysAgo } }),
    col.countDocuments({ firstSeenAt: { $gte: oneDayAgo } }),
    col.countDocuments({ firstSeenAt: { $gte: todayStart } }),
    col.countDocuments({ firstSeenAt: { $gte: yesterdayStart, $lte: yesterdayEnd } }),
  ]);

  // Daily breakdown for last 7 days
  const daily: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(todayStart.getTime() - i*24*60*60*1000);
    const dayEnd = new Date(dayStart.getTime() + 24*60*60*1000 - 1);
    const count = await col.countDocuments({ firstSeenAt: { $gte: dayStart, $lte: dayEnd } });
    const label = dayStart.toLocaleDateString("en-IN", { day:"2-digit", month:"short" });
    daily.push({ date: label, count });
  }

  return {
    totalUsers,
    last7Days,
    last24Hours,
    today,
    yesterday,
    thisWeekDaily: daily,
    updatedAt: now,
  };
}
