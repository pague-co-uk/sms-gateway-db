import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

// Explicitly local, opt-in synthetic data. Never invokes APIs, queues or outbox producers.
const database = new URL(process.env.DATABASE_URL ?? '');
if (!['localhost', '127.0.0.1', '[::1]'].includes(database.hostname)) throw new Error('Dashboard demo seeding only supports a local database.');
const apply = process.argv.includes('--apply');
const db = new PrismaClient();
const marker = 'dashboard-demo-v1';
const uuid = value => {
  const hex = createHash('sha256').update(`${marker}:${value}`).digest('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
};
const businesses = [
  { name: 'Lakeview Retail', senders: ['DEMO-SHOP', 'DEMO-DEALS'], today: 180 },
  { name: 'Moyo Health', senders: ['DEMO-HEALTH', 'DEMO-CARE'], today: 120 },
  { name: 'Bright Academy', senders: ['DEMO-SCHOOL', 'DEMO-EXAMS'], today: 75 },
  { name: 'Swift Logistics', senders: ['DEMO-SWIFT', 'DEMO-TRACK'], today: 45 },
];
const now = new Date();
const localDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Blantyre', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
const midnight = new Date(`${localDay}T00:00:00+02:00`);
const year = Number(localDay.slice(0,4));
const month = Number(localDay.slice(5,7));
const batches = [];
for (let client = 0; client < businesses.length; client++) {
  batches.push({ client, day: midnight, count: businesses[client].today, today: true });
  for (let ago = 1; ago <= 14; ago++) batches.push({ client, day: new Date(+midnight - ago * 86400000), count: [10,7,5,3][client] + (ago % 4) });
  for (let m = 1; m < month; m++) batches.push({ client, day: new Date(`${year}-${String(m).padStart(2,'0')}-12T00:00:00+02:00`), count: 8 + m * 2 + (3-client)*3 });
}
const planned = batches.reduce((sum, batch) => sum + batch.count, 0);
const summary = { mode: apply ? 'apply' : 'preview', localDay, clients: businesses.length, senderIds: businesses.length * 2, todayMessages: businesses.reduce((sum,b) => sum+b.today,0), plannedMessages: planned };
console.log(JSON.stringify(summary));
if (!apply) { await db.$disconnect(); process.exit(0); }
try {
  const [connector, networks] = await Promise.all([
    db.connector.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } }),
    db.mobileNetwork.findMany({ where: { country: { code: { in: ['MW','KE'] } } }, select: { id: true, name: true }, orderBy: { name: 'asc' }, take: 3 }),
  ]);
  if (!connector || !networks.length) throw new Error('Existing connector and MW/KE network records are required.');
  const clientIds = businesses.map((_,i) => uuid(`client:${i}`));
  const before = await db.message.count({ where: { clientId: { in: clientIds } } });
  const messages = [], attempts = [], events = [];
  for (const batch of batches) for (let index = 0; index < batch.count; index++) {
    const day = new Date(+batch.day + 7200000).toISOString().slice(0,10).replaceAll('-','');
    const key = `${batch.client}:${day}:${index}`;
    const id = uuid(`message:${key}`);
    const createdAt = new Date(+batch.day + Math.floor((index+1)/(batch.count+1) * (batch.today ? Math.max(0,+now-60000- +batch.day) : 22*3600000)));
    const roll = (index * 37 + batch.client * 11) % 100;
    const status = roll < 80 ? 'DELIVERED' : roll < 90 ? 'SUBMITTED' : roll < 98 ? 'FAILED' : 'EXPIRED';
    const routingFailure = roll >= 90 && roll < 94;
    const segments = index % 10 < 7 ? 1 : index % 10 < 9 ? 2 : 3;
    const submittedAt = routingFailure ? null : new Date(+createdAt + 1000);
    const network = index % networks.length;
    const attemptId = uuid(`attempt:${key}`);
    messages.push({ id, publicId: `DG${batch.client}${day}${String(index).padStart(4,'0')}`, clientId: clientIds[batch.client], senderIdId: uuid(`sender:${batch.client}:${index % 4 === 0 ? 1 : 0}`), destination: `+265000${String(batch.client*100000+index).padStart(6,'0')}`, body: `[DEMO: dashboard preview only] ${businesses[batch.client].name} notification. `.padEnd(segments === 1 ? 100 : segments*153-10, 'x'), encoding: 'GSM7', segmentCount: segments, currentStatus: status, routingStatus: status === 'FAILED' ? 'FAILED' : 'SUBMITTED', currentAttemptNumber: routingFailure ? 0 : 1, submittedAt, createdAt, updatedAt: new Date(+createdAt+4000) });
    if (!routingFailure) attempts.push({ id: attemptId, messageId: id, routeId: uuid(`route:${batch.client}:${network}`), connectorId: connector.id, attemptNumber: 1, priority: 1, status: status === 'FAILED' ? 'FAILED' : 'SUBMITTED', providerMessageId: `DEMO-${day}-${batch.client}-${index}`, errorCode: status === 'FAILED' ? 'DEMO_REJECTED' : null, errorMessage: status === 'FAILED' ? 'Synthetic rejection for dashboard preview.' : null, submittedAt: status === 'FAILED' ? null : submittedAt, dispatchedAt: createdAt, startedAt: createdAt, failedAt: status === 'FAILED' ? new Date(+createdAt+2000) : null, completedAt: new Date(+createdAt+2000), createdAt, updatedAt: new Date(+createdAt+2000) });
    events.push({ id: uuid(`event:${key}`), messageId: id, attemptId: routingFailure ? null : attemptId, status, source: 'dashboard-demo', description: 'Synthetic dashboard preview; no SMS sent.', rawData: { demo: true, seed: marker }, createdAt: new Date(+createdAt+3000) });
  }
  await db.$transaction(async tx => {
    for (let c = 0; c < businesses.length; c++) {
      await tx.client.upsert({ where: { id: clientIds[c] }, update: {}, create: { id: clientIds[c], publicId: `DG-DEMO-CLIENT-${c}`, companyName: `[Demo] ${businesses[c].name}`, displayName: `[Demo] ${businesses[c].name}`, email: `dashboard-demo-${c}@example.invalid`, status: 'DISABLED', timezone: 'Africa/Blantyre', metadata: { demo: true, seed: marker } } });
      for (let s = 0; s < 2; s++) await tx.senderId.upsert({ where: { id: uuid(`sender:${c}:${s}`) }, update: {}, create: { id: uuid(`sender:${c}:${s}`), publicId: `DG-DEMO-SENDER-${c}${s}`, clientId: clientIds[c], sender: businesses[c].senders[s], status: 'DISABLED' } });
      for (let n = 0; n < networks.length; n++) await tx.route.upsert({ where: { id: uuid(`route:${c}:${n}`) }, update: {}, create: { id: uuid(`route:${c}:${n}`), publicId: `DG-DEMO-ROUTE-${c}${n}`, clientId: clientIds[c], mobileNetworkId: networks[n].id, connectorId: connector.id, priority: 1, status: 'DISABLED' } });
    }
    for (const [model, rows] of [[tx.message,messages],[tx.messageRouteAttempt,attempts],[tx.messageStatusEvent,events]]) {
      for (let offset = 0; offset < rows.length; offset += 200) await model.createMany({ data: rows.slice(offset,offset+200), skipDuplicates: true });
    }
  }, { timeout: 60000 });
  const saved = await db.message.aggregate({ where: { clientId: { in: clientIds } }, _count: { _all: true }, _sum: { segmentCount: true } });
  const today = await db.message.count({ where: { clientId: { in: clientIds }, createdAt: { gte: midnight, lte: now } } });
  console.log(JSON.stringify({ insertedMessages: saved._count._all-before, totalDemoMessages: saved._count._all, todayDemoMessages: today, demoSegments: saved._sum.segmentCount, networks: networks.map(n=>n.name), outboxEventsCreated: 0, liveRequestsSent: 0 }));
} finally { await db.$disconnect(); }
