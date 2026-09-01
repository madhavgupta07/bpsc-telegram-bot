import { logger } from '../utils/logger';
import { Topic } from '../models/Topic';

export interface SeedTopic {
  name: string;
  description?: string;
  parentName?: string | null;
}

const SEED_TOPICS: SeedTopic[] = [
  { name: 'Programming & Data Structures', description: 'Core programming concepts and data structure fundamentals' },
  { name: 'Algorithms', description: 'Algorithm analysis, design, and complexity' },
  { name: 'Operating Systems', description: 'OS fundamentals, processes, memory, scheduling and file systems' },
  { name: 'Digital Logic', description: 'Digital circuits, logic gates and boolean algebra' },
  { name: 'DBMS', description: 'Database management systems fundamentals' },
  { name: 'Computer Networks', description: 'Networking fundamentals and protocols' },
  { name: 'COA', description: 'Computer Organization and Architecture' },
  { name: 'Theory of Computation', description: 'Automata, formal languages and computability' },
  { name: 'Compiler Design', description: 'Compiler construction and translation phases' },
  { name: 'Software Engineering', description: 'Software development lifecycle and practices' },

  { name: 'Data and Information', parentName: 'Programming & Data Structures' },
  { name: 'Data Types', parentName: 'Programming & Data Structures' },
  { name: 'Abstract Data Types', parentName: 'Programming & Data Structures' },
  { name: 'Data Structures', parentName: 'Programming & Data Structures' },
  { name: 'Linear Data Structures', parentName: 'Programming & Data Structures' },
  { name: 'Non-Linear Data Structures', parentName: 'Programming & Data Structures' },
  { name: 'Arrays', parentName: 'Programming & Data Structures' },
  { name: 'Sparse Matrices', parentName: 'Programming & Data Structures' },
  { name: 'Recursion', parentName: 'Programming & Data Structures' },
  { name: 'Tower of Hanoi', parentName: 'Programming & Data Structures' },
  { name: 'Backtracking', parentName: 'Programming & Data Structures' },
  { name: 'Linked Lists', parentName: 'Programming & Data Structures' },
  { name: 'Singly Linked List', parentName: 'Programming & Data Structures' },
  { name: 'Doubly Linked List', parentName: 'Programming & Data Structures' },
  { name: 'Circular Linked List', parentName: 'Programming & Data Structures' },
  { name: 'Polynomial Representation', parentName: 'Programming & Data Structures' },

  { name: 'Algorithm Analysis', parentName: 'Algorithms' },
  { name: 'Time-Space Tradeoff', parentName: 'Algorithms' },
  { name: 'Asymptotic Notation', parentName: 'Algorithms' },
  { name: 'Big O', parentName: 'Algorithms' },
  { name: 'Big Omega', parentName: 'Algorithms' },
  { name: 'Big Theta', parentName: 'Algorithms' },
  { name: 'Recurrence Relations', parentName: 'Algorithms' },
  { name: 'Searching', parentName: 'Algorithms' },
  { name: 'Binary Search', parentName: 'Algorithms' },
  { name: 'Divide and Conquer', parentName: 'Algorithms' },
  { name: 'Merge Sort', parentName: 'Algorithms' },
  { name: 'Dynamic Programming', parentName: 'Algorithms' },
  { name: 'Multistage Graph', parentName: 'Algorithms' },
  { name: 'All-Pairs Shortest Path', parentName: 'Algorithms' },
  { name: 'Optimal BST', parentName: 'Algorithms' },
  { name: '8 Queens', parentName: 'Algorithms' },
  { name: 'Hamiltonian Problem', parentName: 'Algorithms' },
  { name: 'Graph Algorithms', parentName: 'Algorithms' },
  { name: 'Connected Components', parentName: 'Algorithms' },
  { name: 'Spanning Trees', parentName: 'Algorithms' },
  { name: 'Biconnected Components', parentName: 'Algorithms' },
  { name: 'NP-Hard', parentName: 'Algorithms' },
  { name: 'NP-Complete', parentName: 'Algorithms' },

  { name: 'OS fundamentals', parentName: 'Operating Systems' },
  { name: 'OS functions', parentName: 'Operating Systems' },
  { name: 'OS structures', parentName: 'Operating Systems' },
  { name: 'System calls', parentName: 'Operating Systems' },
  { name: 'Processes', parentName: 'Operating Systems' },
  { name: 'Process states', parentName: 'Operating Systems' },
  { name: 'PCB', parentName: 'Operating Systems' },
  { name: 'Threads', parentName: 'Operating Systems' },
  { name: 'CPU scheduling', parentName: 'Operating Systems' },
  { name: 'FCFS', parentName: 'Operating Systems' },
  { name: 'SJF', parentName: 'Operating Systems' },
  { name: 'SRTF', parentName: 'Operating Systems' },
  { name: 'Priority Scheduling', parentName: 'Operating Systems' },
  { name: 'Round Robin', parentName: 'Operating Systems' },
  { name: 'Context Switching', parentName: 'Operating Systems' },
  { name: 'IPC', parentName: 'Operating Systems' },
  { name: 'Critical Section', parentName: 'Operating Systems' },
  { name: 'Race Condition', parentName: 'Operating Systems' },
  { name: 'Semaphores', parentName: 'Operating Systems' },
  { name: 'Deadlocks', parentName: 'Operating Systems' },
  { name: "Banker's Algorithm", parentName: 'Operating Systems' },
  { name: 'Memory Management', parentName: 'Operating Systems' },
  { name: 'Paging', parentName: 'Operating Systems' },
  { name: 'Segmentation', parentName: 'Operating Systems' },
  { name: 'Virtual Memory', parentName: 'Operating Systems' },
  { name: 'Page Fault', parentName: 'Operating Systems' },
  { name: 'Page Replacement', parentName: 'Operating Systems' },
  { name: 'FIFO', parentName: 'Operating Systems' },
  { name: 'LRU', parentName: 'Operating Systems' },
  { name: 'Optimal', parentName: 'Operating Systems' },
  { name: "Belady's Anomaly", parentName: 'Operating Systems' },
  { name: 'File Systems', parentName: 'Operating Systems' },
  { name: 'File Allocation', parentName: 'Operating Systems' },
  { name: 'Disk Scheduling', parentName: 'Operating Systems' },
];

export async function seedTopics(): Promise<void> {
  const existingCount = await Topic.countDocuments().lean();
  logger.info(`Topic seed check: ${existingCount} existing topics`);

  const parentCache = new Map<string, string | null>();
  for (const t of SEED_TOPICS) {
    const existing = await Topic.findOne({ name: t.name }).lean();
    if (existing) {
      parentCache.set(t.name, existing.parentTopic ? String(existing.parentTopic) : null);
      continue;
    }

    let parentId: string | null = null;
    if (t.parentName) {
      parentId = parentCache.get(t.parentName) ?? null;
      if (!parentId) {
        const parent = await Topic.findOne({ name: t.parentName }).lean();
        parentId = parent ? String(parent._id) : null;
      }
    }

    const doc = await Topic.create({
      name: t.name,
      description: t.description,
      parentTopic: parentId ?? undefined,
      isActive: true,
    });
    parentCache.set(t.name, String(doc._id));
    logger.debug(`Seed topic created: ${t.name}`);
  }

  logger.info('Topic seeding complete');
}
