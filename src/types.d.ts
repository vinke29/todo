// Augment the Window interface
interface Window {
  console: {
    log: (message?: any, ...optionalParams: any[]) => void;
    error: (message?: any, ...optionalParams: any[]) => void;
    warn: (message?: any, ...optionalParams: any[]) => void;
    info: (message?: any, ...optionalParams: any[]) => void;
  };
}

// Ensure basic types are available
declare class Date {
  constructor(value?: number | string | Date);
  getTime(): number;
  toISOString(): string;
  toLocaleDateString(locale?: string, options?: Intl.DateTimeFormatOptions): string;
  toLocaleTimeString(locale?: string, options?: Intl.DateTimeFormatOptions): string;
  getDate(): number;
  getMonth(): number;
  getFullYear(): number;
  getHours(): number;
  getMinutes(): number;
  getSeconds(): number;
  static now(): number;
}

// Declare Function type
declare interface Function {
  apply(thisArg: any, argArray?: any): any;
  call(thisArg: any, ...argArray: any[]): any;
  bind(thisArg: any, ...argArray: any[]): any;
}

// Declare HTMLElement
declare interface HTMLElement extends Element {
  // Add properties as needed
}

// Declare Document
declare interface Document extends Node {
  getElementById(elementId: string): HTMLElement | null;
}

declare const document: Document;

// Define interfaces for your custom types
interface Todo {
  id: string;
  text: string;
  completed: boolean;
  dueDate: Date | null;
  completedDate: Date | null;
  subtasks: Subtask[];
  isExpanded: boolean;
  notes?: string;
  firestoreId?: string;
}

interface Subtask {
  id: string;
  text: string;
  completed: boolean;
  dueDate: Date | null;
  completedDate: Date | null;
  hidden?: boolean;
  notes?: string;
}

// Add any other global types your app needs 