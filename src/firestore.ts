import { db, isFirestoreInitialized } from './firebase';
import { collection, addDoc, doc, setDoc, deleteDoc, getDoc, getDocs, query, where, orderBy, Timestamp, DocumentData } from 'firebase/firestore';
import { Todo, Subtask } from './types';

// Collection name constants - IMPORTANT: these should match what's in your Firestore database
const TODOS_COLLECTION = 'todos';
const COMPLETED_TODOS_COLLECTION = 'completedTodos';

// Helper function for console logging in a TypeScript-safe way
const safeLog = (message: string) => {
  if (typeof window !== 'undefined' && window.console && window.console.log) {
    window.console.log(message);
  }
};

const safeError = (message: string, error?: any) => {
  if (typeof window !== 'undefined' && window.console && window.console.error) {
    window.console.error(message, error);
  }
};

// Helper function to ensure user document exists before accessing collections
const ensureUserDoc = async (userId: string): Promise<boolean> => {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      safeLog(`Creating user document for ${userId}`);
      await setDoc(userDocRef, { 
        createdAt: Timestamp.now(),
        lastActive: Timestamp.now() 
      });
    }
    
    return true;
  } catch (error) {
    safeError('Error ensuring user document exists:', error);
    return false;
  }
};

// Convert Firebase timestamp to Date and vice versa
const convertTimestampToDate = (data: DocumentData): any => {
  const result: any = { ...data };
  
  if (result.dueDate instanceof Timestamp) {
    result.dueDate = result.dueDate.toDate();
  }
  
  if (result.completedDate instanceof Timestamp) {
    result.completedDate = result.completedDate.toDate();
  }
  
  if (result.subtasks && Array.isArray(result.subtasks)) {
    result.subtasks = result.subtasks.map((subtask: any) => {
      const convertedSubtask = { ...subtask };
      
      if (convertedSubtask.dueDate instanceof Timestamp) {
        convertedSubtask.dueDate = convertedSubtask.dueDate.toDate();
      }
      
      if (convertedSubtask.completedDate instanceof Timestamp) {
        convertedSubtask.completedDate = convertedSubtask.completedDate.toDate();
      }
      
      return convertedSubtask;
    });
  }
  
  return result;
};

const convertDateToTimestamp = (data: any): any => {
  const result = { ...data };
  
  if (result.dueDate instanceof Date) {
    result.dueDate = Timestamp.fromDate(result.dueDate);
  }
  
  if (result.completedDate instanceof Date) {
    result.completedDate = Timestamp.fromDate(result.completedDate);
  }
  
  if (result.subtasks && Array.isArray(result.subtasks)) {
    result.subtasks = result.subtasks.map((subtask: any) => {
      const convertedSubtask = { ...subtask };
      
      if (convertedSubtask.dueDate instanceof Date) {
        convertedSubtask.dueDate = Timestamp.fromDate(convertedSubtask.dueDate);
      }
      
      if (convertedSubtask.completedDate instanceof Date) {
        convertedSubtask.completedDate = Timestamp.fromDate(convertedSubtask.completedDate);
      }
      
      return convertedSubtask;
    });
  }
  
  return result;
};

// Get active todos for the current user
export const getTodos = async (userId: string): Promise<Todo[]> => {
  if (!isFirestoreInitialized()) {
    safeError('Firestore not initialized, cannot get todos');
    return [];
  }
  
  try {
    // First ensure the user document exists
    await ensureUserDoc(userId);
    
    safeLog(`Getting todos for user ${userId} from collection ${TODOS_COLLECTION}`);
    const userTodosRef = collection(db, 'users', userId, TODOS_COLLECTION);
    const q = query(userTodosRef, orderBy('id', 'asc'));
    const snapshot = await getDocs(q);
    
    safeLog(`Retrieved ${snapshot.size} todos from Firestore`);
    const todos: Todo[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      todos.push({
        ...convertTimestampToDate(data),
        firestoreId: doc.id
      } as Todo);
    });
    
    return todos;
  } catch (error) {
    safeError('Error getting todos:', error);
    return [];
  }
};

// Get completed todos for the current user
export const getCompletedTodos = async (userId: string): Promise<Todo[]> => {
  if (!isFirestoreInitialized()) {
    safeError('Firestore not initialized, cannot get completed todos');
    return [];
  }
  
  try {
    // First ensure the user document exists
    await ensureUserDoc(userId);
    
    safeLog(`Getting completed todos for user ${userId} from collection ${COMPLETED_TODOS_COLLECTION}`);
    const userCompletedTodosRef = collection(db, 'users', userId, COMPLETED_TODOS_COLLECTION);
    const q = query(userCompletedTodosRef, orderBy('completedDate', 'desc'));
    const snapshot = await getDocs(q);
    
    safeLog(`Retrieved ${snapshot.size} completed todos from Firestore`);
    const completedTodos: Todo[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      completedTodos.push({
        ...convertTimestampToDate(data),
        firestoreId: doc.id
      } as Todo);
    });
    
    return completedTodos;
  } catch (error) {
    safeError('Error getting completed todos:', error);
    return [];
  }
};

