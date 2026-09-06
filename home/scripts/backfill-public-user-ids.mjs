import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || 'goatest-2525';
const credential = process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY
  ? cert({
      projectId,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
    })
  : applicationDefault();

if (!getApps().length) initializeApp({ credential, projectId });

const db = getFirestore();
const users = await db.collection('users').get();
const mappings = [];
const conflicts = [];

for (const snapshot of users.docs) {
  const profile = snapshot.data();
  const publicId = typeof profile.uniqueId === 'string' ? profile.uniqueId.trim().toUpperCase() : '';
  if (!['USER', 'CARETAKER'].includes(profile.role) || !publicId) continue;

  const mappingRef = db.collection('public_user_ids').doc(publicId);
  const existing = await mappingRef.get();
  if (existing.exists && existing.data().uid !== snapshot.id) {
    conflicts.push({ publicId, existingUid: existing.data().uid, profileUid: snapshot.id });
    continue;
  }

  mappings.push({
    ref: mappingRef,
    data: {
      uid: snapshot.id,
      publicId,
      role: profile.role,
      name: profile.name || profile.displayName || 'Name unavailable',
      displayName: profile.displayName || profile.name || 'Name unavailable',
      updatedAt: new Date().toISOString(),
    },
  });
}

if (conflicts.length > 0) {
  console.error(JSON.stringify({ status: 'CONFLICT', conflicts }, null, 2));
  process.exitCode = 2;
} else {
  for (let offset = 0; offset < mappings.length; offset += 450) {
    const batch = db.batch();
    for (const item of mappings.slice(offset, offset + 450)) batch.set(item.ref, item.data, { merge: true });
    await batch.commit();
  }
  console.log(JSON.stringify({ status: 'BACKFILLED', count: mappings.length }, null, 2));
}
