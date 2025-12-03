/**
 * Browser Console Migration Script
 *
 * To use:
 * 1. Open the ClassPoints app in your browser
 * 2. Make sure you're logged in to Supabase (sign up/login in the app first)
 * 3. Open DevTools (F12) -> Console
 * 4. Copy and paste this entire script
 * 5. Press Enter to run
 */

(async function migrateLocalStorageToSupabase() {
  console.log('=== ClassPoints Migration ===\n');

  // Check if we're in the right app
  const STORAGE_KEY = 'classpoints-state';
  const localData = localStorage.getItem(STORAGE_KEY);

  if (!localData) {
    console.error('No localStorage data found!');
    console.log('Make sure you are on the ClassPoints app page.');
    return;
  }

  const data = JSON.parse(localData);
  console.log('Found localStorage data:');
  console.log(`  Classrooms: ${data.classrooms?.length || 0}`);
  console.log(`  Students: ${data.classrooms?.reduce((sum, c) => sum + c.students.length, 0) || 0}`);
  console.log(`  Behaviors: ${data.behaviors?.length || 0}`);
  console.log(`  Transactions: ${data.transactions?.length || 0}`);
  console.log('');

  // Get Supabase client from window (if app is using it)
  if (!window.__SUPABASE_CLIENT__) {
    console.error('Supabase client not found!');
    console.log('The app needs to expose the Supabase client.');
    console.log('Use the CLI migration script instead: npm run migrate');
    return;
  }

  const supabase = window.__SUPABASE_CLIENT__;

  // Check auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error('Not authenticated!');
    console.log('Please sign in to the app first, then run this script again.');
    return;
  }

  console.log(`Authenticated as: ${user.email}`);
  console.log('Starting migration...\n');

  const userId = user.id;
  const classroomIdMap = new Map();
  const studentIdMap = new Map();
  const behaviorIdMap = new Map();

  // 1. Migrate classrooms
  console.log('Migrating classrooms...');
  for (const classroom of data.classrooms) {
    const { data: inserted, error } = await supabase
      .from('classrooms')
      .insert({ name: classroom.name, user_id: userId })
      .select()
      .single();

    if (error) {
      console.error(`  Failed: ${classroom.name} - ${error.message}`);
      continue;
    }

    classroomIdMap.set(classroom.id, inserted.id);
    console.log(`  OK: ${classroom.name}`);
  }

  // 2. Migrate students
  console.log('\nMigrating students...');
  for (const classroom of data.classrooms) {
    const newClassroomId = classroomIdMap.get(classroom.id);
    if (!newClassroomId) continue;

    for (const student of classroom.students) {
      const { data: inserted, error } = await supabase
        .from('students')
        .insert({
          classroom_id: newClassroomId,
          name: student.name,
          avatar_color: student.avatarColor || null,
          user_id: userId,
        })
        .select()
        .single();

      if (error) {
        console.error(`  Failed: ${student.name} - ${error.message}`);
        continue;
      }

      studentIdMap.set(student.id, inserted.id);
      console.log(`  OK: ${student.name}`);
    }
  }

  // 3. Map behaviors
  console.log('\nMapping behaviors...');
  const { data: existingBehaviors } = await supabase.from('behaviors').select('id, name');

  if (existingBehaviors) {
    for (const behavior of data.behaviors) {
      const existing = existingBehaviors.find(b =>
        b.name.toLowerCase() === behavior.name.toLowerCase()
      );
      if (existing) {
        behaviorIdMap.set(behavior.id, existing.id);
        console.log(`  Mapped: ${behavior.name}`);
      }
    }
  }

  // Migrate custom behaviors
  const customBehaviors = data.behaviors.filter(b => b.isCustom);
  for (const behavior of customBehaviors) {
    if (behaviorIdMap.has(behavior.id)) continue;

    const { data: inserted, error } = await supabase
      .from('behaviors')
      .insert({
        name: behavior.name,
        points: behavior.points,
        icon: behavior.icon,
        category: behavior.category,
        is_custom: true,
        user_id: userId,
      })
      .select()
      .single();

    if (error) {
      console.error(`  Failed: ${behavior.name} - ${error.message}`);
      continue;
    }

    behaviorIdMap.set(behavior.id, inserted.id);
    console.log(`  Created: ${behavior.name}`);
  }

  // 4. Migrate transactions
  console.log('\nMigrating transactions...');
  let migratedCount = 0;
  const batchSize = 50;

  for (let i = 0; i < data.transactions.length; i += batchSize) {
    const batch = data.transactions.slice(i, i + batchSize);
    const transformedBatch = [];

    for (const t of batch) {
      const studentId = studentIdMap.get(t.studentId);
      const classroomId = classroomIdMap.get(t.classroomId);

      if (!studentId || !classroomId) continue;

      transformedBatch.push({
        student_id: studentId,
        classroom_id: classroomId,
        behavior_id: behaviorIdMap.get(t.behaviorId) || null,
        behavior_name: t.behaviorName,
        behavior_icon: t.behaviorIcon,
        points: t.points,
        note: t.note || null,
        user_id: userId,
      });
    }

    if (transformedBatch.length > 0) {
      const { error } = await supabase.from('point_transactions').insert(transformedBatch);

      if (error) {
        console.error(`  Batch error: ${error.message}`);
      } else {
        migratedCount += transformedBatch.length;
      }
    }
  }
  console.log(`  Migrated: ${migratedCount} transactions`);

  // Summary
  console.log('\n=== Migration Complete ===');
  console.log(`Classrooms: ${classroomIdMap.size}`);
  console.log(`Students: ${studentIdMap.size}`);
  console.log(`Behaviors: ${behaviorIdMap.size}`);
  console.log(`Transactions: ${migratedCount}`);
  console.log('\nYou can now refresh the page to see your migrated data!');

  // Optionally backup and clear localStorage
  const clearLS = confirm('Migration complete! Clear localStorage data? (Recommended)');
  if (clearLS) {
    localStorage.setItem(`${STORAGE_KEY}-backup-${Date.now()}`, localData);
    localStorage.removeItem(STORAGE_KEY);
    console.log('localStorage cleared (backup saved)');
  }
})();
