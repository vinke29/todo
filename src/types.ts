export interface Subtask {
  id: number;
  text: string;
  completed: boolean;
  dueDate: Date | null;
  completedDate: Date | null;
  hidden?: boolean;
  notes?: string;
}

export interface Todo {
  id: number;
  text: string;
  completed: boolean;
  dueDate: Date | null;
  completedDate: Date | null;
  subtasks: Subtask[];
  isExpanded: boolean;
  notes?: string;
  firestoreId?: string; // ID from Firestore document
  highlight?: boolean; // Whether this task should be highlighted in the UI
} 