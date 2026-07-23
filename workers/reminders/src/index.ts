import { getAccessToken, ServiceAccountKey } from './googleAuth';
import { getDocument, listDocuments, patchDocument, deleteDocument } from './firestore';
import { sendPush } from './fcm';
import { zonedParts, zonedDateId, zonedWeekday } from './dateUtils';
import { shouldFireDaily, shouldFireWeekly } from './reminders';
import { isBillDueToday, isChoreDueToday, daysInMonthFor, Bill, ChoreConfig } from './dueChecks';

export interface Env {
  GOOGLE_SERVICE_ACCOUNT_KEY: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_UID: string;
}

interface ReminderConfig {
  workoutTime: string;
  dinnerTime: string;
  learningTime: string;
  weeklyReviewTime: string;
  timezone: string;
}

const DEFAULT_REMINDER_CONFIG: ReminderConfig = {
  workoutTime: '06:45',
  dinnerTime: '19:00',
  learningTime: '20:00',
  weeklyReviewTime: '18:00',
  timezone: 'UTC',
};

const MORNING_CHECK_TIME = '07:30';

const SCOPES = ['https://www.googleapis.com/auth/datastore', 'https://www.googleapis.com/auth/firebase.messaging'];

interface DailyReminderDef {
  key: string;
  getTime: (config: ReminderConfig) => string;
  title: string;
  body: string;
}

const DAILY_REMINDERS: DailyReminderDef[] = [
  { key: 'workout', getTime: (c) => c.workoutTime, title: 'Workout time', body: "It's time for your workout." },
  { key: 'dinner', getTime: (c) => c.dinnerTime, title: 'Dinner prep', body: 'Time to start prepping dinner.' },
  { key: 'learning', getTime: (c) => c.learningTime, title: 'Learning time', body: "It's time for your learning session." },
];

function decodeReminderConfig(data: Record<string, unknown> | null): ReminderConfig {
  if (!data) return DEFAULT_REMINDER_CONFIG;
  return {
    workoutTime: typeof data.workoutTime === 'string' ? data.workoutTime : DEFAULT_REMINDER_CONFIG.workoutTime,
    dinnerTime: typeof data.dinnerTime === 'string' ? data.dinnerTime : DEFAULT_REMINDER_CONFIG.dinnerTime,
    learningTime: typeof data.learningTime === 'string' ? data.learningTime : DEFAULT_REMINDER_CONFIG.learningTime,
    weeklyReviewTime:
      typeof data.weeklyReviewTime === 'string' ? data.weeklyReviewTime : DEFAULT_REMINDER_CONFIG.weeklyReviewTime,
    timezone: typeof data.timezone === 'string' ? data.timezone : DEFAULT_REMINDER_CONFIG.timezone,
  };
}

function lastSentDateOf(state: Record<string, unknown> | null): string | null {
  return typeof state?.lastSentDate === 'string' ? state.lastSentDate : null;
}

interface PushJob {
  key: string;
  todayId: string;
  title: string;
  body: string;
}

export async function runReminderCheck(env: Env, now: Date = new Date()): Promise<void> {
  const key = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY) as ServiceAccountKey;
  const accessToken = await getAccessToken(key, SCOPES);
  const projectId = env.FIREBASE_PROJECT_ID;
  const base = `users/${env.FIREBASE_UID}`;

  const configData = await getDocument(projectId, accessToken, `${base}/config/reminders`);
  const config = decodeReminderConfig(configData);

  const jobs: PushJob[] = [];

  for (const reminder of DAILY_REMINDERS) {
    const state = await getDocument(projectId, accessToken, `${base}/reminderState/${reminder.key}`);
    const check = shouldFireDaily(now, config.timezone, reminder.getTime(config), lastSentDateOf(state));
    if (check.fire) jobs.push({ key: reminder.key, todayId: check.todayId, title: reminder.title, body: reminder.body });
  }

  const reviewState = await getDocument(projectId, accessToken, `${base}/reminderState/weeklyReview`);
  const reviewCheck = shouldFireWeekly(now, config.timezone, config.weeklyReviewTime, 0, lastSentDateOf(reviewState));
  if (reviewCheck.fire) {
    jobs.push({ key: 'weeklyReview', todayId: reviewCheck.todayId, title: 'Weekly review', body: 'Time for your weekly review.' });
  }

  const billState = await getDocument(projectId, accessToken, `${base}/reminderState/billDue`);
  const billCheck = shouldFireDaily(now, config.timezone, MORNING_CHECK_TIME, lastSentDateOf(billState));
  if (billCheck.fire) {
    const { year, month, day } = zonedParts(now, config.timezone);
    const bills = await listDocuments(projectId, accessToken, `${base}/bills`);
    const dueBills = bills
      .map((d) => ({ id: d.id, ...d.data }) as Bill)
      .filter((bill) => isBillDueToday(bill, day, daysInMonthFor(year, month)));
    if (dueBills.length > 0) {
      jobs.push({ key: 'billDue', todayId: billCheck.todayId, title: 'Bills due today', body: dueBills.map((b) => b.name).join(', ') });
    } else {
      await patchDocument(projectId, accessToken, `${base}/reminderState/billDue`, { lastSentDate: billCheck.todayId });
    }
  }

  const choreState = await getDocument(projectId, accessToken, `${base}/reminderState/choreDue`);
  const choreCheck = shouldFireDaily(now, config.timezone, MORNING_CHECK_TIME, lastSentDateOf(choreState));
  if (choreCheck.fire) {
    const dow = zonedWeekday(now, config.timezone);
    const todayId = zonedDateId(now, config.timezone);
    const chores = await listDocuments(projectId, accessToken, `${base}/chores`);
    const completion = await getDocument(projectId, accessToken, `${base}/completions/${todayId}`);
    const completedChoreIds = (completion?.chores as Record<string, boolean> | undefined) ?? {};
    const dueChores = chores
      .map((d) => ({ id: d.id, ...d.data }) as ChoreConfig)
      .filter((chore) => isChoreDueToday(chore, dow) && !completedChoreIds[chore.id]);
    if (dueChores.length > 0) {
      jobs.push({ key: 'choreDue', todayId: choreCheck.todayId, title: 'Chores due today', body: dueChores.map((c) => c.name).join(', ') });
    } else {
      await patchDocument(projectId, accessToken, `${base}/reminderState/choreDue`, { lastSentDate: choreCheck.todayId });
    }
  }

  if (jobs.length === 0) return;

  const tokens = await listDocuments(projectId, accessToken, `${base}/fcmTokens`);

  for (const job of jobs) {
    for (const tokenDoc of tokens) {
      const token = tokenDoc.data.token as string;
      const result = await sendPush({ projectId, accessToken, token, title: job.title, body: job.body });
      if (result.invalidToken) {
        await deleteDocument(projectId, accessToken, `${base}/fcmTokens/${tokenDoc.id}`);
      }
    }
    await patchDocument(projectId, accessToken, `${base}/reminderState/${job.key}`, { lastSentDate: job.todayId });
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response('ok');
  },
  async scheduled(_controller: unknown, env: Env, ctx: { waitUntil: (promise: Promise<unknown>) => void }): Promise<void> {
    ctx.waitUntil(runReminderCheck(env));
  },
};
