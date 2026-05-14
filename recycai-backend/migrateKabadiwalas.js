/**
 * migrateKabadiwalas.js
 * ─────────────────────────────────────────────────────────────────
 * ONE-TIME migration script.
 *
 * What it does:
 *   1. Reads every document from the `kabadiwalas` collection.
 *   2. Writes each document into the `collectors` collection
 *      (preserving the same document ID and all fields).
 *   3. Deletes every document from `kabadiwalas`.
 *
 * Run once:  node migrateKabadiwalas.js
 * ─────────────────────────────────────────────────────────────────
 */

const { db, admin } = require('./firebase');

async function migrate() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  RecycAI — Kabadiwalas → Collectors Migration');
  console.log('═══════════════════════════════════════════════════\n');

  // 1. Read all kabadiwalas documents
  const kabadiSnap = await db.collection('kabadiwalas').get();

  if (kabadiSnap.empty) {
    console.log('⚠️  No documents found in `kabadiwalas`. Nothing to migrate.');
    process.exit(0);
  }

  console.log(`📦  Found ${kabadiSnap.size} document(s) in \`kabadiwalas\`.\n`);

  // 2. Batch-write into collectors (Firestore batch limit = 500 ops)
  const BATCH_LIMIT = 400; // safe margin (each doc = 1 write + 1 delete = 2 ops)
  let batch = db.batch();
  let opCount = 0;
  let migrated = 0;
  let skipped = 0;

  for (const doc of kabadiSnap.docs) {
    const data = doc.data();
    const collectorRef = db.collection('collectors').doc(doc.id);

    // Check if a collector with this ID already exists
    const existing = await collectorRef.get();
    if (existing.exists) {
      console.log(`  ⚠️  Skipping ${doc.id} — already exists in \`collectors\`.`);
      skipped++;
      continue;
    }

    // Write to collectors with same ID and all original fields
    batch.set(collectorRef, {
      ...data,
      migratedFrom: 'kabadiwalas',          // audit trail
      migratedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`  ✔  Queued ${doc.id} → collectors  (name: ${data.name || 'N/A'})`);
    opCount++;
    migrated++;

    // Commit when approaching batch limit
    if (opCount >= BATCH_LIMIT) {
      await batch.commit();
      console.log(`\n  ✅  Committed batch of ${opCount} writes.\n`);
      batch = db.batch();
      opCount = 0;
    }
  }

  // Commit remaining writes
  if (opCount > 0) {
    await batch.commit();
    console.log(`\n  ✅  Committed final batch of ${opCount} writes.`);
  }

  console.log(`\n📋  Migration summary:`);
  console.log(`    Migrated : ${migrated}`);
  console.log(`    Skipped  : ${skipped} (already in collectors)`);

  // 3. Delete all kabadiwalas documents
  if (migrated > 0) {
    console.log('\n🗑️   Deleting documents from `kabadiwalas`...\n');
    let delBatch = db.batch();
    let delCount = 0;

    for (const doc of kabadiSnap.docs) {
      delBatch.delete(db.collection('kabadiwalas').doc(doc.id));
      delCount++;

      if (delCount >= 400) {
        await delBatch.commit();
        console.log(`  ✅  Deleted batch of ${delCount} docs.`);
        delBatch = db.batch();
        delCount = 0;
      }
    }

    if (delCount > 0) {
      await delBatch.commit();
      console.log(`  ✅  Deleted final batch of ${delCount} docs.`);
    }

    console.log('\n  🏁  `kabadiwalas` collection is now empty (Firestore auto-removes empty collections).');
  } else {
    console.log('\n  ℹ️   No new documents were migrated, so `kabadiwalas` was left untouched.');
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  ✅  Migration complete!');
  console.log('═══════════════════════════════════════════════════\n');

  process.exit(0);
}

migrate().catch(err => {
  console.error('\n❌  Migration failed:', err.message);
  process.exit(1);
});
