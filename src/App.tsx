import React, { useState, useRef, useEffect, createRef, useCallback } from 'react';
import './App.css';
import './Mondrian.css';
import './VanGogh.css';
import './LeCorbusier.css';

interface Subtask {
  id: number;
  text: string;
  completed: boolean;
  dueDate: Date | null;
  completedDate: Date | null; // Adding completed date tracking
  hidden?: boolean; // Add this property to control visibility in the UI
  notes?: string; // Add notes field
}

interface Todo {
  id: number;
  text: string;
  completed: boolean;
  dueDate: Date | null;
  completedDate: Date | null; // Adding completed date tracking
  subtasks: Subtask[];
  isExpanded: boolean; // Track if subtasks are expanded/visible
  notes?: string; // Add notes field
}

// Add new theme types
type ThemeType = 'default' | 'mondrian' | 'vangogh' | 'lecorbusier' | 'surprise';

// Utility function to capitalize the first letter of text
const capitalizeFirstLetter = (text: string): string => {
  if (!text || text.length === 0) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
};

// Update the editingDetails interface to include dueDate
interface EditingDetails {
  type: 'task' | 'subtask';
  id: number;
  parentId?: number;
  title: string;
  notes: string | null;
  dueDate: Date | null;
}

function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverTaskId, setDragOverTaskId] = useState<number | null>(null);
  const [isDropEndZone, setIsDropEndZone] = useState(false);
  // Add state for sorting tasks by due date
  const [sortTasksByDueDate, setSortTasksByDueDate] = useState(false);
  // IMPORTANT: This is the list we'll show during dragging - a visual preview
  const [previewTodos, setPreviewTodos] = useState<Todo[]>([]);
  // Add state for tracking which task is being edited
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const endDropZoneRef = useRef<HTMLDivElement>(null);
  const todoListRef = useRef<HTMLUListElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  
  // Add state for completed tasks history
  const [completedTasks, setCompletedTasks] = useState<Todo[]>([]);
  // Add state for side drawer visibility
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  
  // Add state for details drawer
  const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = useState(false);
  const [editingDetails, setEditingDetails] = useState<EditingDetails | null>(null);
  const [detailsCalendarOpen, setDetailsCalendarOpen] = useState(false);
  
  // For app title editing
  const [appTitle, setAppTitle] = useState('Your to-dos');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isTitleHovered, setIsTitleHovered] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  
  // For history drawer filtering
  const [historyTimeFilter, setHistoryTimeFilter] = useState<'7days' | '30days' | 'custom'>('7days');
  const [customDateRange, setCustomDateRange] = useState<{start: Date | null, end: Date | null}>({
    start: null,
    end: new Date()
  });
  const [isCustomDatePickerOpen, setIsCustomDatePickerOpen] = useState(false);
  
  // For subtasks
  const [editingSubtaskId, setEditingSubtaskId] = useState<{todoId: number, subtaskId: number} | null>(null);
  const [subtaskText, setSubtaskText] = useState('');
  const [addingSubtaskForId, setAddingSubtaskForId] = useState<number | null>(null);
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const newSubtaskInputRef = useRef<HTMLInputElement>(null);
  const editSubtaskInputRef = useRef<HTMLInputElement>(null);

  // Store mouse position data to enhance drop detection
  const mousePositionRef = useRef({ x: 0, y: 0 });
  
  // Track if we're in an active drop operation to reduce flickering
  const isActiveDropTargetRef = useRef(false);
  
  // Debounce clicks on the calendar
  const calendarClickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isCalendarClickPendingRef = useRef(false);
  
  // Replace isMondrianTheme with currentTheme
  const [currentTheme, setCurrentTheme] = useState<ThemeType>('default');
  
  // For surprise theme colors
  const [surpriseColors, setSurpriseColors] = useState({
    primary: '#000000',
    secondary: '#ffffff',
    accent: '#cccccc',
    background: '#f0f0f0',
    text: '#333333'
  });
  
  // For settings menu
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Function to sort tasks by due date
  const sortByDueDate = (tasksToSort: Todo[] | Subtask[]): (Todo[] | Subtask[]) => {
    return [...tasksToSort].sort((a, b) => {
      // Tasks with no due date go to the bottom
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      
      // Sort by due date (earliest dates first)
      return a.dueDate.getTime() - b.dueDate.getTime();
    });
  };
  
  // Filter only active todos
  const activeTodos = (() => {
    // First filter out completed todos
    let filtered = todos.filter(todo => !todo.completed);
    
    // Apply sorting if enabled
    if (sortTasksByDueDate) {
      filtered = sortByDueDate(filtered) as Todo[];
    }
    
    return filtered;
  })();
  
  // Add state for tracking which task has an open calendar
  const [calendarOpenForId, setCalendarOpenForId] = useState<number | null>(null);
  
  // Add state for tracking which subtask has an open calendar
  const [calendarOpenForSubtask, setCalendarOpenForSubtask] = useState<{todoId: number, subtaskId: number} | null>(null);
  
  // Add state for the new task calendar and its selected date
  const [isNewTaskCalendarOpen, setIsNewTaskCalendarOpen] = useState(false);
  const [newTaskDueDate, setNewTaskDueDate] = useState<Date | null>(null);

  // Add state to track current month/year for each calendar
  const [calendarCurrentDate, setCalendarCurrentDate] = useState<Date>(new Date());
  const [newTaskCalendarDate, setNewTaskCalendarDate] = useState<Date>(new Date());
  const [subtaskCalendarDate, setSubtaskCalendarDate] = useState<Date>(new Date());
  
  // Load theme preference from localStorage on initial render
  useEffect(() => {
    const savedTodos = localStorage.getItem('todos');
    const savedTitle = localStorage.getItem('appTitle');
    const savedTheme = localStorage.getItem('theme') as ThemeType;
    const savedCompletedTasks = localStorage.getItem('completedTasks');
    
    if (savedTitle) {
      setAppTitle(savedTitle);
    }
    
    if (savedTheme) {
      setCurrentTheme(savedTheme);
      if (savedTheme === 'surprise') {
        generateSurpriseTheme();
      }
    }
    
    if (savedTodos) {
      try {
        const parsedTodos = JSON.parse(savedTodos, (key, value) => {
          if (key === 'dueDate' && value) {
            return new Date(value);
          }
          return value;
        });
        setTodos(parsedTodos);
        setPreviewTodos(parsedTodos);
      } catch (e) {
        console.error('Error parsing todos from localStorage', e);
      }
    }

    if (savedCompletedTasks) {
      try {
        const parsedCompletedTasks = JSON.parse(savedCompletedTasks, (key, value) => {
          if ((key === 'dueDate' || key === 'completedDate') && value) {
            return new Date(value);
          }
          return value;
        });
        setCompletedTasks(parsedCompletedTasks);
      } catch (e) {
        console.error('Error parsing completedTasks from localStorage', e);
      }
    }
  }, []);

  // Save theme preference to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('theme', currentTheme);
    if (currentTheme === 'surprise') {
      generateSurpriseTheme();
    }
  }, [currentTheme]);

  // Function to generate random colors for surprise theme
  const generateSurpriseTheme = () => {
    const getRandomColor = () => '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
    setSurpriseColors({
      primary: getRandomColor(),
      secondary: getRandomColor(),
      accent: getRandomColor(),
      background: getRandomColor(),
      text: getRandomColor()
    });
  };

  // Apply theme class and surprise theme styles
  useEffect(() => {
    document.documentElement.className = currentTheme === 'surprise' ? '' : `${currentTheme}-theme`;
    if (currentTheme === 'surprise') {
      document.documentElement.style.setProperty('--surprise-primary', surpriseColors.primary);
      document.documentElement.style.setProperty('--surprise-secondary', surpriseColors.secondary);
      document.documentElement.style.setProperty('--surprise-accent', surpriseColors.accent);
      document.documentElement.style.setProperty('--surprise-background', surpriseColors.background);
      document.documentElement.style.setProperty('--surprise-text', surpriseColors.text);
    } else {
      document.documentElement.style.removeProperty('--surprise-primary');
      document.documentElement.style.removeProperty('--surprise-secondary');
      document.documentElement.style.removeProperty('--surprise-accent');
      document.documentElement.style.removeProperty('--surprise-background');
      document.documentElement.style.removeProperty('--surprise-text');
    }
  }, [currentTheme, surpriseColors]);

  // Replace toggleTheme with setTheme
  const setTheme = (theme: ThemeType) => {
    setCurrentTheme(theme);
    setIsSettingsOpen(false);
  };

  // Save todos, title, and theme preference to localStorage when they change
  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos));
  }, [todos]);
  
  useEffect(() => {
    localStorage.setItem('appTitle', appTitle);
  }, [appTitle]);

  // Save completed tasks to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('completedTasks', JSON.stringify(completedTasks));
  }, [completedTasks]);

  // Focus the title input when entering edit mode
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Focus the edit input when entering edit mode
  useEffect(() => {
    if (editingTaskId !== null && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingTaskId]);

  // Focus the new subtask input when adding a subtask
  useEffect(() => {
    if (addingSubtaskForId !== null && newSubtaskInputRef.current) {
      newSubtaskInputRef.current.focus();
    }
  }, [addingSubtaskForId]);

  // Focus the edit subtask input when editing a subtask
  useEffect(() => {
    if (editingSubtaskId !== null && editSubtaskInputRef.current) {
      editSubtaskInputRef.current.focus();
    }
  }, [editingSubtaskId]);

  // Update preview todos whenever drag state changes
  useEffect(() => {
    // If not dragging, preview should match the active todos
    if (!isDragging || draggedTaskId === null) {
      setPreviewTodos(activeTodos);
      return;
    }

    // If dragging, rearrange the preview based on current drag state
    updatePreviewOrder();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging, draggedTaskId, dragOverTaskId, isDropEndZone, todos, sortTasksByDueDate]);

  // Function to update the preview order based on drag states
  const updatePreviewOrder = () => {
    if (draggedTaskId === null) return;
    
    const result = [...activeTodos];
    const draggedTaskIndex = result.findIndex(todo => todo.id === draggedTaskId);
    
    if (draggedTaskIndex === -1) {
      setPreviewTodos(result);
      return;
    }
    
    // Extract the dragged task
    const [draggedItem] = result.splice(draggedTaskIndex, 1);
    
    // Place it according to current drag state
    if (isDropEndZone) {
      // Add to the end
      result.push(draggedItem);
    } else if (dragOverTaskId !== null) {
      // Add at the specific position
      const dropIndex = result.findIndex(todo => todo.id === dragOverTaskId);
      if (dropIndex !== -1) {
        result.splice(dropIndex, 0, draggedItem);
      } else {
        result.push(draggedItem);
      }
    } else {
      // If we don't have a target, put it back
      result.splice(draggedTaskIndex, 0, draggedItem);
    }
    
    setPreviewTodos(result);
  };

  const handleAddTodo = () => {
    if (inputValue.trim() !== '') {
      const newTodo: Todo = {
        id: Date.now(),
        text: capitalizeFirstLetter(inputValue.trim()),
        completed: false,
        dueDate: newTaskDueDate,
        completedDate: null,
        subtasks: [],
        isExpanded: false,
        notes: ''
      };
      setTodos([...todos, newTodo]);
      setInputValue('');
      // Reset the new task due date after adding
      setNewTaskDueDate(null);
    }
  };

  const handleToggleTodo = (id: number) => {
    // Find the task that's being completed
    const taskToComplete = todos.find(todo => todo.id === id);
    
    if (taskToComplete) {
      // Mark task and all its subtasks as completed and set the completedDate
      const now = new Date();
      const completedTask = {
        ...taskToComplete,
        completed: true,
        completedDate: now,
        // Also mark all subtasks as completed
        subtasks: taskToComplete.subtasks.map(subtask => ({
          ...subtask,
          completed: true,
          completedDate: subtask.completedDate || now // Keep original completion date if it exists
        }))
      };
      
      // Add to completed tasks history
      setCompletedTasks(prevCompletedTasks => [completedTask, ...prevCompletedTasks]);
      
      // Update the todos list to mark it as completed (for animation)
      setTodos(
        todos.map(todo => 
          todo.id === id ? completedTask : todo
        )
      );
      
      // Remove the completed task after 800ms (longer for better animation)
      setTimeout(() => {
        setTodos(todos.filter(todo => todo.id !== id));
      }, 800);
    }
  };

  const handleDeleteTodo = (id: number) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };
  
  // New handlers for editing tasks
  const handleEditStart = (id: number, text: string) => {
    setEditingTaskId(id);
    setEditText(text);
  };
  
  const handleEditCancel = () => {
    setEditingTaskId(null);
    setEditText('');
  };
  
  const handleEditSave = () => {
    if (editingTaskId === null) return;
    
    const trimmedText = editText.trim();
    if (trimmedText === '') {
      // If the edited text is empty, just cancel editing
      handleEditCancel();
      return;
    }
    
    // Update the todo with the new text - now with capitalization
    setTodos(
      todos.map(todo => 
        todo.id === editingTaskId ? { ...todo, text: capitalizeFirstLetter(trimmedText) } : todo
      )
    );
    
    // Exit edit mode
    setEditingTaskId(null);
    setEditText('');
  };
  
  // Enhanced findDropTarget - makes DnD more forgiving by using pointer coordinates
  const findDropTarget = (clientX: number, clientY: number) => {
    if (!todoListRef.current) return null;
    
    // Get all todo items
    const todoItems = Array.from(todoListRef.current.querySelectorAll('li')) as HTMLLIElement[];
    
    if (todoItems.length === 0) return null;
    
    // Check if we're in the end drop zone area - with an expanded hit area
    if (endDropZoneRef.current) {
      const endRect = endDropZoneRef.current.getBoundingClientRect();
      // Create a larger virtual hit area (expand upward by 20px)
      const expandedEndRect = {
        top: endRect.top - 20,
        bottom: endRect.bottom + 20,
        left: endRect.left,
        right: endRect.right
      };
      
      // If we're in the expanded end zone area
      if (clientY >= expandedEndRect.top && clientY <= expandedEndRect.bottom &&
          clientX >= expandedEndRect.left && clientX <= expandedEndRect.right) {
        return { id: null, isEndZone: true };
      }
    }
    
    // Find the most appropriate todo item based on Y position 
    for (let i = 0; i < todoItems.length; i++) {
      const item = todoItems[i];
      const itemId = Number(item.getAttribute('data-id'));
      const rect = item.getBoundingClientRect();
      
      // Don't target the item being dragged
      if (itemId === draggedTaskId) {
        continue;
      }
      
      // If cursor is in the upper half of the item, target this item
      if (clientY < rect.top + rect.height / 2 && clientY >= rect.top - 15) {
        return { id: itemId, isEndZone: false, position: 'before' };
      }
      
      // If cursor is in the lower half of the item, target after this item
      if (clientY >= rect.top + rect.height / 2 && clientY <= rect.bottom + 15) {
        // If this is the last item and we're in the lower half, use end zone instead
        if (i === todoItems.length - 1) {
          return { id: null, isEndZone: true };
        }
        
        // Otherwise target the next item
        const nextItem = todoItems[i + 1];
        if (nextItem) {
          const nextItemId = Number(nextItem.getAttribute('data-id'));
          return { id: nextItemId, isEndZone: false, position: 'before' };
        }
      }
    }
    
    // If we're below all items, target the end zone
    const lastItem = todoItems[todoItems.length - 1];
    if (lastItem && clientY > lastItem.getBoundingClientRect().bottom) {
      return { id: null, isEndZone: true };
    }
    
    return null;
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent<HTMLLIElement>, id: number) => {
    // Don't allow dragging if we're in edit mode
    if (editingTaskId !== null) {
      e.preventDefault();
      return;
    }
    
    setDraggedTaskId(id);
    setIsDragging(true);
    
    // Store the initial mouse position
    mousePositionRef.current = { x: e.clientX, y: e.clientY };
    
    // Make the drag image more transparent
    if (e.dataTransfer.setDragImage) {
      const draggedElement = e.currentTarget.cloneNode(true) as HTMLElement;
      draggedElement.style.transform = 'translateY(-1000px)';
      draggedElement.style.opacity = '0.3';
      document.body.appendChild(draggedElement);
      e.dataTransfer.setDragImage(draggedElement, 20, 20);
      
      // Clean up the clone after drag operation
      setTimeout(() => {
        document.body.removeChild(draggedElement);
      }, 0);
    }
    
    // Set effectAllowed to move to show the move cursor
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLLIElement | HTMLDivElement>, id?: number) => {
    e.preventDefault();
    
    // Don't allow drag over if we're in edit mode
    if (editingTaskId !== null) return;
    
    // Update current mouse position
    mousePositionRef.current = { x: e.clientX, y: e.clientY };
    
    // Set dropEffect to move
    e.dataTransfer.dropEffect = 'move';
    
    // Find the most appropriate drop target based on mouse position
    const dropTarget = findDropTarget(e.clientX, e.clientY);
    
    if (!dropTarget) return;
    
    // Update the drag-over state
    if (dropTarget.isEndZone) {
      setIsDropEndZone(true);
      setDragOverTaskId(null);
    } else if (dropTarget.id !== null) {
      setIsDropEndZone(false);
      setDragOverTaskId(dropTarget.id);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLIElement | HTMLDivElement>) => {
    // Only reset if we're actually leaving the drop area completely
    const relatedTarget = e.relatedTarget as HTMLElement;
    
    // Don't reset if still within the element or its children
    if (e.currentTarget.contains(relatedTarget)) {
      return;
    }
    
    // If leaving the list area entirely, reset active drop target flag
    if (!todoListRef.current?.contains(relatedTarget)) {
      isActiveDropTargetRef.current = false;
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLLIElement | HTMLDivElement>, targetId?: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Don't allow drop if we're in edit mode
    if (editingTaskId !== null || draggedTaskId === null) return;
    
    // First, filter out completed todos so we keep them
    const completedTodos = todos.filter(todo => todo.completed);
    
    // Use the preview todos as the new active todos
    // This ensures the drop order matches exactly what the user sees
    const newTodos = [...previewTodos, ...completedTodos];
    
    // Update todos with the new order
    setTodos(newTodos);
    
    // Reset drag states
    resetDragState();
  };

  const handleDragEnd = () => {
    resetDragState();
  };
  
  const resetDragState = () => {
    // Reset all drag states
    setDraggedTaskId(null);
    setDragOverTaskId(null);
    setIsDragging(false);
    setIsDropEndZone(false);
    isActiveDropTargetRef.current = false;
  };

  // Handle keyboard events in edit mode
  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleEditSave();
    } else if (e.key === 'Escape') {
      handleEditCancel();
    }
  };

  // Format date for display
  const formatDate = (date: Date | null): string => {
    if (!date) return '';
    
    // Ensure date is actually a Date object
    let dateObj: Date;
    try {
      dateObj = date instanceof Date ? date : new Date(date);
      
      // Check if date is valid
      if (isNaN(dateObj.getTime())) {
        console.warn('Invalid date value:', date);
        return 'Invalid date';
      }
      
      return dateObj.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: dateObj.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
      });
    } catch (e) {
      console.error('Error formatting date:', date, e);
      return 'Invalid date';
    }
  };
  
  // Determine if a task was completed on time or late
  const getCompletionStatus = (completedDate: Date | null, dueDate: Date | null): { status: 'on-time' | 'late' | null, label: string } => {
    if (!completedDate || !dueDate) {
      return { status: null, label: '' };
    }
    
    try {
      // Ensure dates are actually Date objects
      const completedObj = completedDate instanceof Date ? completedDate : new Date(completedDate);
      const dueObj = dueDate instanceof Date ? dueDate : new Date(dueDate);
      
      // Check if dates are valid
      if (isNaN(completedObj.getTime()) || isNaN(dueObj.getTime())) {
        console.warn('Invalid date in completion status check:', { completedDate, dueDate });
        return { status: null, label: '' };
      }
      
      // Reset hours to compare just the dates
      const completedDay = new Date(completedObj);
      completedDay.setHours(0, 0, 0, 0);
      
      const dueDay = new Date(dueObj);
      dueDay.setHours(0, 0, 0, 0);
      
      if (completedDay <= dueDay) {
        return { status: 'on-time', label: 'On time' };
      } else {
        return { status: 'late', label: 'Late' };
      }
    } catch (e) {
      console.error('Error checking completion status:', { completedDate, dueDate }, e);
      return { status: null, label: '' };
    }
  };
  
  // Handle date selection for a task
  const handleDateSelect = (id: number, date: Date) => {
    setTodos(
      todos.map(todo => {
        if (todo.id === id) {
          // For the updated task, check all subtasks
          const updatedSubtasks = todo.subtasks.map(subtask => {
            // If subtask has a due date that is later than the new task due date,
            // update it to match the task's due date
            if (subtask.dueDate && subtask.dueDate > date) {
              return { ...subtask, dueDate: new Date(date) };
            }
            return subtask;
          });
          
          return { ...todo, dueDate: date, subtasks: updatedSubtasks };
        }
        return todo;
      })
    );
    
    // Close the calendar
    setCalendarOpenForId(null);
  };
  
  // Toggle calendar visibility for a task
  const toggleCalendar = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    // If opening calendar for the first time or a different task, reset to current month
    if (calendarOpenForId !== id) {
      setCalendarCurrentDate(new Date());
    }
    setCalendarOpenForId(calendarOpenForId === id ? null : id);
  };

  // Toggle calendar visibility for new task with debouncing
  const toggleNewTaskCalendar = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Prevent double-clicks
    if (isCalendarClickPendingRef.current) return;
    
    isCalendarClickPendingRef.current = true;
    console.log('Calendar icon clicked'); // Debug log
    
    // Toggle the calendar visibility
    if (!isNewTaskCalendarOpen) {
      setNewTaskCalendarDate(new Date()); // Reset to current month when opening
    }
    setIsNewTaskCalendarOpen(!isNewTaskCalendarOpen);
    
    // Close any task calendars if open
    if (calendarOpenForId !== null) {
      setCalendarOpenForId(null);
    }
    
    if (calendarClickTimeoutRef.current) {
      clearTimeout(calendarClickTimeoutRef.current);
    }
    
    calendarClickTimeoutRef.current = setTimeout(() => {
      isCalendarClickPendingRef.current = false;
    }, 300);
  };
  
  // Handle date selection for new task
  const handleNewTaskDateSelect = (date: Date) => {
    setNewTaskDueDate(date);
    setIsNewTaskCalendarOpen(false);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (calendarClickTimeoutRef.current) {
        clearTimeout(calendarClickTimeoutRef.current);
      }
    };
  }, []);

  // Toggle task expansion (show/hide subtasks)
  const toggleTaskExpansion = (id: number) => {
    setTodos(
      todos.map(todo => 
        todo.id === id ? { ...todo, isExpanded: !todo.isExpanded } : todo
      )
    );
  };

  // Add subtask to a todo
  const handleAddSubtask = (todoId: number) => {
    setAddingSubtaskForId(todoId);
    setNewSubtaskText('');
  };

  // Add a new helper function to find the latest date in subtasks
  const getLatestSubtaskDate = (subtasks: Subtask[]): Date | null => {
    if (subtasks.length === 0) return null;
    
    let latestDate: Date | null = null;
    
    subtasks.forEach(subtask => {
      if (subtask.dueDate) {
        if (!latestDate || subtask.dueDate > latestDate) {
          latestDate = subtask.dueDate;
        }
      }
    });
    
    return latestDate;
  };

  // Add a function to update the parent task date if needed
  const updateParentTaskDate = (todoId: number, subtasks: Subtask[]): void => {
    setTodos(prevTodos => {
      const todo = prevTodos.find(t => t.id === todoId);
      if (!todo) return prevTodos;
      
      // If parent task has no due date, set it to the latest subtask date
      if (!todo.dueDate) {
        const latestSubtaskDate = getLatestSubtaskDate(subtasks);
        if (!latestSubtaskDate) return prevTodos;
        
        return prevTodos.map(t => 
          t.id === todoId ? { ...t, dueDate: latestSubtaskDate } : t
        );
      } 
      // If parent task has a due date, update subtasks with later dates to match parent
      else {
        const parentDueDate = todo.dueDate; // Store in variable to avoid null error
        const updatedSubtasks = subtasks.map(subtask => {
          if (subtask.dueDate && parentDueDate && subtask.dueDate > parentDueDate) {
            return { ...subtask, dueDate: new Date(parentDueDate) };
          }
          return subtask;
        });
        
        // Check if any subtasks were updated
        const someSubtasksUpdated = updatedSubtasks.some((subtask, index) => 
          subtask.dueDate !== subtasks[index].dueDate
        );
        
        if (someSubtasksUpdated) {
          return prevTodos.map(t => 
            t.id === todoId ? { ...t, subtasks: updatedSubtasks } : t
          );
        }
      }
      
      return prevTodos;
    });
  };

  // Update handleSaveNewSubtask to check dates
  const handleSaveNewSubtask = (todoId: number) => {
    if (newSubtaskText.trim() === '') {
      setAddingSubtaskForId(null);
      return;
    }

    const newSubtask: Subtask = {
      id: Date.now(),
      text: capitalizeFirstLetter(newSubtaskText.trim()),
      completed: false,
      dueDate: null,
      completedDate: null,
      notes: ''
    };

    // First update the todos state with the new subtask
    setTodos(prevTodos => {
      const updatedTodos = prevTodos.map(todo => 
        todo.id === todoId 
          ? { ...todo, subtasks: [...todo.subtasks, newSubtask], isExpanded: true } 
          : todo
      );
      
      // Find the updated todo to check dates
      const updatedTodo = updatedTodos.find(todo => todo.id === todoId);
      if (updatedTodo) {
        // This will be called after the state update
        setTimeout(() => updateParentTaskDate(todoId, updatedTodo.subtasks), 0);
      }
      
      return updatedTodos;
    });

    setAddingSubtaskForId(null);
    setNewSubtaskText('');
  };

  // Cancel adding subtask
  const handleCancelAddSubtask = () => {
    setAddingSubtaskForId(null);
    setNewSubtaskText('');
  };

  // Edit a subtask
  const handleEditSubtaskStart = (todoId: number, subtaskId: number, text: string) => {
    setEditingSubtaskId({ todoId, subtaskId });
    setSubtaskText(text);
  };

  // Cancel subtask editing
  const handleEditSubtaskCancel = () => {
    setEditingSubtaskId(null);
    setSubtaskText('');
  };

  // Save subtask edit
  const handleEditSubtaskSave = () => {
    if (!editingSubtaskId) return;
    
    const { todoId, subtaskId } = editingSubtaskId;
    const trimmedText = subtaskText.trim();
    
    if (trimmedText === '') {
      handleEditSubtaskCancel();
      return;
    }

    setTodos(
      todos.map(todo => 
        todo.id === todoId 
          ? {
              ...todo,
              subtasks: todo.subtasks.map(subtask => 
                subtask.id === subtaskId 
                  ? { ...subtask, text: capitalizeFirstLetter(trimmedText) } 
                  : subtask
              )
            } 
          : todo
      )
    );

    setEditingSubtaskId(null);
    setSubtaskText('');
  };

  // Toggle subtask completion
  const handleToggleSubtask = (todoId: number, subtaskId: number) => {
    const todoToUpdate = todos.find(todo => todo.id === todoId);
    if (!todoToUpdate) return;
    
    // Get the subtask being toggled
    const subtaskToToggle = todoToUpdate.subtasks.find(subtask => subtask.id === subtaskId);
    if (!subtaskToToggle) return;
    
    // Check if this is completing or uncompleting the subtask
    const isCompleting = !subtaskToToggle.completed;
    const now = new Date();
    
    // Create the updated subtask with new completion status
    const updatedSubtask = {
      ...subtaskToToggle,
      completed: isCompleting,
      completedDate: isCompleting ? now : null,
      // Add a hidden property to control visibility in the main UI
      hidden: false
    };
    
    // Update the todo with the modified subtask
    const updatedTodo = {
      ...todoToUpdate,
      subtasks: todoToUpdate.subtasks.map(subtask => 
        subtask.id === subtaskId ? updatedSubtask : subtask
      )
    };
    
    // Check if all subtasks will be completed after this change
    const willAllSubtasksBeCompleted = updatedTodo.subtasks.length > 0 && 
      updatedTodo.subtasks.every(subtask => subtask.id === subtaskId ? isCompleting : subtask.completed);
    
    // If completing the subtask and all other subtasks are already complete, mark the parent task as complete
    if (isCompleting && willAllSubtasksBeCompleted) {
      // Mark the parent task as complete
      const completedParentTask = {
        ...updatedTodo,
        completed: true,
        completedDate: now
      };
      
      // Add to completed tasks history
      setCompletedTasks(prevCompletedTasks => [completedParentTask, ...prevCompletedTasks]);
      
      // Update the todos list to mark it as completed (for animation)
      setTodos(
        todos.map(todo => 
          todo.id === todoId ? completedParentTask : todo
        )
      );
      
      // Remove the completed task after animation
      setTimeout(() => {
        setTodos(todos.filter(todo => todo.id !== todoId));
      }, 800);
    } else if (isCompleting) {
      // Just completing a subtask, not the whole task
      
      // First update todos to reflect the completed subtask
      setTodos(
        todos.map(todo => 
          todo.id === todoId 
            ? updatedTodo
            : todo
        )
      );
      
      // Instead of removing the subtask, mark it as hidden after animation
      setTimeout(() => {
        setTodos(prevTodos => 
          prevTodos.map(todo => 
            todo.id === todoId 
              ? {
                  ...todo,
                  subtasks: todo.subtasks.map(subtask => 
                    subtask.id === subtaskId
                      ? { ...subtask, hidden: true }
                      : subtask
                  )
                }
              : todo
          )
        );
      }, 800);
    } else {
      // Just uncompleting a subtask - also make it visible again if it was hidden
      setTodos(
        todos.map(todo => 
          todo.id === todoId 
            ? {
                ...todo,
                subtasks: todo.subtasks.map(subtask => 
                  subtask.id === subtaskId
                    ? { ...updatedSubtask, hidden: false }
                    : subtask
                )
              }
            : todo
        )
      );
    }
  };

  // Delete a subtask
  const handleDeleteSubtask = (todoId: number, subtaskId: number) => {
    setTodos(prevTodos => {
      const updatedTodos = prevTodos.map(todo => 
        todo.id === todoId 
          ? {
              ...todo,
              subtasks: todo.subtasks.filter(subtask => subtask.id !== subtaskId)
            } 
          : todo
      );
      
      // Find the updated todo
      const updatedTodo = updatedTodos.find(todo => todo.id === todoId);
      if (updatedTodo) {
        // Recalculate the latest due date from remaining subtasks
        const latestDate = getLatestSubtaskDate(updatedTodo.subtasks);
        
        // Update the parent task's due date
        return updatedTodos.map(todo => 
          todo.id === todoId ? { ...todo, dueDate: latestDate } : todo
        );
      }
      
      return updatedTodos;
    });
  };

  // Toggle subtask calendar
  const toggleSubtaskCalendar = (e: React.MouseEvent, todoId: number, subtaskId: number) => {
    e.stopPropagation();
    
    // Close if the same subtask calendar is already open
    if (calendarOpenForSubtask &&
       calendarOpenForSubtask.todoId === todoId &&
       calendarOpenForSubtask.subtaskId === subtaskId) {
      setCalendarOpenForSubtask(null);
    } else {
      setSubtaskCalendarDate(new Date()); // Reset to current month when opening a different subtask calendar
      setCalendarOpenForSubtask({ todoId, subtaskId });
    }
    
    // Close any other calendars
    if (calendarOpenForId !== null) {
      setCalendarOpenForId(null);
    }
    
    if (isNewTaskCalendarOpen) {
      setIsNewTaskCalendarOpen(false);
    }
  };

  // Add functions to navigate between months
  const navigateMonth = (date: Date, direction: 'prev' | 'next'): Date => {
    const newDate = new Date(date);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    return newDate;
  };

  const handleCalendarNavigation = (direction: 'prev' | 'next', type: 'task' | 'newTask' | 'subtask') => {
    if (type === 'task') {
      setCalendarCurrentDate(navigateMonth(calendarCurrentDate, direction));
    } else if (type === 'newTask') {
      setNewTaskCalendarDate(navigateMonth(newTaskCalendarDate, direction));
    } else {
      setSubtaskCalendarDate(navigateMonth(subtaskCalendarDate, direction));
    }
  };

  // Update handleSubtaskDateSelect to check and update parent task date
  const handleSubtaskDateSelect = (todoId: number, subtaskId: number, date: Date) => {
    setTodos(prevTodos => {
      // Find the parent task
      const parentTask = prevTodos.find(todo => todo.id === todoId);
      
      // Update the subtask with the new date
      const updatedTodos = prevTodos.map(todo => 
        todo.id === todoId 
          ? {
              ...todo,
              subtasks: todo.subtasks.map(subtask => 
                subtask.id === subtaskId 
                  ? { ...subtask, dueDate: date } 
                  : subtask
              )
            } 
          : todo
      );
      
      // Find the updated todo
      const updatedTodo = updatedTodos.find(todo => todo.id === todoId);
      if (updatedTodo) {
        // If parent has a due date and the new subtask date is later,
        // update the parent task's due date to match the subtask
        if (parentTask && parentTask.dueDate && date > parentTask.dueDate) {
          return updatedTodos.map(todo => 
            todo.id === todoId ? { ...todo, dueDate: new Date(date) } : todo
          );
        }
        
        // If parent has no due date, update it to the latest subtask date
        if (!parentTask?.dueDate) {
          const latestDate = getLatestSubtaskDate(updatedTodo.subtasks);
          if (latestDate) {
            return updatedTodos.map(todo => 
              todo.id === todoId ? { ...todo, dueDate: latestDate } : todo
            );
          }
        }
      }
      
      return updatedTodos;
    });
    
    // Close the calendar
    setCalendarOpenForSubtask(null);
  };

  // Handle keyboard events for subtask editing
  const handleSubtaskKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (editingSubtaskId) {
        handleEditSubtaskSave();
      } else if (addingSubtaskForId !== null) {
        handleSaveNewSubtask(addingSubtaskForId);
      }
    } else if (e.key === 'Escape') {
      if (editingSubtaskId) {
        handleEditSubtaskCancel();
      } else if (addingSubtaskForId !== null) {
        handleCancelAddSubtask();
      }
    }
  };

  // Handle app title editing
  const handleTitleEditStart = () => {
    setIsEditingTitle(true);
  };
  
  const handleTitleEditSave = () => {
    // Trim the title but keep it even if empty (can use a default in the JSX)
    setAppTitle(appTitle.trim());
    setIsEditingTitle(false);
  };
  
  const handleTitleEditCancel = () => {
    // If user cancels, revert to the saved title
    const savedTitle = localStorage.getItem('appTitle');
    if (savedTitle) {
      setAppTitle(savedTitle);
    } else {
      setAppTitle('Your to-dos');
    }
    setIsEditingTitle(false);
  };
  
  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleEditSave();
    } else if (e.key === 'Escape') {
      handleTitleEditCancel();
    }
  };

  // Toggle settings menu
  const toggleSettings = () => {
    setIsSettingsOpen(!isSettingsOpen);
  };

  // Toggle history drawer
  const toggleHistoryDrawer = useCallback(() => {
    setIsHistoryDrawerOpen(!isHistoryDrawerOpen);
  }, [isHistoryDrawerOpen]);
  
  // Add a new function to restore a completed task back to active tasks
  const handleRestoreTask = (taskId: number) => {
    // Find the task in completed tasks
    const taskToRestore = completedTasks.find(task => task.id === taskId);
    
    if (!taskToRestore) return;
    
    // Create a restored version of the task
    const restoredTask = {
      ...taskToRestore,
      completed: false,
      completedDate: null,
      // Also restore all subtasks
      subtasks: taskToRestore.subtasks.map(subtask => ({
        ...subtask,
        completed: false,
        completedDate: null,
        hidden: false
      }))
    };
    
    // Add to active todos
    setTodos(prevTodos => [...prevTodos, restoredTask]);
    
    // Remove from completed tasks
    setCompletedTasks(prevCompleted => 
      prevCompleted.filter(task => task.id !== taskId)
    );
  };
  
  // Add a new function to restore an individual subtask from a completed task
  const handleRestoreSubtaskFromCompletedTask = (taskId: number, subtaskId: number) => {
    // Find the completed task containing this subtask
    const completedTask = completedTasks.find(task => task.id === taskId);
    if (!completedTask) return;
    
    // Find the subtask to restore
    const subtaskToRestore = completedTask.subtasks.find(subtask => subtask.id === subtaskId);
    if (!subtaskToRestore) return;
    
    // Create a restored version of the task with the specific subtask marked as not completed
    const restoredTask: Todo = {
      ...completedTask,
      completed: false, // The main task is no longer complete
      completedDate: null,
      // Mark only the specific subtask as not completed, keep the others as they were
      subtasks: completedTask.subtasks.map(subtask => 
        subtask.id === subtaskId 
          ? { ...subtask, completed: false, completedDate: null, hidden: false } 
          : subtask
      )
    };
    
    // Add the restored task to active todos
    setTodos(prevTodos => [...prevTodos, restoredTask]);
    
    // Remove the task from completed tasks
    setCompletedTasks(prevCompleted => 
      prevCompleted.filter(task => task.id !== taskId)
    );
  };
  
  // Add a new function to restore a completed subtask within an active task
  const handleRestoreSubtask = (taskId: number, subtaskId: number) => {
    // Find the task that contains this subtask
    const task = todos.find(todo => todo.id === taskId);
    
    if (!task) return;
    
    // Update the subtask to be not completed
    setTodos(prevTodos => 
      prevTodos.map(todo => 
        todo.id === taskId 
          ? {
              ...todo,
              subtasks: todo.subtasks.map(subtask => 
                subtask.id === subtaskId
                  ? { ...subtask, completed: false, completedDate: null, hidden: false }
                  : subtask
              )
            }
          : todo
      )
    );
  };
  
  // Close settings when clicking outside
  const handleClickOutside = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // Check if click is outside settings menu
    if (isSettingsOpen && !target.closest('.settings-menu')) {
      setIsSettingsOpen(false);
    }
    
    // Check if click is outside history drawer
    if (isHistoryDrawerOpen && !target.closest('.history-drawer') && !target.closest('.history-icon')) {
      setIsHistoryDrawerOpen(false);
    }
    
    // Check if click is outside details drawer
    if (isDetailsDrawerOpen && !target.closest('.details-drawer')) {
      setIsDetailsDrawerOpen(false); // Just close it directly
      setEditingDetails(null);
    }
  }, [isSettingsOpen, isHistoryDrawerOpen, isDetailsDrawerOpen]);

  useEffect(() => {
    // Add event listener if either drawer is open
    if (isSettingsOpen || isHistoryDrawerOpen || isDetailsDrawerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    
    // Clean up
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSettingsOpen, isHistoryDrawerOpen, isDetailsDrawerOpen, handleClickOutside]);

  // Get filter date based on selected time filter
  const getFilterDate = (): Date => {
    const today = new Date();
    
    switch(historyTimeFilter) {
      case '7days':
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(today.getDate() - 7);
        return sevenDaysAgo;
      case '30days':
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        return thirtyDaysAgo;
      case 'custom':
        return customDateRange.start || new Date(0); // Use earliest possible date if not set
      default:
        return new Date(0); // Fallback
    }
  };

  // Function to handle custom date range selection
  const handleCustomDateSelect = (date: Date) => {
    // If we don't have a start date yet or we already have both, set as start date
    if (!customDateRange.start || (customDateRange.start && customDateRange.end)) {
      setCustomDateRange({
        start: date,
        end: null
      });
    } else {
      // We have a start date but no end date
      // Ensure end date is not before start date
      if (date >= customDateRange.start) {
        setCustomDateRange({
          ...customDateRange,
          end: date
        });
        setIsCustomDatePickerOpen(false); // Close the date picker when range is complete
      } else {
        // If selected date is before start date, swap them
        setCustomDateRange({
          start: date,
          end: customDateRange.start
        });
        setIsCustomDatePickerOpen(false);
      }
    }
  };

  // Update the openDetailsDrawer function to include dueDate and check completedTasks
  const openDetailsDrawer = (type: 'task' | 'subtask', id: number, parentId?: number) => {
    if (type === 'task') {
      // First check active todos
      const task = todos.find(todo => todo.id === id);
      if (task) {
        setEditingDetails({
          type,
          id,
          title: task.text,
          notes: task.notes || null,
          dueDate: task.dueDate
        });
        setIsDetailsDrawerOpen(true);
        return;
      }
      
      // Then check completed tasks if not found in active todos
      const completedTask = completedTasks.find(todo => todo.id === id);
      if (completedTask) {
        setEditingDetails({
          type,
          id,
          title: completedTask.text,
          notes: completedTask.notes || null,
          dueDate: completedTask.dueDate
        });
        setIsDetailsDrawerOpen(true);
        return;
      }
    } else if (type === 'subtask') {
      if (!parentId) return;
      
      // Check active todos first
      const task = todos.find(todo => todo.id === parentId);
      if (task) {
        const subtask = task.subtasks.find(sub => sub.id === id);
        if (subtask) {
          setEditingDetails({
            type,
            id,
            parentId,
            title: subtask.text,
            notes: subtask.notes || null,
            dueDate: subtask.dueDate
          });
          setIsDetailsDrawerOpen(true);
          return;
        }
      }
      
      // Then check completed tasks
      const completedTask = completedTasks.find(todo => todo.id === parentId);
      if (completedTask) {
        const subtask = completedTask.subtasks.find(sub => sub.id === id);
        if (subtask) {
          setEditingDetails({
            type,
            id,
            parentId,
            title: subtask.text,
            notes: subtask.notes || null,
            dueDate: subtask.dueDate
          });
          setIsDetailsDrawerOpen(true);
          return;
        }
      }
    }
  };

  // Update the saveDetailsDrawer function to handle dueDate and completedTasks
  const saveDetailsDrawer = () => {
    if (!editingDetails) return;

    if (editingDetails.type === 'task') {
      // First, try to update task in the active todos
      let foundInActiveTodos = false;
      setTodos(prevTodos => {
        const taskToUpdate = prevTodos.find(todo => todo.id === editingDetails.id);
        if (!taskToUpdate) return prevTodos; // Not found in active todos
        
        foundInActiveTodos = true;
        // Apply the same logic as in handleDateSelect
        return prevTodos.map(todo => {
          if (todo.id === editingDetails.id) {
            // Create new subtasks with adjusted dates if needed
            const updatedSubtasks = todo.subtasks.map(subtask => {
              if (editingDetails.dueDate && subtask.dueDate && subtask.dueDate > editingDetails.dueDate) {
                // Clone the date to avoid reference issues
                return { ...subtask, dueDate: new Date(editingDetails.dueDate.getTime()) };
              }
              return subtask;
            });
            
            return { 
              ...todo, 
              text: editingDetails.title,
              notes: editingDetails.notes || undefined,
              dueDate: editingDetails.dueDate,
              subtasks: updatedSubtasks
            };
          }
          return todo;
        });
      });

      // If not found in active todos, check completed tasks
      if (!foundInActiveTodos) {
        setCompletedTasks(prevCompletedTasks => {
          const taskToUpdate = prevCompletedTasks.find(todo => todo.id === editingDetails.id);
          if (!taskToUpdate) return prevCompletedTasks;

          return prevCompletedTasks.map(todo => {
            if (todo.id === editingDetails.id) {
              // Create new subtasks with adjusted dates if needed
              const updatedSubtasks = todo.subtasks.map(subtask => {
                if (editingDetails.dueDate && subtask.dueDate && subtask.dueDate > editingDetails.dueDate) {
                  // Clone the date to avoid reference issues
                  return { ...subtask, dueDate: new Date(editingDetails.dueDate.getTime()) };
                }
                return subtask;
              });
              
              return { 
                ...todo, 
                text: editingDetails.title,
                notes: editingDetails.notes || undefined,
                dueDate: editingDetails.dueDate,
                subtasks: updatedSubtasks
              };
            }
            return todo;
          });
        });
      }
    } else if (editingDetails.type === 'subtask' && editingDetails.parentId) {
      // First try to update subtask in active todos
      let foundInActiveTodos = false;
      setTodos(prevTodos => {
        // Find the parent task
        const parentTask = prevTodos.find(todo => todo.id === editingDetails.parentId);
        if (!parentTask) return prevTodos;
        
        foundInActiveTodos = true;
        // First update the subtask with the new details
        let updatedTodos = prevTodos.map(todo => {
          if (todo.id === editingDetails.parentId) {
            const updatedSubtasks = todo.subtasks.map(subtask => {
              if (subtask.id === editingDetails.id) {
                return { 
                  ...subtask, 
                  text: editingDetails.title,
                  notes: editingDetails.notes || undefined,
                  dueDate: editingDetails.dueDate
                };
              }
              return subtask;
            });
            
            return {
              ...todo,
              subtasks: updatedSubtasks
            };
          }
          return todo;
        });
        
        // Find the updated todo to work with
        const updatedTodo = updatedTodos.find(todo => todo.id === editingDetails.parentId);
        if (!updatedTodo) return updatedTodos;
        
        // Apply the same date logic as in handleSubtaskDateSelect
        
        // If parent has a due date and the new subtask date is later,
        // update the parent task's due date to match the subtask
        if (parentTask.dueDate && editingDetails.dueDate && editingDetails.dueDate > parentTask.dueDate) {
          updatedTodos = updatedTodos.map(todo => {
            if (todo.id === editingDetails.parentId) {
              return { 
                ...todo, 
                dueDate: new Date(editingDetails.dueDate!.getTime()) 
              };
            }
            return todo;
          });
        }
        
        // If parent has no due date, update it to the latest subtask date
        if (!parentTask.dueDate) {
          const latestDate = getLatestSubtaskDate(updatedTodo.subtasks);
          if (latestDate) {
            updatedTodos = updatedTodos.map(todo => {
              if (todo.id === editingDetails.parentId) {
                return { ...todo, dueDate: latestDate };
              }
              return todo;
            });
          }
        }
        
        return updatedTodos;
      });

      // If not found in active todos, check completed tasks
      if (!foundInActiveTodos) {
        setCompletedTasks(prevCompletedTasks => {
          // Find the parent task
          const parentTask = prevCompletedTasks.find(todo => todo.id === editingDetails.parentId);
          if (!parentTask) return prevCompletedTasks;
  
          // Update the subtask with the new details
          return prevCompletedTasks.map(todo => {
            if (todo.id === editingDetails.parentId) {
              const updatedSubtasks = todo.subtasks.map(subtask => {
                if (subtask.id === editingDetails.id) {
                  return { 
                    ...subtask, 
                    text: editingDetails.title,
                    notes: editingDetails.notes || undefined,
                    dueDate: editingDetails.dueDate
                  };
                }
                return subtask;
              });
              
              // No need to update parent task due date for completed tasks
              return {
                ...todo,
                subtasks: updatedSubtasks
              };
            }
            return todo;
          });
        });
      }
    }

    // Close the drawer
    closeDetailsDrawer();
  };

  // Close details drawer
  const closeDetailsDrawer = useCallback(() => {
    setIsDetailsDrawerOpen(false);
    setEditingDetails(null);
  }, []);

  return (
    <div className={`App ${currentTheme === 'surprise' ? 'surprise-theme' : ''}`}>
      <header className="App-header">
        <div 
          className={`app-title-container ${isTitleHovered ? 'hovered' : ''}`}
          onMouseEnter={() => setIsTitleHovered(true)}
          onMouseLeave={() => setIsTitleHovered(false)}
          onClick={!isEditingTitle ? handleTitleEditStart : undefined}
        >
          {isEditingTitle ? (
            <div className="title-edit-container">
              <input
                type="text"
                className="title-edit-input"
                value={appTitle}
                onChange={(e) => setAppTitle(e.target.value)}
                onBlur={handleTitleEditSave}
                onKeyDown={handleTitleKeyDown}
                ref={titleInputRef}
                autoFocus
              />
              <div className="title-edit-actions">
                <button
                  type="button"
                  className="title-save-btn"
                  onClick={handleTitleEditSave}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="title-cancel-btn"
                  onClick={handleTitleEditCancel}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <h1 title="Click to edit">
              {appTitle || 'Your to-dos'}
            </h1>
          )}
        </div>
        
        <div className="todo-input-container">
          <div className="todo-input">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Add a new task"
              onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
              id="new-task-input"
              name="new-task"
            />
            <div className="calendar-icon-wrapper">
              <button 
                className="calendar-icon new-task-calendar-icon" 
                onClick={toggleNewTaskCalendar}
                aria-label="Select due date for new task"
                type="button"
              >
                📅
              </button>
            </div>
            <button onClick={handleAddTodo} className="add-btn" type="button">Add</button>
          </div>
          
          {newTaskDueDate && (
            <div className="new-task-due-date">
              Due: {formatDate(newTaskDueDate)}
              <button 
                className="clear-date-btn" 
                onClick={(e) => {
                  e.stopPropagation();
                  setNewTaskDueDate(null);
                }}
                type="button"
              >
                ×
              </button>
            </div>
          )}
        </div>
        
        {/* Add sort toggle - only show when there are active tasks */}
        {todos.filter(todo => !todo.completed).length > 0 && (
          <div className="sort-options">
            <button 
              className={`sort-toggle ${sortTasksByDueDate ? 'active' : ''}`}
              onClick={() => setSortTasksByDueDate(!sortTasksByDueDate)}
              title={sortTasksByDueDate ? "Disable due date sorting" : "Sort tasks by due date"}
            >
              {sortTasksByDueDate ? "✓ " : ""}Sort by due date
            </button>
          </div>
        )}
        
        <div className="todo-container">
          {todos.length === 0 && completedTasks.length > 0 && (
            <div className="completion-message">
              <span>🎉 Congrats! You've completed all tasks! 🎉</span>
            </div>
          )}
          <ul ref={todoListRef} className="todo-list">
            {/* Use the preview todos for rendering during drag operations */}
            {previewTodos.map((todo) => (
              <li
                key={todo.id}
                data-id={todo.id}
                className={`${todo.completed ? 'completed' : ''} ${draggedTaskId === todo.id ? 'dragging' : ''} ${dragOverTaskId === todo.id ? 'drag-over' : ''}`}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, todo.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, todo.id)}
                onDragEnter={(e) => handleDragOver(e, todo.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, todo.id)}
              >
                <div className="todo-main-row">
                  <div className="todo-item">
                    <button 
                      type="button"
                      className={`checkbox ${todo.completed ? 'checked' : ''}`} 
                      onClick={() => handleToggleTodo(todo.id)}
                      aria-label={todo.completed ? "Mark as incomplete" : "Mark as complete"}
                    >
                      {todo.completed && "✓"}
                    </button>
                    <div className="todo-text-container">
                      {editingTaskId === todo.id ? (
                        <input
                          type="text"
                          className="edit-input"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onBlur={handleEditSave}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleEditSave();
                            if (e.key === 'Escape') handleEditCancel();
                          }}
                          ref={editInputRef}
                          autoFocus
                        />
                      ) : (
                        <>
                          <span 
                            className="todo-text"
                            onClick={() => openDetailsDrawer('task', todo.id)}
                            title="Click to edit task"
                          >{todo.text}</span>
                          {todo.dueDate && (
                            <span className="todo-due-date">Due: {formatDate(todo.dueDate)}</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="todo-controls">
                    {editingTaskId !== todo.id && (
                      <>
                        <button
                          type="button"
                          className="calendar-icon"
                          onClick={(e) => toggleCalendar(e, todo.id)}
                          aria-label="Set due date"
                        >
                          📅
                        </button>
                        {todo.subtasks.length > 0 && (
                          <button
                            type="button"
                            className={`subtask-toggle has-subtasks`}
                            onClick={() => toggleTaskExpansion(todo.id)}
                            aria-label={todo.isExpanded ? "Hide subtasks" : "Show subtasks"}
                          >
                            {todo.isExpanded ? "▼" : "▶"}
                          </button>
                        )}
                        <button
                          type="button"
                          className="add-subtask-btn"
                          onClick={() => handleAddSubtask(todo.id)}
                          disabled={editingTaskId === todo.id || addingSubtaskForId !== null || editingSubtaskId !== null}
                          aria-label="Add subtask"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          className="delete-btn"
                          onClick={() => handleDeleteTodo(todo.id)}
                          aria-label="Delete task"
                        >
                          ×
                        </button>
                      </>
                    )}
                  </div>
                </div>
                
                {(todo.isExpanded || addingSubtaskForId === todo.id) && (
                  <div className="subtasks-container">
                    {addingSubtaskForId === todo.id && (
                      <div className="new-subtask-input-container">
                        <input
                          type="text"
                          placeholder="Enter subtask..."
                          className="new-subtask-input"
                          value={newSubtaskText}
                          onChange={(e) => setNewSubtaskText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveNewSubtask(todo.id);
                            if (e.key === 'Escape') handleCancelAddSubtask();
                          }}
                          autoFocus
                        />
                        <div className="subtask-input-actions">
                          <button 
                            type="button"
                            className="subtask-save-btn" 
                            onClick={() => handleSaveNewSubtask(todo.id)}
                            disabled={!newSubtaskText.trim()}
                          >
                            Save
                          </button>
                          <button 
                            type="button"
                            className="subtask-cancel-btn" 
                            onClick={handleCancelAddSubtask}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {todo.subtasks.length > 0 && (
                      <ul className="subtasks-list">
                        {/* Sort subtasks by due date before rendering */}
                        {(sortByDueDate([...todo.subtasks]) as Subtask[])
                          // Only show non-hidden subtasks in the main UI
                          .filter((subtask: Subtask) => {
                            // Check if the subtask is hidden
                            return !subtask.hidden;
                          })
                          .map((subtask: Subtask) => (
                            <li
                              key={subtask.id}
                              className={`subtask-item ${subtask.completed ? 'completed' : ''}`}
                            >
                              <div className="subtask-main-row">
                                <div className="subtask-content">
                                  <button
                                    type="button"
                                    className={`subtask-checkbox ${subtask.completed ? 'checked' : ''}`}
                                    onClick={() => handleToggleSubtask(todo.id, subtask.id)}
                                    aria-label={subtask.completed ? "Mark subtask as incomplete" : "Mark subtask as complete"}
                                  >
                                    {subtask.completed && "✓"}
                                  </button>
                                  <div className="subtask-text-container">
                                    {editingSubtaskId && editingSubtaskId.subtaskId === subtask.id ? (
                                      <input
                                        type="text"
                                        className="edit-subtask-input"
                                        value={subtaskText}
                                        onChange={(e) => setSubtaskText(e.target.value)}
                                        onBlur={() => handleEditSubtaskSave()}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleEditSubtaskSave();
                                          if (e.key === 'Escape') handleEditSubtaskCancel();
                                        }}
                                        autoFocus
                                      />
                                    ) : (
                                      <>
                                        <span 
                                          className="subtask-text"
                                          onClick={() => openDetailsDrawer('subtask', subtask.id, todo.id)}
                                          title="Click to edit subtask"
                                        >{subtask.text}</span>
                                        {subtask.dueDate && (
                                          <span className="subtask-due-date">Due: {formatDate(subtask.dueDate)}</span>
                                        )}
                                        {subtask.completedDate && (
                                          <span className="subtask-completed-date">Done: {formatDate(subtask.completedDate)}</span>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                                
                                {(!editingSubtaskId || editingSubtaskId.subtaskId !== subtask.id) && (
                                  <div className="subtask-actions">
                                    <button
                                      type="button"
                                      className="subtask-calendar-icon"
                                      onClick={(e) => toggleSubtaskCalendar(e, todo.id, subtask.id)}
                                      aria-label="Set subtask due date"
                                    >
                                      📅
                                    </button>
                                    <button
                                      type="button"
                                      className="delete-subtask-btn"
                                      onClick={() => handleDeleteSubtask(todo.id, subtask.id)}
                                      aria-label="Delete subtask"
                                    >
                                      ×
                                    </button>
                                  </div>
                                )}
                              </div>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
          
          {/* End drop zone */}
          {isDragging && previewTodos.length > 0 && (
            <div 
              ref={endDropZoneRef}
              className={`end-drop-zone ${isDropEndZone ? 'drag-over' : ''}`}
              onDragOver={(e) => handleDragOver(e)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e)}
            >
              <div className="drop-indicator"></div>
            </div>
          )}
        </div>
      </header>
      
      {/* Calendar overlay and popup - separated from the task list for better z-index handling */}
      {calendarOpenForId !== null && (
        <div 
          className="calendar-modal-overlay"
          onClick={(e) => {
            e.stopPropagation();
            setCalendarOpenForId(null);
          }}
        >
          {todos.map(todo => todo.id === calendarOpenForId && (
            <div 
              key={`calendar-${todo.id}`}
              className="calendar-popup-container"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="calendar-popup">
                <div className="calendar-header">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCalendarNavigation('prev', 'task');
                    }}
                    className="calendar-nav-btn prev-month"
                    aria-label="Previous month"
                  >
                    ◀
                  </button>
                  <div className="month-title">
                    {calendarCurrentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCalendarNavigation('next', 'task');
                    }}
                    className="calendar-nav-btn next-month"
                    aria-label="Next month"
                  >
                    ▶
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setCalendarOpenForId(null);
                    }}
                    className="close-btn"
                  >
                    ×
                  </button>
                </div>
                
                <div className="calendar-content">
                  <div className="weekday-header">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                      <div key={day} className="weekday">{day}</div>
                    ))}
                  </div>
                  
                  <div className="calendar-days">
                    {(() => {
                      const year = calendarCurrentDate.getFullYear();
                      const month = calendarCurrentDate.getMonth();
                      
                      // Get first day of month and total days
                      const firstDayOfMonth = new Date(year, month, 1).getDay();
                      const daysInMonth = new Date(year, month + 1, 0).getDate();
                      
                      // Create array for calendar days
                      const days = [];
                      
                      // Add empty spaces for days before the first of month
                      for (let i = 0; i < firstDayOfMonth; i++) {
                        days.push(<div key={`empty-${i}`} className="empty-day"></div>);
                      }
                      
                      // Add days of month
                      for (let i = 1; i <= daysInMonth; i++) {
                        const date = new Date(year, month, i);
                        days.push(
                          <button 
                            key={i}
                            className={`calendar-day ${todo.dueDate && i === todo.dueDate.getDate() ? 'selected' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDateSelect(todo.id, date);
                            }}
                          >
                            {i}
                          </button>
                        );
                      }
                      
                      return days;
                    })()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Calendar overlay for new task */}
      {isNewTaskCalendarOpen && (
        <div 
          className="calendar-modal-overlay"
          onClick={(e) => {
            e.stopPropagation();
            setIsNewTaskCalendarOpen(false);
          }}
        >
          <div 
            className="calendar-popup-container"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="calendar-popup">
              <div className="calendar-header">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCalendarNavigation('prev', 'newTask');
                  }}
                  className="calendar-nav-btn prev-month"
                  aria-label="Previous month"
                >
                  ◀
                </button>
                <div className="month-title">
                  {newTaskCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCalendarNavigation('next', 'newTask');
                  }}
                  className="calendar-nav-btn next-month"
                  aria-label="Next month"
                >
                  ▶
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsNewTaskCalendarOpen(false);
                  }}
                  className="close-btn"
                >
                  ×
                </button>
              </div>
              
              <div className="calendar-content">
                <div className="weekday-header">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                    <div key={day} className="weekday">{day}</div>
                  ))}
                </div>
                
                <div className="calendar-days">
                  {(() => {
                    const year = newTaskCalendarDate.getFullYear();
                    const month = newTaskCalendarDate.getMonth();
                    
                    // Get first day of month and total days
                    const firstDayOfMonth = new Date(year, month, 1).getDay();
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    
                    // Create array for calendar days
                    const days = [];
                    
                    // Add empty spaces for days before the first of month
                    for (let i = 0; i < firstDayOfMonth; i++) {
                      days.push(<div key={`empty-${i}`} className="empty-day"></div>);
                    }
                    
                    // Add days of month
                    for (let i = 1; i <= daysInMonth; i++) {
                      const date = new Date(year, month, i);
                      const isSelected = newTaskDueDate && 
                                        newTaskDueDate.getDate() === i && 
                                        newTaskDueDate.getMonth() === month && 
                                        newTaskDueDate.getFullYear() === year;
                      
                      days.push(
                        <button 
                          key={i}
                          className={`calendar-day ${isSelected ? 'selected' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNewTaskDateSelect(date);
                          }}
                        >
                          {i}
                        </button>
                      );
                    }
                    
                    return days;
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Calendar overlay for subtasks */}
      {calendarOpenForSubtask !== null && (
        <div 
          className="calendar-modal-overlay"
          onClick={(e) => {
            e.stopPropagation();
            setCalendarOpenForSubtask(null);
          }}
        >
          {todos.map(todo => 
            todo.id === calendarOpenForSubtask.todoId && 
            todo.subtasks.map(subtask => 
              subtask.id === calendarOpenForSubtask.subtaskId && (
                <div 
                  key={`subtask-calendar-${todo.id}-${subtask.id}`}
                  className="calendar-popup-container"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="calendar-popup">
                    <div className="calendar-header">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCalendarNavigation('prev', 'subtask');
                        }}
                        className="calendar-nav-btn prev-month"
                        aria-label="Previous month"
                        type="button"
                      >
                        ◀
                      </button>
                      <div className="month-title">
                        {subtaskCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCalendarNavigation('next', 'subtask');
                        }}
                        className="calendar-nav-btn next-month"
                        aria-label="Next month"
                        type="button"
                      >
                        ▶
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setCalendarOpenForSubtask(null);
                        }}
                        className="close-btn"
                        type="button"
                      >
                        ×
                      </button>
                    </div>
                    
                    <div className="calendar-content">
                      <div className="weekday-header">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                          <div key={day} className="weekday">{day}</div>
                        ))}
                      </div>
                      
                      <div className="calendar-days">
                        {(() => {
                          const year = subtaskCalendarDate.getFullYear();
                          const month = subtaskCalendarDate.getMonth();
                          
                          // Get first day of month and total days
                          const firstDayOfMonth = new Date(year, month, 1).getDay();
                          const daysInMonth = new Date(year, month + 1, 0).getDate();
                          
                          // Create array for calendar days
                          const days = [];
                          
                          // Add empty spaces for days before the first of month
                          for (let i = 0; i < firstDayOfMonth; i++) {
                            days.push(<div key={`empty-${i}`} className="empty-day"></div>);
                          }
                          
                          // Add days of month
                          for (let i = 1; i <= daysInMonth; i++) {
                            const date = new Date(year, month, i);
                            const isSelected = subtask.dueDate && 
                                             subtask.dueDate.getDate() === i && 
                                             subtask.dueDate.getMonth() === month && 
                                             subtask.dueDate.getFullYear() === year;
                            
                            days.push(
                              <button 
                                key={i}
                                className={`calendar-day ${isSelected ? 'selected' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSubtaskDateSelect(todo.id, subtask.id, date);
                                }}
                                type="button"
                              >
                                {i}
                              </button>
                            );
                          }
                          
                          return days;
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )
            )
          )}
        </div>
      )}
      
      {/* Settings Menu */}
      {isSettingsOpen && (
        <div className="settings-menu">
          <div className="settings-header">
            <h3>Settings</h3>
            <button className="close-btn" onClick={toggleSettings}>×</button>
          </div>
          <div className="settings-content">
            <div className="theme-section">
              <h4>Theme</h4>
              <div className="theme-options">
                <div 
                  className={`theme-option ${currentTheme === 'default' ? 'selected' : ''}`}
                  onClick={() => setCurrentTheme('default')}
                >
                  <div className="theme-preview default-preview">
                    <div className="preview-header"></div>
                    <div className="preview-content">
                      <div className="preview-line"></div>
                      <div className="preview-line"></div>
                    </div>
                  </div>
                  <span>Default</span>
                </div>

                <div 
                  className={`theme-option ${currentTheme === 'mondrian' ? 'selected' : ''}`}
                  onClick={() => setCurrentTheme('mondrian')}
                >
                  <div className="theme-preview mondrian-preview">
                    <div className="preview-block red"></div>
                    <div className="preview-block blue"></div>
                    <div className="preview-block yellow"></div>
                  </div>
                  <span>Mondrian</span>
                </div>

                <div 
                  className={`theme-option ${currentTheme === 'vangogh' ? 'selected' : ''}`}
                  onClick={() => setCurrentTheme('vangogh')}
                >
                  <div className="theme-preview vangogh-preview">
                    <div className="preview-sky"></div>
                    <div className="preview-stars"></div>
                    <div className="preview-hills"></div>
                  </div>
                  <span>Van Gogh</span>
                </div>

                <div 
                  className={`theme-option ${currentTheme === 'lecorbusier' ? 'selected' : ''}`}
                  onClick={() => setCurrentTheme('lecorbusier')}
                >
                  <div className="theme-preview lecorbusier-preview">
                    <div className="preview-grid">
                      <div className="preview-block"></div>
                      <div className="preview-block accent"></div>
                      <div className="preview-block primary"></div>
                    </div>
                  </div>
                  <span>Le Corbusier</span>
                </div>

                <div 
                  className={`theme-option ${currentTheme === 'surprise' ? 'selected' : ''}`}
                  onClick={() => {
                    setCurrentTheme('surprise');
                    generateSurpriseTheme();
                  }}
                >
                  <div className="theme-preview surprise-preview">
                    <div className="preview-random">
                      <div className="preview-sparkle"></div>
                      <div className="preview-sparkle"></div>
                      <div className="preview-sparkle"></div>
                    </div>
                  </div>
                  <span>Surprise Me!</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Icon */}
      <button 
        className="settings-icon"
        onClick={toggleSettings}
        title="Settings"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" clipRule="evenodd" d="M11.4892 3.17094C11.1102 1.60969 8.8898 1.60969 8.51078 3.17094C8.26594 4.17949 7.17543 4.65811 6.22876 4.13176C4.85044 3.33851 3.33851 4.85044 4.13176 6.22876C4.65811 7.17543 4.17949 8.26594 3.17094 8.51078C1.60969 8.8898 1.60969 11.1102 3.17094 11.4892C4.17949 11.7341 4.65811 12.8246 4.13176 13.7712C3.33851 15.1496 4.85044 16.6615 6.22876 15.8682C7.17543 15.3419 8.26594 15.8205 8.51078 16.8291C8.8898 18.3903 11.1102 18.3903 11.4892 16.8291C11.7341 15.8205 12.8246 15.3419 13.7712 15.8682C15.1496 16.6615 16.6615 15.1496 15.8682 13.7712C15.3419 12.8246 15.8205 11.7341 16.8291 11.4892C18.3903 11.1102 18.3903 8.8898 16.8291 8.51078C15.8205 8.26594 15.3419 7.17543 15.8682 6.22876C16.6615 4.85044 15.1496 3.33851 13.7712 4.13176C12.8246 4.65811 11.7341 4.17949 11.4892 3.17094ZM10 13C11.6569 13 13 11.6569 13 10C13 8.34315 11.6569 7 10 7C8.34315 7 7 8.34315 7 10C7 11.6569 8.34315 13 10 13Z" fill="currentColor"/>
        </svg>
      </button>
      
      {/* History Icon */}
      <button 
        className="history-icon"
        onClick={toggleHistoryDrawer}
        title="Task History"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 4V10L13 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="2"/>
        </svg>
      </button>
      
      {/* History Drawer */}
      {isHistoryDrawerOpen && (
        <div className="history-drawer">
          <div className="history-drawer-header">
            <h3>Task History</h3>
            <button 
              className="close-history-btn"
              onClick={toggleHistoryDrawer}
              title="Close history"
            >
              ×
            </button>
          </div>
          
          <div className="history-content">
            {/* Time filter selector */}
            <div className="history-filters">
              <div className="filter-tabs">
                <button 
                  className={`filter-tab ${historyTimeFilter === '7days' ? 'active' : ''}`}
                  onClick={() => setHistoryTimeFilter('7days')}
                >
                  <span>Last</span>
                  <span>7 Days</span>
                </button>
                <button 
                  className={`filter-tab ${historyTimeFilter === '30days' ? 'active' : ''}`}
                  onClick={() => setHistoryTimeFilter('30days')}
                >
                  <span>Last</span>
                  <span>30 Days</span>
                </button>
                <button 
                  className={`filter-tab ${historyTimeFilter === 'custom' ? 'active' : ''}`}
                  onClick={() => {
                    setHistoryTimeFilter('custom');
                    setIsCustomDatePickerOpen(true);
                  }}
                >
                  <span>Custom</span>
                  <span>Range</span>
                </button>
              </div>
              
              {historyTimeFilter === 'custom' && (
                <div className="custom-date-range">
                  <div className="date-range-display">
                    <span>From: {customDateRange.start ? formatDate(customDateRange.start) : 'Select start date'}</span>
                    <span>To: {customDateRange.end ? formatDate(customDateRange.end) : 'Select end date'}</span>
                  </div>
                  <button 
                    className="edit-date-range-btn"
                    onClick={() => setIsCustomDatePickerOpen(!isCustomDatePickerOpen)}
                  >
                    {isCustomDatePickerOpen ? 'Close' : 'Edit'}
                  </button>
                </div>
              )}
              
              {/* Custom date picker */}
              {isCustomDatePickerOpen && (
                <div className="calendar-modal-overlay" onClick={() => setIsCustomDatePickerOpen(false)}>
                  <div className="calendar-popup-container" onClick={e => e.stopPropagation()}>
                    <div className="calendar-popup">
                      <div className="calendar-header">
                        <span className="month-title">
                          {customDateRange.start && !customDateRange.end 
                            ? 'Select End Date' 
                            : 'Select Start Date'}
                        </span>
                        <button 
                          className="close-btn"
                          onClick={() => setIsCustomDatePickerOpen(false)}
                        >
                          ×
                        </button>
                      </div>
                      
                      <div className="weekday-header">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day, index) => (
                          <div key={index} className="weekday">{day}</div>
                        ))}
                      </div>
                      
                      <div className="calendar-days">
                        {(() => {
                          const today = new Date();
                          const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                          const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                          
                          // Calculate days from previous month to show
                          const firstDayOfWeek = firstDayOfMonth.getDay(); // 0 for Sunday, 1 for Monday, etc.
                          
                          // Calculate total days to show
                          const totalDays = firstDayOfWeek + lastDayOfMonth.getDate();
                          const totalWeeks = Math.ceil(totalDays / 7);
                          
                          const days = [];
                          
                          // Add empty days for previous month
                          for (let i = 0; i < firstDayOfWeek; i++) {
                            days.push(
                              <div key={`empty-${i}`} className="empty-day"></div>
                            );
                          }
                          
                          // Add days for current month
                          for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
                            const date = new Date(today.getFullYear(), today.getMonth(), i);
                            
                            // Check if this date is selected
                            const isStartDate = customDateRange.start && 
                              date.getDate() === customDateRange.start.getDate() &&
                              date.getMonth() === customDateRange.start.getMonth() &&
                              date.getFullYear() === customDateRange.start.getFullYear();
                              
                            const isEndDate = customDateRange.end && 
                              date.getDate() === customDateRange.end.getDate() &&
                              date.getMonth() === customDateRange.end.getMonth() &&
                              date.getFullYear() === customDateRange.end.getFullYear();
                            
                            const isSelected = isStartDate || isEndDate;
                            
                            days.push(
                              <button
                                key={i}
                                className={`calendar-day ${isSelected ? 'selected' : ''}`}
                                onClick={() => handleCustomDateSelect(date)}
                                type="button"
                              >
                                {i}
                              </button>
                            );
                          }
                          
                          // Add empty days to complete last week row if needed
                          const remainingDays = 7 * totalWeeks - days.length;
                          for (let i = 0; i < remainingDays; i++) {
                            days.push(
                              <div key={`empty-end-${i}`} className="empty-day"></div>
                            );
                          }
                          
                          return days;
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Productivity Stats Summary */}
            {(() => {
              // Get tasks completed in the selected time period
              const filterDate = getFilterDate();
              
              // For custom range, we need to handle the end date
              let endDate = new Date();
              if (historyTimeFilter === 'custom' && customDateRange.end) {
                endDate = new Date(customDateRange.end);
                endDate.setHours(23, 59, 59, 999); // End of day
              }
              
              // Count completed tasks in the time period - check completedTasks array
              const filteredCompletedTasks = completedTasks.filter(task => 
                task.completedDate && (
                  historyTimeFilter === 'custom' && customDateRange.end
                    ? task.completedDate >= filterDate && task.completedDate <= endDate
                    : task.completedDate >= filterDate
                )
              );
              
              // Count all completed subtasks within completed tasks
              let completedSubtasks = 0;
              let taskCompletionTimes = 0;
              let subtaskCompletionTimes = 0;
              let tasksWithDueDate = 0;
              let subtasksWithDueDate = 0;
              
              // Calculate average completion time for tasks and count subtasks
              filteredCompletedTasks.forEach((task: Todo) => {
                if (task.completedDate && task.dueDate) {
                  // Calculate real time difference (can be negative for early completion)
                  const timeDiff = (task.completedDate.getTime() - task.dueDate.getTime()) / (1000 * 60 * 60 * 24);
                  taskCompletionTimes += timeDiff;
                  tasksWithDueDate++;
                }
                
                // Count and calculate completed subtasks
                task.subtasks.forEach((subtask: Subtask) => {
                  if (subtask.completed && subtask.completedDate) {
                    // Check if the subtask completion date is within our filter
                    let isInRange = false;
                    
                    if (historyTimeFilter === 'custom' && customDateRange.end) {
                      isInRange = subtask.completedDate >= filterDate && subtask.completedDate <= endDate;
                    } else {
                      isInRange = subtask.completedDate >= filterDate;
                    }
                    
                    if (isInRange) {
                      completedSubtasks++;
                      
                      if (subtask.dueDate) {
                        // Calculate real time difference (can be negative for early completion)
                        const timeDiff = (subtask.completedDate.getTime() - subtask.dueDate.getTime()) / (1000 * 60 * 60 * 24);
                        subtaskCompletionTimes += timeDiff;
                        subtasksWithDueDate++;
                      }
                    }
                  }
                });
              });
              
              // Find completed subtasks in active tasks
              const activeTasks = todos.filter(todo => !todo.completed);
              activeTasks.forEach((task: Todo) => {
                task.subtasks.forEach((subtask: Subtask) => {
                  if (subtask.completed && subtask.completedDate) {
                    // Check if the subtask completion date is within our filter
                    let isInRange = false;
                    
                    if (historyTimeFilter === 'custom' && customDateRange.end) {
                      isInRange = subtask.completedDate >= filterDate && subtask.completedDate <= endDate;
                    } else {
                      isInRange = subtask.completedDate >= filterDate;
                    }
                    
                    if (isInRange) {
                      completedSubtasks++;
                      
                      if (subtask.dueDate) {
                        // Calculate real time difference (can be negative for early completion)
                        const timeDiff = (subtask.completedDate.getTime() - subtask.dueDate.getTime()) / (1000 * 60 * 60 * 24);
                        subtaskCompletionTimes += timeDiff;
                        subtasksWithDueDate++;
                      }
                    }
                  }
                });
              });
              
              // Calculate averages - don't use Math.max to allow negative values (early completion)
              const avgTaskCompletionTime = tasksWithDueDate > 0 
                ? (taskCompletionTimes / tasksWithDueDate).toFixed(1)
                : "N/A";
                
              const avgSubtaskCompletionTime = subtasksWithDueDate > 0
                ? (subtaskCompletionTimes / subtasksWithDueDate).toFixed(1)
                : "N/A";
              
              // Create period text based on selected filter
              let periodText = "";
              switch (historyTimeFilter) {
                case '7days':
                  periodText = "in the past 7 days";
                  break;
                case '30days':
                  periodText = "in the past 30 days";
                  break;
                case 'custom':
                  periodText = "in the selected period";
                  break;
              }
              
              // Helper function to create a user-friendly message about completion time
              const getCompletionMessage = (avgTime: string) => {
                if (avgTime === "N/A") return "N/A";
                
                const timeValue = parseFloat(avgTime);
                if (timeValue < 0) {
                  return `completed ${Math.abs(timeValue).toFixed(1)} days before the due date on average`;
                } else if (timeValue === 0) {
                  return "completed exactly on the due date";
                } else {
                  return `completed ${timeValue} days after the due date on average`;
                }
              };
              
              // Get encouraging message based on timeliness
              const getEncouragementMessage = () => {
                const taskTimeValue = tasksWithDueDate > 0 ? parseFloat(avgTaskCompletionTime as string) : 0;
                const subtaskTimeValue = subtasksWithDueDate > 0 ? parseFloat(avgSubtaskCompletionTime as string) : 0;
                
                // No due dates set
                if (tasksWithDueDate === 0 && subtasksWithDueDate === 0) {
                  return "Keep up the good work!";
                }
                
                // If either tasks or subtasks are late
                if (taskTimeValue > 0 || subtaskTimeValue > 0) {
                  const messages = [
                    "Keep working hard to get your tasks done on time!",
                    "Remember, earlier planning leads to better results!",
                    "Small improvements in timing add up to big productivity gains!",
                    "Being on time is a skill you can develop with practice!"
                  ];
                  // Return a random message
                  return messages[Math.floor(Math.random() * messages.length)];
                } 
                // All tasks/subtasks completed on time or early
                else {
                  const messages = [
                    "Fantastic work hitting your deadlines!",
                    "Keep up the good work!",
                    "You're doing an amazing job with your task management!",
                    "Excellent time management skills!"
                  ];
                  // Return a random message
                  return messages[Math.floor(Math.random() * messages.length)];
                }
              };
              
              // Only show the stats if we have completed tasks or subtasks
              if (filteredCompletedTasks.length > 0 || completedSubtasks > 0) {
                return (
                  <div className="productivity-stats">
                    <h3 className="stats-header">
                      <span role="img" aria-label="celebration">🎯</span> Your Productivity
                    </h3>
                    <div className="stats-message">
                      <p>Hooray! You've finished <strong>{filteredCompletedTasks.length}</strong> tasks and <strong>{completedSubtasks}</strong> subtasks {periodText}.</p>
                      
                      {tasksWithDueDate > 0 && (
                        <p className={parseFloat(avgTaskCompletionTime as string) <= 0 ? "on-time" : "late"}>
                          Tasks were <strong>{getCompletionMessage(avgTaskCompletionTime as string)}</strong>.
                        </p>
                      )}
                      
                      {subtasksWithDueDate > 0 && (
                        <p className={parseFloat(avgSubtaskCompletionTime as string) <= 0 ? "on-time" : "late"}>
                          Subtasks were <strong>{getCompletionMessage(avgSubtaskCompletionTime as string)}</strong>.
                        </p>
                      )}
                      
                      <p className="stats-encouragement">{getEncouragementMessage()}</p>
                    </div>
                  </div>
                );
              }
              
              return (
                <div className="productivity-stats">
                  <h3 className="stats-header">
                    <span role="img" aria-label="target">🎯</span> Your Productivity
                  </h3>
                  <div className="stats-message">
                    <p>No completed tasks or subtasks {periodText}.</p>
                    <p className="stats-encouragement">Start completing tasks to see your productivity stats!</p>
                  </div>
                </div>
              );
            })()}
            
            {/* Section for completed tasks */}
            <div className="history-section">
              <h4 className="history-section-title">Recently Completed Tasks</h4>
              
              {completedTasks.length === 0 ? (
                <div className="no-history">
                  <p>No tasks completed in the selected time period</p>
                </div>
              ) : (
                <div className="history-list">
                  {/* Completed main tasks with their subtasks */}
                  {completedTasks
                    .filter(task => {
                      if (!task.completedDate) return false;
                      const filterDate = getFilterDate();
                      
                      // For custom range, check if the date is within the range
                      if (historyTimeFilter === 'custom' && customDateRange.end) {
                        // Set end of day for end date to include the entire day
                        const endDate = new Date(customDateRange.end);
                        endDate.setHours(23, 59, 59, 999);
                        return task.completedDate >= filterDate && task.completedDate <= endDate;
                      }
                      
                      // For preset ranges, just check if after filter date
                      return task.completedDate >= filterDate;
                    })
                    .map(task => (
                      <div key={task.id} className="history-item">
                        <div className="history-task-main">
                          <button
                            type="button"
                            className={`checkbox checked`}
                            onClick={() => handleRestoreTask(task.id)}
                            aria-label="Restore task to active list"
                            title="Uncheck to restore task"
                          >
                            ✓
                          </button>
                          <div className="history-task-header">
                            <span 
                              className="history-task-text"
                              onClick={() => openDetailsDrawer('task', task.id)}
                              style={{ cursor: 'pointer' }}
                              title="Click to view details"
                            >{task.text}</span>
                            <div className="history-date-container">
                              {task.completedDate && (
                                <span className="history-done-date">
                                  Done: {formatDate(task.completedDate)}
                                </span>
                              )}
                              {task.dueDate && (
                                <span className="history-due-date">
                                  Due: {formatDate(task.dueDate)}
                                </span>
                              )}
                              {task.completedDate && task.dueDate && (
                                <span className={`completion-status ${getCompletionStatus(task.completedDate, task.dueDate).status}`}>
                                  {getCompletionStatus(task.completedDate, task.dueDate).label}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Show all subtasks for completed tasks */}
                        {task.subtasks.length > 0 && (
                          <div className="history-subtasks">
                            {task.subtasks.map(subtask => (
                              <div key={subtask.id} className="history-subtask-item">
                                <button
                                  type="button"
                                  className={`subtask-checkbox checked`}
                                  onClick={() => handleRestoreSubtaskFromCompletedTask(task.id, subtask.id)}
                                  aria-label="Restore subtask to a new or existing active task"
                                  title="Uncheck to restore subtask"
                                >
                                  ✓
                                </button>
                                <div className="history-subtask-content">
                                  <span 
                                    className="history-subtask-text"
                                    onClick={() => openDetailsDrawer('subtask', subtask.id, task.id)}
                                    style={{ cursor: 'pointer' }}
                                    title="Click to view details"
                                  >{subtask.text}</span>
                                  <div className="history-subtask-dates">
                                    {subtask.completedDate && (
                                      <span className="history-subtask-done-date">
                                        Done: {formatDate(subtask.completedDate)}
                                      </span>
                                    )}
                                    {subtask.dueDate && (
                                      <span className="history-subtask-due-date">
                                        Due: {formatDate(subtask.dueDate)}
                                      </span>
                                    )}
                                    {subtask.completedDate && subtask.dueDate && (
                                      <span className={`completion-status ${getCompletionStatus(subtask.completedDate, subtask.dueDate).status}`}>
                                        {getCompletionStatus(subtask.completedDate, subtask.dueDate).label}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
            
            {/* Section for completed subtasks in active tasks */}
            {(() => {
              // Find all active tasks with completed subtasks (including hidden ones)
              const activeTasks = todos.filter(todo => !todo.completed);
              const tasksWithCompletedSubtasks = activeTasks.filter(task => 
                task.subtasks.some(subtask => subtask.completed && subtask.completedDate)
              );
              
              if (tasksWithCompletedSubtasks.length > 0) {
                return (
                  <div className="history-section">
                    <h4 className="history-section-title">Completed Subtasks in Active Tasks</h4>
                    
                    {tasksWithCompletedSubtasks.map(task => {
                      // Filter subtasks completed in the selected time period, include hidden ones
                      const filteredCompletedSubtasks = task.subtasks.filter(subtask => {
                        if (!subtask.completed || !subtask.completedDate) return false;
                        
                        const filterDate = getFilterDate();
                        
                        // For custom range, check if the date is within the range
                        if (historyTimeFilter === 'custom' && customDateRange.end) {
                          // Set end of day for end date to include the entire day
                          const endDate = new Date(customDateRange.end);
                          endDate.setHours(23, 59, 59, 999);
                          return subtask.completedDate >= filterDate && subtask.completedDate <= endDate;
                        }
                        
                        // For preset ranges, just check if after filter date
                        return subtask.completedDate >= filterDate;
                      });
                      
                      if (filteredCompletedSubtasks.length === 0) return null;
                      
                      return (
                        <div key={task.id} className="history-item active-parent">
                          <div className="history-task-main">
                            <span 
                              className="history-parent-task-text"
                              onClick={() => openDetailsDrawer('task', task.id)}
                              style={{ cursor: 'pointer' }}
                              title="Click to view details"
                            >{task.text}</span>
                          </div>
                          
                          <div className="history-subtasks">
                            {filteredCompletedSubtasks.map(subtask => (
                              <div key={subtask.id} className="history-subtask-item">
                                <button
                                  type="button"
                                  className={`subtask-checkbox checked`}
                                  onClick={() => handleRestoreSubtask(task.id, subtask.id)}
                                  aria-label="Restore subtask to incomplete"
                                  title="Uncheck to restore subtask"
                                >
                                  ✓
                                </button>
                                <div className="history-subtask-content">
                                  <span 
                                    className="history-subtask-text"
                                    onClick={() => openDetailsDrawer('subtask', subtask.id, task.id)}
                                    style={{ cursor: 'pointer' }}
                                    title="Click to view details"
                                  >{subtask.text}</span>
                                  <div className="history-subtask-dates">
                                    {subtask.completedDate && (
                                      <span className="history-subtask-done-date">
                                        Done: {formatDate(subtask.completedDate)}
                                      </span>
                                    )}
                                    {subtask.dueDate && (
                                      <span className="history-subtask-due-date">
                                        Due: {formatDate(subtask.dueDate)}
                                      </span>
                                    )}
                                    {subtask.completedDate && subtask.dueDate && (
                                      <span className={`completion-status ${getCompletionStatus(subtask.completedDate, subtask.dueDate).status}`}>
                                        {getCompletionStatus(subtask.completedDate, subtask.dueDate).label}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              }
              
              return null;
            })()}
          </div>
        </div>
      )}
      
      {/* Details Drawer */}
      {isDetailsDrawerOpen && editingDetails && (
        <div className={`details-drawer ${currentTheme}`}>
          <div className="details-drawer-header">
            <h3>{editingDetails.type === 'task' ? 'Task Details' : 'Subtask Details'}</h3>
            <button 
              className="close-history-btn"
              onClick={closeDetailsDrawer}
              title="Close details"
            >
              ×
            </button>
          </div>
          
          <div className="details-content">
            <div className="details-field">
              <label htmlFor="details-title">Title:</label>
              <input
                id="details-title"
                type="text"
                value={editingDetails.title}
                onChange={(e) => setEditingDetails({
                  ...editingDetails,
                  title: e.target.value
                })}
                placeholder="Enter title"
              />
            </div>
            <div className="details-field">
              <label htmlFor="details-notes">Notes:</label>
              <textarea
                id="details-notes"
                value={editingDetails.notes || ''}
                onChange={(e) => setEditingDetails({
                  ...editingDetails,
                  notes: e.target.value
                })}
                placeholder="Add notes here..."
                rows={6}
              />
            </div>
            <div className="details-field">
              <label htmlFor="details-due-date">Due Date:</label>
              <div className="details-due-date">
                {editingDetails.dueDate ? (
                  <div className="details-date-display">
                    <span>{formatDate(editingDetails.dueDate)}</span>
                    <button
                      className="details-date-clear"
                      onClick={() => setEditingDetails({
                        ...editingDetails,
                        dueDate: null
                      })}
                      title="Clear due date"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <button
                    className="details-date-select"
                    onClick={() => {
                      setCalendarCurrentDate(new Date());
                      setDetailsCalendarOpen(true);
                    }}
                  >
                    Set Due Date
                  </button>
                )}
              </div>
              {detailsCalendarOpen && (
                <div className="details-calendar">
                  <div className="calendar-month">
                    <button
                      className="month-nav"
                      onClick={() => {
                        const newDate = new Date(calendarCurrentDate);
                        newDate.setMonth(newDate.getMonth() - 1);
                        setCalendarCurrentDate(newDate);
                      }}
                    >
                      &lt;
                    </button>
                    <div className="month-label">
                      {calendarCurrentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </div>
                    <button
                      className="month-nav"
                      onClick={() => {
                        const newDate = new Date(calendarCurrentDate);
                        newDate.setMonth(newDate.getMonth() + 1);
                        setCalendarCurrentDate(newDate);
                      }}
                    >
                      &gt;
                    </button>
                  </div>
                  <div className="weekday-header">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day, index) => (
                      <div key={index} className="weekday">{day}</div>
                    ))}
                  </div>
                  <div className="calendar-days">
                    {(() => {
                      const year = calendarCurrentDate.getFullYear();
                      const month = calendarCurrentDate.getMonth();
                      const firstDayOfMonth = new Date(year, month, 1);
                      const lastDayOfMonth = new Date(year, month + 1, 0);
                      
                      // Calculate days from previous month to show
                      const firstDayOfWeek = firstDayOfMonth.getDay(); // 0 for Sunday, 1 for Monday, etc.
                      
                      // Calculate total days to show
                      const totalDays = firstDayOfWeek + lastDayOfMonth.getDate();
                      const totalWeeks = Math.ceil(totalDays / 7);
                      
                      const days = [];
                      
                      // Add empty days for previous month
                      for (let i = 0; i < firstDayOfWeek; i++) {
                        days.push(
                          <div key={`empty-${i}`} className="empty-day"></div>
                        );
                      }
                      
                      // Add days for current month
                      for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
                        const date = new Date(year, month, i);
                        const isSelected = editingDetails.dueDate && 
                          date.getDate() === editingDetails.dueDate.getDate() &&
                          date.getMonth() === editingDetails.dueDate.getMonth() &&
                          date.getFullYear() === editingDetails.dueDate.getFullYear();
                        
                        days.push(
                          <button
                            key={i}
                            className={`calendar-day ${isSelected ? 'selected' : ''}`}
                            onClick={() => {
                              const selectedDate = new Date(year, month, i);
                              setEditingDetails({
                                ...editingDetails,
                                dueDate: selectedDate
                              });
                              setDetailsCalendarOpen(false);
                            }}
                            type="button"
                          >
                            {i}
                          </button>
                        );
                      }
                      
                      // Add empty days to complete last week row if needed
                      const remainingDays = 7 * totalWeeks - days.length;
                      for (let i = 0; i < remainingDays; i++) {
                        days.push(
                          <div key={`empty-end-${i}`} className="empty-day"></div>
                        );
                      }
                      
                      return days;
                    })()}
                  </div>
                </div>
              )}
            </div>
            <div className="details-buttons">
              <button className="save-details" onClick={saveDetailsDrawer}>Save</button>
              <button className="cancel-details" onClick={closeDetailsDrawer}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
