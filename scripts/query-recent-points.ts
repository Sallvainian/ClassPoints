// Query recent point transactions for period 7
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://hxclfwawibrtfjvptxno.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseKey) {
  console.error('Missing VITE_SUPABASE_ANON_KEY - please provide the anon key');
  console.error('You can find it in Supabase Dashboard > Project Settings > API');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function queryRecentPoints() {
  // First, find the "period 7" classroom
  console.log('Looking for Period 7 classroom...\n');

  const { data: classrooms, error: classroomError } = await supabase
    .from('classrooms')
    .select('id, name')
    .ilike('name', '%period 7%');

  if (classroomError) {
    console.error('Error fetching classrooms:', classroomError);
    return;
  }

  if (!classrooms || classrooms.length === 0) {
    console.log('No classroom matching "period 7" found.');
    console.log('\nListing all classrooms:');

    const { data: allClassrooms } = await supabase
      .from('classrooms')
      .select('id, name')
      .order('created_at', { ascending: false });

    allClassrooms?.forEach((c) => console.log(`  - ${c.name} (${c.id})`));
    return;
  }

  console.log('Found classrooms:');
  classrooms.forEach((c) => console.log(`  - ${c.name} (${c.id})`));

  // Get recent transactions for this classroom
  for (const classroom of classrooms) {
    console.log(`\n========================================`);
    console.log(`Recent transactions for: ${classroom.name}`);
    console.log(`========================================\n`);

    const { data: transactions, error: txError } = await supabase
      .from('point_transactions')
      .select(
        `
        id,
        points,
        behavior_name,
        behavior_icon,
        created_at,
        batch_id,
        student_id,
        students!inner(name)
      `
      )
      .eq('classroom_id', classroom.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (txError) {
      console.error('Error fetching transactions:', txError);
      continue;
    }

    if (!transactions || transactions.length === 0) {
      console.log('No transactions found.');
      continue;
    }

    // Group by date and batch
    let totalPoints = 0;
    const byBatch = new Map<string, typeof transactions>();

    transactions.forEach((tx) => {
      totalPoints += tx.points;
      const key = tx.batch_id || tx.id;
      if (!byBatch.has(key)) {
        byBatch.set(key, []);
      }
      byBatch.get(key)!.push(tx);
    });

    console.log(`Total points in last ${transactions.length} transactions: ${totalPoints}`);
    console.log(`\nTransactions (most recent first):\n`);

    transactions.forEach((tx) => {
      const student = (tx.students as { name: string })?.name || 'Unknown';
      const date = new Date(tx.created_at).toLocaleString();
      const batchInfo = tx.batch_id ? ` [batch: ${tx.batch_id.slice(0, 8)}...]` : '';
      console.log(
        `${date} | ${tx.behavior_icon} ${tx.behavior_name} (${tx.points > 0 ? '+' : ''}${tx.points}) → ${student}${batchInfo}`
      );
      console.log(`  ID: ${tx.id}`);
    });

    // Summary by batch
    console.log(`\n--- Batch Summary ---`);
    byBatch.forEach((txs, batchId) => {
      if (txs.length > 1) {
        const totalBatchPoints = txs.reduce((sum, t) => sum + t.points, 0);
        console.log(
          `Batch ${batchId.slice(0, 8)}...: ${txs.length} students, ${totalBatchPoints > 0 ? '+' : ''}${totalBatchPoints} total points`
        );
      }
    });
  }
}

queryRecentPoints().catch(console.error);