// Add a new todo
export const addTodo = async (userId: string, todo: Todo): Promise<string> => {
  if (!isFirestoreInitialized()) {
    safeError('Firestore not initialized, cannot add todo');
    return '';
  }
  
  try {
    // First ensure the user document exists
    await ensureUserDoc(userId);
    
    const userTodosRef = collection(db, 'users', userId, TODOS_COLLECTION);
    const todoData = convertDateToTimestamp(todo);
    const docRef = await addDoc(userTodosRef, todoData);
    safeLog(`Added todo with ID: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    safeError('Error adding todo:', error);
    return '';
  }
};

// Update a todo
export const updateTodo = async (userId: string, todo: Todo): Promise<boolean> => {
  if (!todo.firestoreId) return false;
  
  try {
    const todoRef = doc(db, 'users', userId, TODOS_COLLECTION, todo.firestoreId);
    const todoData = convertDateToTimestamp(todo);
    
    // Remove the firestoreId property before saving (it's not part of the todo data model)
    const { firestoreId, ...todoWithoutId } = todoData;
    
    await setDoc(todoRef, todoWithoutId);
    return true;
  } catch (error) {
    safeError('Error updating todo:', error);
    return false;
  }
};

// Delete a todo
export const deleteTodo = async (userId: string, todoId: string): Promise<boolean> => {
  try {
    const todoRef = doc(db, 'users', userId, TODOS_COLLECTION, todoId);
    await deleteDoc(todoRef);
    return true;
  } catch (error) {
    safeError('Error deleting todo:', error);
    return false;
  }
};

// Move a todo to completed todos
export const moveTodoToCompleted = async (userId: string, todo: Todo): Promise<boolean> => {
  if (!todo.firestoreId) return false;
  
  try {
    // First, add to completed todos
    const completedTodosRef = collection(db, 'users', userId, COMPLETED_TODOS_COLLECTION);
    const todoData = convertDateToTimestamp(todo);
    
    // Remove the firestoreId property before saving
    const { firestoreId, ...todoWithoutId } = todoData;
    
    await addDoc(completedTodosRef, todoWithoutId);
    
    // Then delete from active todos
    const todoRef = doc(db, 'users', userId, TODOS_COLLECTION, todo.firestoreId);
    await deleteDoc(todoRef);
    
    return true;
  } catch (error) {
    safeError('Error moving todo to completed:', error);
    return false;
  }
};

// Restore a todo from completed to active
export const restoreTodo = async (userId: string, todo: Todo): Promise<boolean> => {
  if (!todo.firestoreId) return false;
  
  try {
    // First, add to active todos
    const todosRef = collection(db, 'users', userId, TODOS_COLLECTION);
    const todoData = convertDateToTimestamp(todo);
    
    // Remove the firestoreId property before saving
    const { firestoreId, ...todoWithoutId } = todoData;
    
    await addDoc(todosRef, todoWithoutId);
    
    // Then delete from completed todos
    const completedTodoRef = doc(db, 'users', userId, COMPLETED_TODOS_COLLECTION, todo.firestoreId);
    await deleteDoc(completedTodoRef);
    
    return true;
  } catch (error) {
    safeError('Error restoring todo:', error);
    return false;
  }
};

// Expose a function to check collection paths - this can help debug database structure issues
export const checkCollectionPaths = async (userId: string): Promise<boolean> => {
  try {
    safeLog("Checking Firestore collection paths...");
    
    // Check user document
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    safeLog(`User document exists: ${userDoc.exists()}`);
    
    // Check todos collection
    const todosRef = collection(db, 'users', userId, TODOS_COLLECTION);
    const todosSnapshot = await getDocs(todosRef);
    safeLog(`Todos collection accessible, contains ${todosSnapshot.size} documents`);
    
    // Check completed todos collection
    const completedTodosRef = collection(db, 'users', userId, COMPLETED_TODOS_COLLECTION);
    const completedTodosSnapshot = await getDocs(completedTodosRef);
    safeLog(`Completed todos collection accessible, contains ${completedTodosSnapshot.size} documents`);
    
    return true;
  } catch (error) {
    safeError("Error checking collection paths:", error);
    return false;
  }
}; 