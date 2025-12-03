#!/usr/bin/env npx tsx
/**
 * CLI Migration Script - Migrate localStorage data to Supabase
 *
 * Usage:
 *   1. Export localStorage from browser console:
 *      copy(localStorage.getItem('classpoints-state'))
 *   2. Save to a file: data/localStorage-export.json
 *   3. Run: npx tsx scripts/migrate-data.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import type { Database } from '../src/types/database';

// Types from localStorage format
interface LocalBehavior {
  id: string;
  name: string;
  points: number;
  icon: string;
  category: 'positive' | 'negative';
  isCustom: boolean;
  createdAt: number;
}

interface LocalStudent {
  id: string;
  name: string;
  avatarColor?: string;
}

interface LocalClassroom {
  id: string;
  name: string;
  students: LocalStudent[];
  createdAt: number;
  updatedAt: number;
}

interface LocalTransaction {
  id: string;
  studentId: string;
  classroomId: string;
  behaviorId: string;
  behaviorName: string;
  behaviorIcon: string;
  points: number;
  timestamp: number;
  note?: string;
}

interface LocalStorageData {
  version: number;
  classrooms: LocalClassroom[];
  behaviors: LocalBehavior[];
  transactions: LocalTransaction[];
  lastActiveClassroomId: string | null;
}

// Supabase types
type NewClassroom = Database['public']['Tables']['classrooms']['Insert'];
type NewStudent = Database['public']['Tables']['students']['Insert'];
type NewBehavior = Database['public']['Tables']['behaviors']['Insert'];
type NewTransaction = Database['public']['Tables']['point_transactions']['Insert'];

// Environment check
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  // Try to load from .env.local
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').trim();
      if (key === 'VITE_SUPABASE_URL') process.env.VITE_SUPABASE_URL = value;
      if (key === 'VITE_SUPABASE_ANON_KEY') process.env.VITE_SUPABASE_ANON_KEY = value;
    }
  }
}

const supabase = createClient<Database>(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function promptForInput(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function authenticate(): Promise<string | null> {
  console.log('\n=== Supabase Authentication ===\n');

  // Check if already logged in
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    console.log(`Already logged in as: ${user.email}`);
    return user.id;
  }

  const email = await promptForInput('Email: ');
  const password = await promptForInput('Password: ');

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('Authentication failed:', error.message);
    return null;
  }

  console.log(`Logged in as: ${data.user.email}`);
  return data.user.id;
}

async function loadLocalStorageData(): Promise<LocalStorageData | null> {
  const dataDir = path.join(__dirname, '..', 'data');
  const dataFile = path.join(dataDir, 'localStorage-export.json');

  if (!fs.existsSync(dataFile)) {
    console.log('\nNo data file found at: data/localStorage-export.json');
    console.log('\nTo export your localStorage data:');
    console.log('1. Open the app in your browser');
    console.log('2. Open DevTools (F12) -> Console');
    console.log('3. Run: copy(localStorage.getItem("classpoints-state"))');
    console.log('4. Create data/localStorage-export.json and paste the content');

    // Create data directory if needed
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    return null;
  }

  try {
    const content = fs.readFileSync(dataFile, 'utf-8');
    return JSON.parse(content) as LocalStorageData;
  } catch (error) {
    console.error('Failed to parse localStorage data:', error);
    return null;
  }
}

async function migrateData(data: LocalStorageData, userId: string): Promise<void> {
  console.log('\n=== Starting Migration ===\n');
  console.log(`Classrooms: ${data.classrooms.length}`);
  console.log(`Students: ${data.classrooms.reduce((sum, c) => sum + c.students.length, 0)}`);
  console.log(`Custom behaviors: ${data.behaviors.filter(b => b.isCustom).length}`);
  console.log(`Transactions: ${data.transactions.length}`);
  console.log('');

  // ID mappings
  const classroomIdMap = new Map<string, string>();
  const studentIdMap = new Map<string, string>();
  const behaviorIdMap = new Map<string, string>();

  // 1. Migrate classrooms
  console.log('Migrating classrooms...');
  for (const classroom of data.classrooms) {
    const newClassroom: NewClassroom = {
      name: classroom.name,
      user_id: userId,
    };

    const { data: inserted, error } = await supabase
      .from('classrooms')
      .insert(newClassroom)
      .select()
      .single();

    if (error) {
      console.error(`  Failed: ${classroom.name} - ${error.message}`);
      continue;
    }

    classroomIdMap.set(classroom.id, inserted.id);
    console.log(`  Migrated: ${classroom.name}`);
  }

  // 2. Migrate students
  console.log('\nMigrating students...');
  for (const classroom of data.classrooms) {
    const newClassroomId = classroomIdMap.get(classroom.id);
    if (!newClassroomId) continue;

    for (const student of classroom.students) {
      const newStudent: NewStudent = {
        classroom_id: newClassroomId,
        name: student.name,
        avatar_color: student.avatarColor || null,
        user_id: userId,
      };

      const { data: inserted, error } = await supabase
        .from('students')
        .insert(newStudent)
        .select()
        .single();

      if (error) {
        console.error(`  Failed: ${student.name} - ${error.message}`);
        continue;
      }

      studentIdMap.set(student.id, inserted.id);
      console.log(`  Migrated: ${student.name} (${classroom.name})`);
    }
  }

  // 3. Map existing behaviors and migrate custom ones
  console.log('\nMapping behaviors...');
  const { data: existingBehaviors } = await supabase
    .from('behaviors')
    .select('id, name');

  if (existingBehaviors) {
    for (const behavior of data.behaviors) {
      const existing = existingBehaviors.find(
        b => b.name.toLowerCase() === behavior.name.toLowerCase()
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
    if (behaviorIdMap.has(behavior.id)) continue; // Already mapped

    const newBehavior: NewBehavior = {
      name: behavior.name,
      points: behavior.points,
      icon: behavior.icon,
      category: behavior.category,
      is_custom: true,
      user_id: userId,
    };

    const { data: inserted, error } = await supabase
      .from('behaviors')
      .insert(newBehavior)
      .select()
      .single();

    if (error) {
      console.error(`  Failed: ${behavior.name} - ${error.message}`);
      continue;
    }

    behaviorIdMap.set(behavior.id, inserted.id);
    console.log(`  Created custom: ${behavior.name}`);
  }

  // 4. Migrate transactions in batches
  console.log('\nMigrating transactions...');
  const batchSize = 50;
  let migratedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < data.transactions.length; i += batchSize) {
    const batch = data.transactions.slice(i, i + batchSize);
    const transformedBatch: NewTransaction[] = [];

    for (const transaction of batch) {
      const studentId = studentIdMap.get(transaction.studentId);
      const classroomId = classroomIdMap.get(transaction.classroomId);
      const behaviorId = behaviorIdMap.get(transaction.behaviorId);

      if (!studentId || !classroomId) {
        skippedCount++;
        continue;
      }

      transformedBatch.push({
        student_id: studentId,
        classroom_id: classroomId,
        behavior_id: behaviorId || null,
        behavior_name: transaction.behaviorName,
        behavior_icon: transaction.behaviorIcon,
        points: transaction.points,
        note: transaction.note || null,
        user_id: userId,
      });
    }

    if (transformedBatch.length > 0) {
      const { error } = await supabase
        .from('point_transactions')
        .insert(transformedBatch);

      if (error) {
        console.error(`  Batch failed: ${error.message}`);
      } else {
        migratedCount += transformedBatch.length;
        process.stdout.write(`\r  Progress: ${migratedCount}/${data.transactions.length}`);
      }
    }
  }

  console.log(`\n  Migrated: ${migratedCount}, Skipped: ${skippedCount}`);

  // Summary
  console.log('\n=== Migration Complete ===\n');
  console.log(`Classrooms: ${classroomIdMap.size}`);
  console.log(`Students: ${studentIdMap.size}`);
  console.log(`Behaviors mapped/created: ${behaviorIdMap.size}`);
  console.log(`Transactions: ${migratedCount}`);
}

async function main(): Promise<void> {
  console.log('ClassPoints Data Migration Tool');
  console.log('================================\n');

  // Load data
  const data = await loadLocalStorageData();
  if (!data) {
    process.exit(1);
  }

  // Authenticate
  const userId = await authenticate();
  if (!userId) {
    process.exit(1);
  }

  // Confirm
  const confirm = await promptForInput('\nProceed with migration? (yes/no): ');
  if (confirm.toLowerCase() !== 'yes') {
    console.log('Migration cancelled.');
    process.exit(0);
  }

  // Migrate
  await migrateData(data, userId);

  console.log('\nMigration complete! You can now use the app with Supabase.');
}

main().catch(console.error);
