import React, { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';
import './Mondrian.css';
import './VanGogh.css';
import './LeCorbusier.css';
import { auth, onAuthStateChanged, signOut } from './firebase';
import Login from './components/Login';
import { AuthProvider } from './contexts/AuthContext';
import { Todo, Subtask } from './types';
import { getTodos, getCompletedTodos, addTodo, updateTodo, deleteTodo, moveTodoToCompleted, restoreTodo } from './firestore';
import NetworkStatus from './components/NetworkStatus';

// Utility function to detect mobile devices
const isMobile = () => { 
  // Check for touch capability (most reliable for emulators)
  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Check for typical mobile dimensions
  const isMobileSize = window.innerWidth <= 768;
  
  // Check user agent (traditional method)
  const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // If in a development environment and the dimensions are mobile-like, prioritize that for emulator testing
  return hasTouchScreen || isMobileSize || isMobileUserAgent;
};

// Add new theme types
type ThemeType = 'default' | 'mondrian' | 'vangogh' | 'lecorbusier' | 'surprise';

// Utility function to capitalize the first letter of text
const capitalizeFirstLetter = (text: string): string => {
  if (!text || text.length === 0) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
};

interface EditingDetails {
  type: 'task' | 'subtask';
  id: number;
  parentId?: number;
  title: string;
  notes: string | undefined;
  dueDate: Date | null;
}

// SwipeableTask component
const SwipeableTask = ({ 
  todo, 
  children, 
  onDelete,
  className,
  ...props
}: {
  todo: Todo, 
  children: React.ReactNode, 
  onDelete: (id: number) => void,
  className?: string,
  [key: string]: any
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [touchMoved, setTouchMoved] = useState(false);

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setTouchMoved(false);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    setTouchEnd(e.targetTouches[0].clientX);
    setTouchMoved(true);
    
    // Optional: add real-time dragging effect
    if (touchStart !== null) {
      const currentDistance = touchStart - e.targetTouches[0].clientX;
      if (currentDistance > 0) { // Only allow left swipes (to show delete)
        const translateX = Math.min(currentDistance, 80); // Limit to max 80px (width of delete button)
        (e.currentTarget as HTMLElement).style.transform = `translateX(-${translateX}px)`;
      }
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (!touchStart || !touchEnd || !touchMoved) {
      (e.currentTarget as HTMLElement).style.transform = ''; // Reset any inline transform
      return;
    }
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    // Reset inline transform since we'll use the CSS class
    (e.currentTarget as HTMLElement).style.transform = '';
    
    if (isLeftSwipe) {
      setIsOpen(true);
    } else if (isRightSwipe) {
      setIsOpen(false);
    } else {
      // If the swipe wasn't far enough in either direction, reset to the previous state
    }
  };

  const touchHandlers = isMobile() ? {
    onTouchStart,
    onTouchMove,
    onTouchEnd
  } : {};

  return (
    <li
      className={`${className || ''} ${isMobile() ? 'swipeable-item' : ''} ${isOpen ? 'swipe-open' : ''}`}
      {...props}
      {...touchHandlers}
    >
      {children}
      
      {/* Swipe delete action */}
      {isMobile() && (
        <div 
          className={`swipe-action ${isOpen ? 'show' : ''} ${todo.isExpanded ? 'includes-subtasks' : ''}`}
          onClick={() => {
            setIsOpen(false);
            // Add a small delay to allow the closing animation to play
            setTimeout(() => onDelete(todo.id), 300);
          }}
        >
          <span className="swipe-action-text">Delete</span>
        </div>
      )}
    </li>
  );
};

// SwipeableSubtask component
const SwipeableSubtask = ({ 
  todoId,
  subtask, 
  children, 
  onDelete,
  className,
  ...props
}: {
  todoId: number,
  subtask: Subtask, 
  children: React.ReactNode, 
  onDelete: (todoId: number, subtaskId: number) => void,
  className?: string,
  [key: string]: any
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [touchMoved, setTouchMoved] = useState(false);

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setTouchMoved(false);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    setTouchEnd(e.targetTouches[0].clientX);
    setTouchMoved(true);
    
    // Optional: add real-time dragging effect
    if (touchStart !== null) {
      const currentDistance = touchStart - e.targetTouches[0].clientX;
      if (currentDistance > 0) { // Only allow left swipes (to show delete)
        const translateX = Math.min(currentDistance, 80); // Limit to max 80px (width of delete button)
        (e.currentTarget as HTMLElement).style.transform = `translateX(-${translateX}px)`;
      }
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (!touchStart || !touchEnd || !touchMoved) {
      (e.currentTarget as HTMLElement).style.transform = ''; // Reset any inline transform
      return;
    }
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    // Reset inline transform since we'll use the CSS class
    (e.currentTarget as HTMLElement).style.transform = '';
    
    if (isLeftSwipe) {
      setIsOpen(true);
    } else if (isRightSwipe) {
      setIsOpen(false);
    } else {
      // If the swipe wasn't far enough in either direction, reset to the previous state
    }
  };

  const touchHandlers = isMobile() ? {
    onTouchStart,
    onTouchMove,
    onTouchEnd
  } : {};

  const handleDeleteClick = (e: React.MouseEvent) => {
    // Prevent event bubbling to parent components
    e.stopPropagation();
    setIsOpen(false);
    // Add a small delay to allow the closing animation to play
    setTimeout(() => onDelete(todoId, subtask.id), 300);
  };

  return (
    <li
      className={`${className || ''} ${isMobile() ? 'swipeable-item' : ''} ${isOpen ? 'swipe-open' : ''}`}
      {...props}
      // Apply swipe handlers only for mobile, and add a click handler to stop propagation
      {...(isMobile() ? {
        ...touchHandlers,
        onClick: (e: React.MouseEvent) => {
          // Stop clicks from reaching parent swipeable items
          e.stopPropagation();
          if (props.onClick) props.onClick(e);
        }
      } : {})}
    >
      {children}
      
      {/* Swipe delete action */}
      {isMobile() && (
        <div 
          className={`swipe-action ${isOpen ? 'show' : ''}`}
          onClick={handleDeleteClick}
        >
          <span className="swipe-action-text">Delete</span>
        </div>
      )}
    </li>
  );
};

function App() {
  // State for todos and input
  const [todos, setTodos] = useState<Todo[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Todo[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isAppLoading, setIsAppLoading] = useState<boolean>(false);
  
  // Authentication state
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Drag and drop state
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverTaskId, setDragOverTaskId] = useState<number | null>(null);
  const [isDropEndZone, setIsDropEndZone] = useState(false);
  const [previewTodos, setPreviewTodos] = useState<Todo[]>([]);
  
  // Task editing state
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [sortTasksByDueDate, setSortTasksByDueDate] = useState(false);
  
  // Subtask state
  const [editingSubtaskId, setEditingSubtaskId] = useState<{todoId: number, subtaskId: number} | null>(null);
  const [subtaskText, setSubtaskText] = useState('');
  const [addingSubtaskForId, setAddingSubtaskForId] = useState<number | null>(null);
  const [newSubtaskText, setNewSubtaskText] = useState('');
  
  // Calendar state
  const [calendarOpenForTaskId, setCalendarOpenForTaskId] = useState<number | null>(null);
  const [subtaskCalendarOpen, setSubtaskCalendarOpen] = useState<{todoId: number, subtaskId: number} | null>(null);
  const [isNewTaskCalendarOpen, setIsNewTaskCalendarOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [newTaskCalendarDate, setNewTaskCalendarDate] = useState(new Date());
  const [subtaskCalendarDate, setSubtaskCalendarDate] = useState(new Date());
  const [newTaskDueDate, setNewTaskDueDate] = useState<Date | null>(null);
  
  // App title state
  const [appTitle, setAppTitle] = useState<string>('Your to-dos');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isTitleHovered, setIsTitleHovered] = useState(false);
  
  // UI state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = useState(false);
  const [editingDetails, setEditingDetails] = useState<EditingDetails | null>(null);
  const [detailsCalendarOpen, setDetailsCalendarOpen] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(0); // Add this state to force re-renders
  
  // Theme state
  const [currentTheme, setCurrentTheme] = useState<ThemeType>('mondrian');
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);
  const [comingSoonTheme, setComingSoonTheme] = useState('');
  
  // Date filters for history
  const [historyTimeFilter, setHistoryTimeFilter] = useState<'7days' | '30days' | 'custom'>('7days');
  const [customDateRange, setCustomDateRange] = useState<{start: Date | null, end: Date | null}>({
    start: null,
    end: new Date()
  });
  const [isCustomDatePickerOpen, setIsCustomDatePickerOpen] = useState(false);
  
  // Refs
  const endDropZoneRef = useRef<HTMLDivElement>(null);
  const todoListRef = useRef<HTMLUListElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const editSubtaskInputRef = useRef<HTMLInputElement>(null);
  const newSubtaskInputRef = useRef<HTMLInputElement>(null);
  // Ref to track auto-completed tasks to prevent duplicates
  const autoCompletedTaskRef = useRef<number | null>(null);
  
  // Add state for tracking which task has an open calendar
  const [calendarOpenForId, setCalendarOpenForId] = useState<number | null>(null);
  const [calendarOpenForSubtask, setCalendarOpenForSubtask] = useState<{todoId: number, subtaskId: number} | null>(null);
  
  // Track if we're in an active drop operation to reduce flickering
  const isActiveDropTargetRef = useRef(false);
  
  // Debounce clicks on the calendar
  const calendarClickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isCalendarClickPendingRef = useRef(false);
  
  // For surprise theme colors
  const [surpriseColors, setSurpriseColors] = useState({
    primary: '#000000',
    secondary: '#ffffff',
    accent: '#cccccc',
    background: '#f0f0f0',
    text: '#333333'
  });
  
  // State variables for swipe-to-delete functionality
  const [swipedTaskId, setSwipedTaskId] = useState<number | null>(null);
  const [swipedSubtaskInfo, setSwipedSubtaskInfo] = useState<{todoId: number, subtaskId: number} | null>(null);
  
  // Move the isOnline state before any conditional returns
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Utility function to get the latest date from a list of subtasks
  const getLatestSubtaskDate = (subtasks: Subtask[]): Date | null => {
    if (!subtasks || subtasks.length === 0) return null;
    
    let latestDate: Date | null = null;
    
    subtasks.forEach(subtask => {
      if (subtask.dueDate) {
        if (!latestDate || subtask.dueDate > latestDate) {
          latestDate = new Date(subtask.dueDate.getTime());
        }
      }
    });
    
    return latestDate;
  };

  // Title editing functions
  const handleTitleEditStart = () => {
    setIsEditingTitle(true);
    // Focus the title input after the state update
    setTimeout(() => {
      if (titleInputRef.current) {
        titleInputRef.current.focus();
      }
    }, 0);
  };
  
  const handleTitleEditSave = () => {
    // Save the new title (state is already updated through the input)
    setIsEditingTitle(false);
  };
  
  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleEditSave();
    } else if (e.key === 'Escape') {
      handleTitleEditCancel();
    }
  };
  
  const handleTitleEditCancel = () => {
    // Reset to the previous title (before editing)
    setAppTitle(appTitle);
    setIsEditingTitle(false);
  };

  // Utility function to format dates
  const formatDate = (date: Date | null): string => {
    if (!date) return '';
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };

  // Calendar functions
  const toggleNewTaskCalendar = () => {
    setIsNewTaskCalendarOpen(!isNewTaskCalendarOpen);
  };

  // Task editing functions
  const handleEditSave = () => {
    if (editingTaskId === null) return;
    
    setTodos(prevTodos => 
      prevTodos.map(todo => 
        todo.id === editingTaskId 
          ? {...todo, text: editText} 
          : todo
      )
    );
    
    setEditingTaskId(null);
    setEditText('');
  };
  
  const handleEditCancel = () => {
    setEditingTaskId(null);
    setEditText('');
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent<HTMLLIElement>, id: number) => {
    setDraggedTaskId(id);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
  };
  
  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverTaskId(null);
    setIsDragging(false);
    setIsDropEndZone(false);
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLElement>, id?: number) => {
    e.preventDefault();
    
    if (id !== undefined) {
      setDragOverTaskId(id);
      setIsDropEndZone(false);
    } else {
      setIsDropEndZone(true);
      setDragOverTaskId(null);
    }
    
    e.dataTransfer.dropEffect = 'move';
  };
  
  const handleDragLeave = () => {
    setDragOverTaskId(null);
    setIsDropEndZone(false);
  };
  
  const handleDrop = (e: React.DragEvent<HTMLElement>, dropTargetId?: number) => {
    e.preventDefault();
    
    // If no id is being dragged or it's the same as the drop target, do nothing
    if (!draggedTaskId || draggedTaskId === dropTargetId) {
      setIsDragging(false);
      setDraggedTaskId(null);
      setDragOverTaskId(null);
      setIsDropEndZone(false);
      return;
    }
    
    // If we're dropping at the end
    if (isDropEndZone) {
      // Move the task to the end of the list
      setTodos(prevTodos => {
        // Remove the dragged task
        const dragged = prevTodos.find(todo => todo.id === draggedTaskId);
        const withoutDragged = prevTodos.filter(todo => todo.id !== draggedTaskId);
        
        // Add the dragged task to the end
        return [...withoutDragged, dragged!];
      });
    } 
    // If we're dropping on another task
    else if (dropTargetId !== undefined) {
      setTodos(prevTodos => {
        // Remove the dragged task
        const dragged = prevTodos.find(todo => todo.id === draggedTaskId);
        if (!dragged) return prevTodos;
        
        const withoutDragged = prevTodos.filter(todo => todo.id !== draggedTaskId);
        
        // Find the index where to insert
        const dropIndex = withoutDragged.findIndex(todo => todo.id === dropTargetId);
        
        // Insert the dragged task at that position
        return [
          ...withoutDragged.slice(0, dropIndex + 1),
          dragged,
          ...withoutDragged.slice(dropIndex + 1)
        ];
      });
    }
    
    // Reset drag state
    setIsDragging(false);
    setDraggedTaskId(null);
    setDragOverTaskId(null);
    setIsDropEndZone(false);
  };

  // Calendar toggling for tasks
  const toggleCalendar = (e: React.MouseEvent, taskId: number) => {
    e.stopPropagation();
    
    if (calendarOpenForTaskId === taskId) {
      setCalendarOpenForTaskId(null);
    } else {
      setCalendarOpenForTaskId(taskId);
      setSubtaskCalendarOpen(null);
      setIsNewTaskCalendarOpen(false);
    }
  };
  
  // Toggle task expansion (showing/hiding subtasks)
  const toggleTaskExpansion = (taskId: number) => {
    setTodos(prevTodos => 
      prevTodos.map(todo => 
        todo.id === taskId 
          ? {...todo, isExpanded: !todo.isExpanded} 
          : todo
      )
    );
  };

  // Subtask handling functions
  const handleAddSubtask = (todoId: number) => {
    setAddingSubtaskForId(todoId);
    setNewSubtaskText('');
    // Focus the input after the state update
    setTimeout(() => {
      if (newSubtaskInputRef.current) {
        newSubtaskInputRef.current.focus();
      }
    }, 0);
  };
  
  const handleSaveNewSubtask = (todoId: number) => {
    if (!newSubtaskText.trim()) return;
    
    // Find the maximum subtask ID to create a new unique ID
    let maxSubtaskId = 0;
    todos.forEach(todo => {
      todo.subtasks.forEach(subtask => {
        maxSubtaskId = Math.max(maxSubtaskId, subtask.id);
      });
    });
    
    // Find the parent task to check if it has a due date
    const parentTask = todos.find(todo => todo.id === todoId);
    
    // Create a proper date object from the parent's due date if it exists
    const parentDueDate = parentTask?.dueDate ? new Date(parentTask.dueDate.getTime()) : null;
    
    const newSubtask: Subtask = {
      id: maxSubtaskId + 1,
      text: newSubtaskText,
      completed: false,
      // Inherit the due date from the parent task if it exists (as a new Date object)
      dueDate: parentDueDate,
      completedDate: null
    };
    
    // Log to verify the date is correctly assigned
    if (parentDueDate) {
      console.log(`Setting subtask due date to parent's due date: ${parentDueDate.toLocaleDateString()}`);
    }
    
    setTodos(prevTodos => 
      prevTodos.map(todo => {
        if (todo.id === todoId) {
          return {
            ...todo,
            isExpanded: true, // Auto-expand to show the new subtask
            subtasks: [...todo.subtasks, newSubtask]
          };
        }
        return todo;
      })
    );
    
    setAddingSubtaskForId(null);
    setNewSubtaskText('');
  };
  
  const handleCancelAddSubtask = () => {
    setAddingSubtaskForId(null);
    setNewSubtaskText('');
  };
  
  const handleDeleteSubtask = (todoId: number, subtaskId: number) => {
    setTodos(prevTodos => 
      prevTodos.map(todo => {
        if (todo.id === todoId) {
          return {
            ...todo,
            subtasks: todo.subtasks.filter(subtask => subtask.id !== subtaskId)
          };
        }
        return todo;
      })
    );
  };
  
  const handleToggleSubtask = (todoId: number, subtaskId: number) => {
    console.log(`Toggling subtask ${subtaskId} in todo ${todoId}`);
    
    setTodos(currentTodos => {
      const updatedTodos = currentTodos.map(todo => {
        if (todo.id === todoId) {
          // Found the parent todo
          const updatedSubtasks = todo.subtasks.map(subtask => {
            if (subtask.id === subtaskId) {
              // Toggle the completed status of this subtask
              const newCompletedStatus = !subtask.completed;
              
              // If marking as completed, set completedDate and hidden=true
              // If marking as not completed, remove completedDate and hidden=false
              return {
                ...subtask,
                completed: newCompletedStatus,
                completedDate: newCompletedStatus ? new Date() : null,
                hidden: newCompletedStatus // Set hidden based on completion status
              };
            }
            return subtask;
          });
          
          // Check if all subtasks are now completed
          const allSubtasksCompleted = updatedSubtasks.length > 0 && 
                                     updatedSubtasks.every(subtask => subtask.completed);
          
          // If all subtasks are completed, mark the parent as completed too
          if (allSubtasksCompleted && !todo.completed) {
            const completionDate = new Date();
            
            // If todo is now auto-completed because all subtasks are completed,
            // update Firestore if we have a logged-in user
            if (currentUser && todo.firestoreId) {
              const todoToUpdate = {
                ...todo,
                completed: true,
                completedDate: completionDate,
                subtasks: updatedSubtasks
              };
              updateTodo(currentUser.uid, todoToUpdate);
            }
            
            return {
              ...todo,
              completed: true,
              completedDate: completionDate,
              subtasks: updatedSubtasks
            };
          }
          
          // Save this change to Firestore if we have a logged-in user
          if (currentUser && todo.firestoreId) {
            const todoToUpdate = {
              ...todo,
              subtasks: updatedSubtasks
            };
            updateTodo(currentUser.uid, todoToUpdate);
          }
          
          return {
            ...todo,
            subtasks: updatedSubtasks
          };
        }
        return todo;
      });
      
      // Return the updated todos state
      return updatedTodos;
    });
  };
  
  // Add this new effect to watch for completed tasks and move them
  useEffect(() => {
    // Find tasks with all subtasks completed
    const completedTasks = todos.filter(todo => 
      todo.completed && 
      todo.subtasks.length > 0 && 
      todo.subtasks.every(subtask => subtask.completed)
    );
    
    // Move each completed task to the completed tasks list with a delay for smooth animation
    if (completedTasks.length > 0) {
      // Use a timeout for visual transition - add a short delay
      setTimeout(() => {
        completedTasks.forEach(task => {
          console.log(`Moving task ${task.id} to completed tasks because all subtasks are done`);
          
          // First ensure all subtasks have completion dates
          // This is necessary for subtasks that were auto-completed when the parent task was completed
          const updatedTask = {
            ...task,
            subtasks: task.subtasks.map(subtask => {
              // Clone the subtask to avoid reference issues
              const updatedSubtask = { ...subtask };
              
              // If subtask is completed but doesn't have a completedDate, add one
              if (subtask.completed && !subtask.completedDate) {
                updatedSubtask.completedDate = task.completedDate || new Date(); // Use parent's completion date or now
              }
              
              // Ensure due date is preserved
              if (subtask.dueDate) {
                updatedSubtask.dueDate = subtask.dueDate;
              }
              
              return updatedSubtask;
            })
          };
          
          // Remove from active todos
          setTodos(current => current.filter(t => t.id !== task.id));
          
          // Add to completed tasks if not already there
          setCompletedTasks(current => {
            // Make sure it's not already in the completed tasks
            if (!current.some(t => t.id === task.id)) {
              return [updatedTask, ...current];
            }
            return current;
          });
          
          // Update in Firestore if user is logged in
          if (currentUser && task.firestoreId) {
            moveTodoToCompleted(currentUser.uid, updatedTask)
              .catch(err => console.error("Error moving auto-completed task to Firestore:", err));
          }
        });
      }, 500); // Add a 500ms delay for a smooth visual transition
    }
  }, [todos, currentUser, moveTodoToCompleted]);
  
  const handleEditSubtaskSave = () => {
    if (!editingSubtaskId) return;
    
    setTodos(prevTodos => 
      prevTodos.map(todo => {
        if (todo.id === editingSubtaskId.todoId) {
          return {
            ...todo,
            subtasks: todo.subtasks.map(subtask => {
              if (subtask.id === editingSubtaskId.subtaskId) {
                return {
                  ...subtask,
                  text: subtaskText
                };
              }
              return subtask;
            })
          };
        }
        return todo;
      })
    );
    
    setEditingSubtaskId(null);
    setSubtaskText('');
  };
  
  const handleEditSubtaskCancel = () => {
    setEditingSubtaskId(null);
    setSubtaskText('');
  };

  // More calendar-related functions
  const toggleSubtaskCalendar = (e: React.MouseEvent, todoId: number, subtaskId: number) => {
    e.stopPropagation();
    
    if (subtaskCalendarOpen && 
        subtaskCalendarOpen.todoId === todoId && 
        subtaskCalendarOpen.subtaskId === subtaskId) {
      setSubtaskCalendarOpen(null);
    } else {
      setSubtaskCalendarOpen({ todoId, subtaskId });
      setCalendarOpenForTaskId(null);
      setIsNewTaskCalendarOpen(false);
    }
  };
  
  const handleCalendarNavigation = (direction: 'prev' | 'next', calendarType: 'task' | 'newTask' | 'subtask') => {
    const updateDate = (date: Date): Date => {
      const newDate = new Date(date);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    };
    
    switch (calendarType) {
      case 'task':
        setCalendarDate(updateDate(calendarDate));
        break;
      case 'newTask':
        setNewTaskCalendarDate(updateDate(newTaskCalendarDate));
        break;
      case 'subtask':
        setSubtaskCalendarDate(updateDate(subtaskCalendarDate));
        break;
    }
  };
  
  const handleDateSelect = (taskId: number, date: Date) => {
    setTodos(prevTodos => 
      prevTodos.map(todo => {
        if (todo.id === taskId) {
          // Propagate due date to subtasks that don't have their own due date
          const updatedSubtasks = todo.subtasks.map(subtask => {
            // Only update subtasks that don't have a due date
            if (!subtask.dueDate) {
              return {
                ...subtask,
                dueDate: new Date(date.getTime()) // Clone date to avoid reference issues
              };
            }
            return subtask;
          });
          
          return {
            ...todo,
            dueDate: date,
            subtasks: updatedSubtasks
          };
        }
        return todo;
      })
    );
    
    setCalendarOpenForTaskId(null);
  };
  
  const handleNewTaskDateSelect = (date: Date) => {
    setNewTaskDueDate(date);
    setIsNewTaskCalendarOpen(false);
  };
  
  const handleSubtaskDateSelect = (todoId: number, subtaskId: number, date: Date) => {
    setTodos(prevTodos => {
      // First update the subtask date
      const updatedTodos = prevTodos.map(todo => {
        if (todo.id === todoId) {
          return {
            ...todo,
            subtasks: todo.subtasks.map(subtask => {
              if (subtask.id === subtaskId) {
                return { ...subtask, dueDate: date };
              }
              return subtask;
            })
          };
        }
        return todo;
      });
      
      // Now find the updated todo to check its due date
      const updatedTodo = updatedTodos.find(todo => todo.id === todoId);
      if (!updatedTodo) return updatedTodos;
      
      // If the subtask's due date is later than the todo's due date, update the todo's due date
      if (!updatedTodo.dueDate || (updatedTodo.dueDate && date > updatedTodo.dueDate)) {
        return updatedTodos.map(todo => {
          if (todo.id === todoId) {
            return { 
              ...todo, 
              dueDate: new Date(date.getTime())  // Clone the date
            };
          }
          return todo;
        });
      }
      
      return updatedTodos;
    });
    
    setSubtaskCalendarOpen(null);
  };

  // Toggle settings and history drawer
  const toggleSettings = () => {
    setIsSettingsOpen(!isSettingsOpen);
    if (isHistoryDrawerOpen) {
      setIsHistoryDrawerOpen(false);
    }
  };
  
  const toggleHistoryDrawer = () => {
    setIsHistoryDrawerOpen(!isHistoryDrawerOpen);
    if (isSettingsOpen) {
      setIsSettingsOpen(false);
    }
  };
  
  // Function to determine completion status (on time or late)
  const getCompletionStatus = (completedDate: Date, dueDate: Date) => {
    if (!completedDate || !dueDate) {
      return { status: '', label: '' };
    }
    
    // Remove time component for comparison
    const completedDay = new Date(completedDate);
    completedDay.setHours(0, 0, 0, 0);
    
    const dueDay = new Date(dueDate);
    dueDay.setHours(0, 0, 0, 0);
    
    if (completedDay <= dueDay) {
      return { status: 'on-time', label: 'Completed on time' };
    } else {
      return { status: 'late', label: 'Completed late' };
    }
  };

  // Function to reset all swipe states
  const resetSwipeStates = useCallback(() => {
    setSwipedTaskId(null);
    setSwipedSubtaskInfo(null);
  }, []);
  
  // Add click listener to reset swipe states when clicking outside
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      // Check if the click was outside a swipeable item
      const target = e.target as Element;
      if (!target.closest('.swipeable-item') && !target.closest('.swipe-action')) {
        resetSwipeStates();
      }
    };
    
    document.addEventListener('click', handleDocumentClick);
    
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [resetSwipeStates]);
  
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
  
  // Load theme preference from localStorage on initial render
  useEffect(() => {
    const savedTitle = localStorage.getItem('appTitle');
    const savedTheme = localStorage.getItem('theme') as ThemeType;
    
    if (savedTitle) {
      setAppTitle(savedTitle);
    }
    
    if (savedTheme) {
      setCurrentTheme(savedTheme);
      if (savedTheme === 'surprise') {
        generateSurpriseTheme();
      }
    } else {
      setCurrentTheme('mondrian'); // Set Mondrian as default if no theme is saved
    }
  }, []);

  // Add this ref near the top of your component, with other useState and useRef declarations
  const dataLoadedRef = useRef(false);

  // Find and replace the useEffect hook that loads user data (around line 817)
  // Replace this useEffect:
  useEffect(() => {
    // Only load data if we have a user and haven't loaded data for this user yet
    if (!currentUser || dataLoadedRef.current) {
      return;
    }
    
    console.log("Starting to load user data for:", currentUser.uid);
    setIsAppLoading(true);
    dataLoadedRef.current = true;
    
    const loadUserData = async () => {
      try {
        console.log("Fetching active todos from Firestore...");
        // Load active todos from Firestore
        const userTodos = await getTodos(currentUser.uid);
        console.log("Fetched active todos:", userTodos.length);
        
        // Check for duplicate IDs before setting the state
        const uniqueTodos = removeDuplicateTodos(userTodos);
        if (uniqueTodos.length !== userTodos.length) {
          console.log(`Removed ${userTodos.length - uniqueTodos.length} duplicate todos`);
        }
        
        // Ensure all completed subtasks are marked as hidden
        const processedTodos = uniqueTodos.map((todo: Todo) => {
          return {
            ...todo,
            subtasks: todo.subtasks.map((subtask: Subtask) => ({
              ...subtask,
              // Explicitly set hidden to true for completed subtasks
              hidden: subtask.completed ? true : !!subtask.hidden
            }))
          };
        });
        
        setTodos(processedTodos);
        setPreviewTodos(processedTodos);
        
        console.log("Fetching completed todos from Firestore...");
        // Load completed todos from Firestore
        const userCompletedTodos = await getCompletedTodos(currentUser.uid);
        console.log("Fetched completed todos:", userCompletedTodos.length);
        
        // Check for duplicate IDs in completed todos as well
        const uniqueCompletedTodos = removeDuplicateTodos(userCompletedTodos);
        if (uniqueCompletedTodos.length !== userCompletedTodos.length) {
          console.log(`Removed ${userCompletedTodos.length - uniqueCompletedTodos.length} duplicate completed todos`);
        }
        
        setCompletedTasks(uniqueCompletedTodos);
        
        console.log("Successfully loaded all todos from Firestore");
      } catch (error) {
        console.error("Error loading todos from Firestore:", error);
        dataLoadedRef.current = false; // Reset so we can try again
        
        // Fallback to localStorage if Firestore fails
        loadFromLocalStorage();
      } finally {
        setIsAppLoading(false);
      }
    };
    
    loadUserData();
    
    // Reset dataLoaded flag when user changes
    return () => {
      console.log("Cleanup: User changed, resetting data loaded flag");
      dataLoadedRef.current = false;
    };
  }, [currentUser]);

  // Helper function to remove duplicate todos
  const removeDuplicateTodos = (todos: Todo[]): Todo[] => {
    const idMap = new Map<number, Todo>();
    const firestoreIdMap = new Map<string, Todo>();
    
    // First pass: collect by ID
    todos.forEach(todo => {
      // Use the most recent version of a todo with the same ID
      // or the one with a firestoreId if available
      const existingTodo = idMap.get(todo.id);
      if (!existingTodo || (todo.firestoreId && !existingTodo.firestoreId)) {
        idMap.set(todo.id, todo);
      }
      
      // Also track by firestoreId if available
      if (todo.firestoreId) {
        firestoreIdMap.set(todo.firestoreId, todo);
      }
    });
    
    // Return unique todos, prioritizing ones with firestoreId
    return Array.from(idMap.values());
  };

  // Helper function to load from localStorage as fallback
  const loadFromLocalStorage = () => {
    try {
      const savedTodos = localStorage.getItem('todos');
      const savedCompletedTasks = localStorage.getItem('completedTasks');
      
      if (savedTodos) {
        const parsedTodos = JSON.parse(savedTodos);
        
        // Ensure all completed subtasks are marked as hidden
        const todosWithProperHiddenState = parsedTodos.map((todo: Todo) => {
          return {
            ...todo,
            subtasks: todo.subtasks.map((subtask: Subtask) => ({
              ...subtask,
              // Explicitly set hidden to true for completed subtasks
              hidden: subtask.completed ? true : !!subtask.hidden
            }))
          };
        });

        setTodos(todosWithProperHiddenState);
      }
      
      if (savedCompletedTasks) {
        setCompletedTasks(JSON.parse(savedCompletedTasks));
      }
    } catch (error) {
      console.error('Error loading data from localStorage:', error);
    }
  };

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

  // Add this ref near your other refs at the top of the component
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Replace the useEffect for saving todos to Firestore (around line 940-980)
  useEffect(() => {
    // Always save to localStorage immediately
    localStorage.setItem('todos', JSON.stringify(todos));
    
    // Debounce the Firestore save operations
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Only save to Firestore if user is logged in and we have todos
    if (currentUser && todos.length > 0) {
      console.log("Scheduling debounced save to Firestore...");
      saveTimeoutRef.current = setTimeout(async () => {
        console.log("Executing debounced save to Firestore");
        try {
          let updateCount = 0;
          
          // Keep track of todos we've already processed to avoid duplicates
          const processedIds = new Set<number>();
          
          // For each todo, save to Firestore
          for (const todo of todos) {
            // Skip if we've already processed this ID
            if (processedIds.has(todo.id)) {
              console.log(`Skipping duplicate todo with id ${todo.id}`);
              continue;
            }
            
            processedIds.add(todo.id);
            
            // If todo has a firestoreId, update it; otherwise add it
            if (todo.firestoreId) {
              await updateTodo(currentUser.uid, todo);
              updateCount++;
            } else {
              const newId = await addTodo(currentUser.uid, todo);
              updateCount++;
              // Update local state with the new Firestore ID
              if (newId) {
                setTodos(prevTodos => 
                  prevTodos.map(t => 
                    t.id === todo.id ? { ...t, firestoreId: newId } : t
                  )
                );
              }
            }
          }
          console.log(`Successfully saved ${updateCount} todos to Firestore`);
        } catch (error) {
          console.error("Error saving todos to Firestore:", error);
        }
      }, 2000); // 2-second debounce
    }
    
    // Clean up on unmount or when dependencies change
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [todos, currentUser]);

  // Add this ref near your other refs at the top of the component
  const saveCompletedTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Replace the useEffect for saving completed tasks to Firestore (around line 985-1010)
  useEffect(() => {
    // Always save to localStorage immediately
    localStorage.setItem('completedTasks', JSON.stringify(completedTasks));
    
    // Debounce the Firestore save operations
    if (saveCompletedTimeoutRef.current) {
      clearTimeout(saveCompletedTimeoutRef.current);
    }
    
    // Only save to Firestore if user is logged in and we have completed tasks
    if (currentUser && completedTasks.length > 0) {
      console.log("Scheduling debounced save of completed tasks to Firestore...");
      saveCompletedTimeoutRef.current = setTimeout(async () => {
        console.log("Executing debounced save of completed tasks to Firestore");
        try {
          let updateCount = 0;
          for (const task of completedTasks) {
            // For completed tasks that don't have a firestoreId yet
            if (!task.firestoreId) {
              // We need to add it to Firestore completed collection
              await moveTodoToCompleted(currentUser.uid, task);
              updateCount++;
            }
          }
          console.log(`Successfully saved ${updateCount} completed tasks to Firestore`);
        } catch (error) {
          console.error("Error saving completed tasks to Firestore:", error);
        }
      }, 2000); // 2-second debounce
    }
    
    // Clean up on unmount or when dependencies change
    return () => {
      if (saveCompletedTimeoutRef.current) {
        clearTimeout(saveCompletedTimeoutRef.current);
      }
    };
  }, [completedTasks, currentUser]);

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

  const handleAddTodo = async () => {
    if (inputValue.trim() === '') return;
    
    // Check if a todo with the same text already exists
    const duplicateTodo = todos.find(todo => 
      todo.text.toLowerCase() === inputValue.trim().toLowerCase()
    );
    
    if (duplicateTodo) {
      console.log(`Todo with text "${inputValue}" already exists, not adding duplicate`);
      // Optionally, you could notify the user here
      // For now, just clear the input and return
      setInputValue('');
      setNewTaskDueDate(null);
      setIsNewTaskCalendarOpen(false);
      return;
    }
    
    const newTodo: Todo = {
      id: Math.max(0, ...todos.map(todo => todo.id)) + 1,
      text: inputValue,
      completed: false,
      dueDate: newTaskDueDate,
      completedDate: null,
      subtasks: [],
      isExpanded: false,
      firestoreId: '' // Initialize empty firestoreId
    };
    
    // Add to local state first for immediate UI update
    setTodos(prevTodos => [...prevTodos, newTodo]);
    
    // Then add to Firestore if user is logged in
    if (currentUser) {
      try {
        const newId = await addTodo(currentUser.uid, newTodo);
        if (newId) {
          // Update the todo with the Firestore ID
          setTodos(prevTodos => 
            prevTodos.map(todo => 
              todo.id === newTodo.id ? { ...todo, firestoreId: newId } : todo
            )
          );
        }
      } catch (error) {
        console.error("Error adding todo to Firestore:", error);
      }
    }
    
    // Reset input and due date
    setInputValue('');
    setNewTaskDueDate(null);
    setIsNewTaskCalendarOpen(false);
  };

  const handleToggleTodo = async (id: number) => {
    const todoToToggle = todos.find(todo => todo.id === id);
    
    if (!todoToToggle) return;
    
    if (!todoToToggle.completed) {
      // Current date to use for all completion timestamps
      const completionDate = new Date();
      
      // Mark as completed and ensure all subtasks are completed with dates
      const updatedTodo = {
        ...todoToToggle,
        completed: true,
        completedDate: completionDate,
        // Update all subtasks to be completed with the same date if not already completed
        subtasks: todoToToggle.subtasks.map(subtask => {
          // If subtask is not completed, mark it as completed
          if (!subtask.completed) {
            return {
              ...subtask,
              completed: true,
              completedDate: completionDate, // Use the same completion date as the parent
              hidden: true,
              // Make sure to preserve the due date
              dueDate: subtask.dueDate
            };
          }
          // If subtask is already completed but doesn't have a completion date, add one
          else if (subtask.completed && !subtask.completedDate) {
            return {
              ...subtask,
              completedDate: completionDate, // Use the same completion date as the parent
              // Make sure to preserve the due date
              dueDate: subtask.dueDate
            };
          }
          // Otherwise leave it as is
          return subtask;
        })
      };
      
      // Remove from active todos and add to completed
      setTodos(prevTodos => prevTodos.filter(todo => todo.id !== id));
      setCompletedTasks(prevCompletedTasks => [updatedTodo, ...prevCompletedTasks]);
      
      // Update in Firestore
      if (currentUser && todoToToggle.firestoreId) {
        await moveTodoToCompleted(currentUser.uid, updatedTodo);
      }
    } else {
      // This case is likely not needed but included for consistency
      const updatedTodo = {
        ...todoToToggle,
        completed: false,
        completedDate: null
      };
      
      setTodos(prevTodos => prevTodos.map(todo => 
        todo.id === id ? updatedTodo : todo
      ));
      
      // Update in Firestore
      if (currentUser && todoToToggle.firestoreId) {
        await updateTodo(currentUser.uid, updatedTodo);
      }
    }
  };

  const handleDeleteTodo = async (id: number) => {
    // Find the todo to be deleted
    const todoToDelete = todos.find(todo => todo.id === id);
    if (!todoToDelete) return;
    
    // Remove from local state
    setTodos(prevTodos => prevTodos.filter(todo => todo.id !== id));
    
    // Delete from Firestore if user is logged in and todo has a firestoreId
    if (currentUser && todoToDelete.firestoreId) {
      try {
        await deleteTodo(currentUser.uid, todoToDelete.firestoreId);
      } catch (error) {
        console.error("Error deleting todo from Firestore:", error);
      }
    }
  };
  
  // New handlers for editing tasks
  const handleEditStart = (id: number, text: string) => {
    setEditingTaskId(id);
    setEditText(text);
  }; // End handleEditStart function properly

  // Function to restore a task from completed to active
  const handleRestoreTask = (taskId: number) => {
    // Find the task to restore in completed tasks
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
          notes: task.notes || undefined,
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
          notes: completedTask.notes || undefined,
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
            notes: subtask.notes || undefined,
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
            notes: subtask.notes || undefined,
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
              // If the subtask already has a date later than the new parent date,
              // keep it below the parent's due date
              if (editingDetails.dueDate && subtask.dueDate && subtask.dueDate > editingDetails.dueDate) {
                // Clone the date to avoid reference issues
                return { ...subtask, dueDate: new Date(editingDetails.dueDate.getTime()) };
              }
              // If the subtask doesn't have a due date and the parent task now has one,
              // propagate the due date to the subtask
              else if (editingDetails.dueDate && !subtask.dueDate) {
                return { ...subtask, dueDate: new Date(editingDetails.dueDate.getTime()) };
              }
              return subtask;
            });
            
            return { 
              ...todo, 
              text: editingDetails.title,
              notes: editingDetails.notes === '' ? undefined : editingDetails.notes,
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
                // If the subtask already has a date later than the new parent date,
                // keep it below the parent's due date
                if (editingDetails.dueDate && subtask.dueDate && subtask.dueDate > editingDetails.dueDate) {
                  // Clone the date to avoid reference issues
                  return { ...subtask, dueDate: new Date(editingDetails.dueDate.getTime()) };
                }
                // If the subtask doesn't have a due date and the parent task now has one,
                // propagate the due date to the subtask
                else if (editingDetails.dueDate && !subtask.dueDate) {
                  return { ...subtask, dueDate: new Date(editingDetails.dueDate.getTime()) };
                }
                return subtask;
              });
              
              return { 
                ...todo, 
                text: editingDetails.title,
                notes: editingDetails.notes === '' ? undefined : editingDetails.notes,
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
                  notes: editingDetails.notes === '' ? undefined : editingDetails.notes,
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
                    notes: editingDetails.notes === '' ? undefined : editingDetails.notes,
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

  // Function to show Coming Soon modal
  const showComingSoon = (theme: string) => {
    setComingSoonTheme(theme);
    setShowComingSoonModal(true);
    // Auto-hide after 3 seconds
    setTimeout(() => {
      setShowComingSoonModal(false);
    }, 3000);
  };

  // Add Firebase auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("Auth state changed, user:", user);
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // User is signed out, the authState useEffect will update state
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // If still loading auth state, show a loading indicator
  if (authLoading) {
    return (
      <div className="App">
        <header className="App-header">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading...</p>
          </div>
        </header>
      </div>
    );
  }

  // If not authenticated, show login screen
  if (!currentUser) {
    return (
      <div className="App">
        <header className="App-header">
          <Login onLogin={() => {
            console.log("Login successful, refreshing app state");
            // Force a refresh of the current user from Firebase
            const user = auth.currentUser;
            if (user) {
              setCurrentUser(user);
            } else {
              console.warn("Login succeeded but no current user found");
            }
          }} />
        </header>
      </div>
    );
  }
  
  // Handle network status changes
  const handleNetworkStatusChange = (online: boolean) => {
    console.log(`Network status changed to: ${online ? 'online' : 'offline'}`);
    setIsOnline(online);
    
    // If coming back online, refresh data
    if (online && currentUser) {
      console.log('Refreshing data after reconnection');
      // You might want to reload your todos here or perform other refresh actions
    }
  };

  // Show loading indicator when fetching user todos from Firestore
  if (isAppLoading) {
    return (
      <div className="App">
        <header className="App-header">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading your todos...</p>
          </div>
        </header>
      </div>
    );
  }

  // Main app render for authenticated users
  return (
    <AuthProvider>
      {/* Include the NetworkStatus component at the top */}
      <NetworkStatus onStatusChange={handleNetworkStatusChange} />
      
      <div className={`App ${currentTheme || 'default'}`}>
        {currentTheme === 'vangogh' && (
          <>
            <div className="sky-layer"></div>
            <div className="landscape-layer"></div>
            <div className="stars-layer"></div>
          </>
        )}
        
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
                {currentTheme === 'mondrian' ? (
                  <>
                    <span>Hooray, you've completed all tasks.</span>
                    <div className="mondrian-completion-block red"></div>
                    <div className="mondrian-completion-block blue"></div>
                    <div className="mondrian-completion-block yellow"></div>
                  </>
                ) : (
                  <span>🎉 Hooray, you've completed all tasks! 🎉</span>
                )}
              </div>
            )}
            <ul ref={todoListRef} className="todo-list">
              {/* Use the preview todos for rendering during drag operations */}
              {previewTodos.map((todo) => (
                <SwipeableTask
                  key={todo.id}
                  data-id={todo.id}
                  className={`${todo.completed ? 'completed' : ''} ${draggedTaskId === todo.id ? 'dragging' : ''} ${dragOverTaskId === todo.id ? 'drag-over' : ''}`}
                  draggable={true}
                  onDragStart={(e: React.DragEvent<HTMLLIElement>) => handleDragStart(e, todo.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e: React.DragEvent<HTMLLIElement>) => handleDragOver(e, todo.id)}
                  onDragEnter={(e: React.DragEvent<HTMLLIElement>) => handleDragOver(e, todo.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e: React.DragEvent<HTMLLIElement>) => handleDrop(e, todo.id)}
                  todo={todo}
                  onDelete={handleDeleteTodo}
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
                              title="Click to edit task details and set due date"
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
                  
                  {/* Only show subtasks container if there are VISIBLE subtasks or we're adding one */}
                  {((todo.isExpanded && todo.subtasks.some(subtask => !subtask.hidden)) || addingSubtaskForId === todo.id) && (
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
                      
                      {todo.subtasks.some(subtask => !subtask.hidden) && (
                        <ul className="subtasks-list">
                          {/* Sort subtasks by due date before rendering */}
                          {(sortByDueDate([...todo.subtasks]) as Subtask[])
                            // Only show non-hidden subtasks in the main UI
                            .filter((subtask: Subtask) => {
                              // Check if the subtask is hidden
                              return !subtask.hidden;
                            })
                            .map((subtask: Subtask) => (
                              <SwipeableSubtask
                                key={subtask.id}
                                className={`subtask-item ${subtask.completed ? 'completed' : ''}`}
                                todoId={todo.id}
                                subtask={subtask}
                                onDelete={handleDeleteSubtask}
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
                                            title="Click to edit subtask details and set due date"
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
                                  
                                  {/* Subtask actions */}
                                  <div className="subtask-actions">
                                    <button
                                      type="button"
                                      className="delete-subtask-btn"
                                      onClick={(e) => handleDeleteSubtask(todo.id, subtask.id)}
                                      aria-label="Delete subtask"
                                    >
                                      ×
                                    </button>
                                  </div>
                                </div>
                              </SwipeableSubtask>
                            ))}
                        </ul>
                      )}
                    </div>
                  )}
                </SwipeableTask>
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
                      {calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
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
                        const year = calendarDate.getFullYear();
                        const month = calendarDate.getMonth();
                        
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
          <div className="settings-menu open">
            <div className="settings-header">
              <h3>Settings</h3>
              <button className="close-settings-btn" onClick={toggleSettings}>×</button>
            </div>
            <div className="settings-content">
              <div className="theme-section">
                <h4>Theme</h4>
                <div className="theme-options">
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
                    className={`theme-option ${currentTheme === 'default' ? 'selected' : ''}`}
                    onClick={() => showComingSoon('Zaha Hadid')}
                  >
                    <div className="theme-preview default-preview">
                      <div className="preview-header"></div>
                      <div className="preview-content">
                        <div className="preview-line"></div>
                        <div className="preview-line"></div>
                      </div>
                    </div>
                    <span>Zaha Hadid</span>
                    <div className="coming-soon-badge">Coming Soon</div>
                  </div>

                  <div 
                    className={`theme-option ${currentTheme === 'vangogh' ? 'selected' : ''}`}
                    onClick={() => showComingSoon('Van Gogh')}
                  >
                    <div className="theme-preview vangogh-preview">
                      <div className="preview-sky"></div>
                      <div className="preview-stars"></div>
                      <div className="preview-hills"></div>
                    </div>
                    <span>Van Gogh</span>
                    <div className="coming-soon-badge">Coming Soon</div>
                  </div>

                  <div 
                    className={`theme-option ${currentTheme === 'lecorbusier' ? 'selected' : ''}`}
                    onClick={() => showComingSoon('Le Corbusier')}
                  >
                    <div className="theme-preview lecorbusier-preview">
                      <div className="preview-grid">
                        <div className="preview-block"></div>
                        <div className="preview-block accent"></div>
                        <div className="preview-block primary"></div>
                      </div>
                    </div>
                    <span>Le Corbusier</span>
                    <div className="coming-soon-badge">Coming Soon</div>
                  </div>

                  <div 
                    className={`theme-option ${currentTheme === 'surprise' ? 'selected' : ''}`}
                    onClick={() => showComingSoon('Surprise Me')}
                  >
                    <div className="theme-preview surprise-preview">
                      <div className="preview-random">
                        <div className="preview-sparkle"></div>
                        <div className="preview-sparkle"></div>
                        <div className="preview-sparkle"></div>
                      </div>
                    </div>
                    <span>Surprise Me!</span>
                    <div className="coming-soon-badge">Coming Soon</div>
                  </div>
                </div>
              </div>
              
              <div className="account-section">
                <h4>Account</h4>
                <div className="account-options">
                  <button 
                    className="logout-button-settings" 
                    onClick={handleLogout}
                    title="Logout from your account"
                  >
                    <span className="logout-icon">📤</span>
                    <span>Logout</span>
                  </button>
                  {currentUser && (
                    <div className="current-user">
                      <span className="user-email">Logged in as: {currentUser.email}</span>
                    </div>
                  )}
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
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" clipRule="evenodd" d="M13.7870 3.8051C13.3323 1.93163 10.6677 1.93163 10.2130 3.8051C9.91913 5.01539 8.61052 5.78973 7.47451 5.15811C5.82053 4.20621 4.00621 6.02053 4.95811 7.67451C5.58973 8.81052 4.81539 10.1191 3.60511 10.413C1.73163 10.8677 1.73163 13.5323 3.60511 13.987C4.81539 14.2809 5.58973 15.5895 4.95811 16.7255C4.00621 18.3795 5.82053 20.1938 7.47451 19.2419C8.61052 18.6103 9.91913 19.3846 10.2130 20.5949C10.6677 22.4684 13.3323 22.4684 13.7870 20.5949C14.0809 19.3846 15.3895 18.6103 16.5255 19.2419C18.1795 20.1938 19.9938 18.3795 19.0419 16.7255C18.4103 15.5895 19.1846 14.2809 20.3949 13.987C22.2684 13.5323 22.2684 10.8677 20.3949 10.413C19.1846 10.1191 18.4103 8.81052 19.0419 7.67451C19.9938 6.02053 18.1795 4.20621 16.5255 5.15811C15.3895 5.78973 14.0809 5.01539 13.7870 3.8051ZM12 15.6C13.9882 15.6 15.6 13.9882 15.6 12C15.6 10.0118 13.9882 8.4 12 8.4C10.0118 8.4 8.4 10.0118 8.4 12C8.4 13.9882 10.0118 15.6 12 15.6Z" fill="currentColor"/>
          </svg>
        </button>
        
        {/* History Icon */}
        <button 
          className="history-icon"
          onClick={toggleHistoryDrawer}
          title="Task History"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2.5" />
            <path d="M12 7V12L15.5 15.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
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
                      .map(task => {
                        // Highlight tasks with specific keywords or conditions
                        const shouldHighlight = task.text.toLowerCase().includes('buseta');
                        // Create a new task object with the highlight property
                        const taskWithHighlight = { ...task, highlight: shouldHighlight };
                        
                        return (
                          <div key={task.id} className={`history-item ${taskWithHighlight.highlight ? 'highlighted' : ''}`}>
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
                                      <span role="img" aria-label="completed">✓</span> {formatDate(task.completedDate)}
                                    </span>
                                  )}
                                  {task.dueDate && (
                                    <span className="history-due-date">
                                      <span role="img" aria-label="due">📅</span> {formatDate(task.dueDate)}
                                    </span>
                                  )}
                                  {task.completedDate && task.dueDate && (
                                    <span className={`completion-status ${getCompletionStatus(task.completedDate, task.dueDate).status}`}>
                                      {getCompletionStatus(task.completedDate, task.dueDate).status === 'late' ? 
                                        <span role="img" aria-label="late">⚠️</span> : 
                                        <span role="img" aria-label="on-time">👍</span>
                                      } {getCompletionStatus(task.completedDate, task.dueDate).label}
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
                                        {/* Display the completion date - either the subtask's own date or inherit from parent */}
                                        <span className="history-subtask-done-date">
                                          <span role="img" aria-label="completed">✓</span> {formatDate(subtask.completedDate || task.completedDate)}
                                        </span>
                                        
                                        {/* Always display the due date if it exists */}
                                        {subtask.dueDate && (
                                          <span className="history-subtask-due-date">
                                            <span role="img" aria-label="due">📅</span> {formatDate(subtask.dueDate)}
                                          </span>
                                        )}
                                        
                                        {/* Show completion status if subtask has a due date */}
                                        {subtask.dueDate && (
                                          <span className={`completion-status ${getCompletionStatus(
                                            subtask.completedDate || task.completedDate || new Date(), // Use parent's date as fallback
                                            subtask.dueDate
                                          ).status}`}>
                                            {getCompletionStatus(
                                              subtask.completedDate || task.completedDate || new Date(), 
                                              subtask.dueDate
                                            ).status === 'late' ? 
                                              <span role="img" aria-label="late">⚠️</span> : 
                                              <span role="img" aria-label="on-time">👍</span>
                                            } {getCompletionStatus(
                                              subtask.completedDate || task.completedDate || new Date(), 
                                              subtask.dueDate
                                            ).label}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    }
                  </div>
                )}
              </div>
              
              {/* Section for completed subtasks in active tasks */}
              {(() => {
                // Find all active tasks with completed subtasks (including hidden ones)
                const activeTasks = todos.filter(todo => !todo.completed);
                const tasksWithCompletedSubtasks = activeTasks.filter(task => 
                  task.subtasks.some(subtask => subtask.completed)
                );
                
                if (tasksWithCompletedSubtasks.length > 0) {
                  return (
                    <div className="history-section">
                      <h4 className="history-section-title">COMPLETED SUBTASKS IN ACTIVE TASKS</h4>
                      
                      {tasksWithCompletedSubtasks.map(task => {
                        // Filter completed subtasks in the selected time period, include hidden ones
                        const filteredCompletedSubtasks = task.subtasks.filter(subtask => {
                          if (!subtask.completed) return false;
                          
                          const filterDate = getFilterDate();
                          
                          // For custom range, check if the date is within the range
                          if (historyTimeFilter === 'custom' && customDateRange.end) {
                            // Set end of day for end date to include the entire day
                            const endDate = new Date(customDateRange.end);
                            endDate.setHours(23, 59, 59, 999);
                            // Use completion date if available, otherwise don't filter by date
                            return !subtask.completedDate || 
                                  (subtask.completedDate >= filterDate && subtask.completedDate <= endDate);
                          }
                          
                          // For preset ranges, just check if after filter date or if no completion date
                          return !subtask.completedDate || subtask.completedDate >= filterDate;
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
                                          <span role="img" aria-label="completed">✓</span> {formatDate(subtask.completedDate)}
                                        </span>
                                      )}
                                      {subtask.dueDate && (
                                        <span className="history-subtask-due-date">
                                          <span role="img" aria-label="due">📅</span> {formatDate(subtask.dueDate)}
                                        </span>
                                      )}
                                      {subtask.completedDate && subtask.dueDate && (
                                        <span className={`completion-status ${getCompletionStatus(subtask.completedDate, subtask.dueDate).status}`}>
                                          {getCompletionStatus(subtask.completedDate, subtask.dueDate).status === 'late' ? 
                                            <span role="img" aria-label="late">⚠️</span> : 
                                            <span role="img" aria-label="on-time">👍</span>
                                          } {getCompletionStatus(subtask.completedDate, subtask.dueDate).label}
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
                <label htmlFor="details-due-date-input">Due Date:</label>
                <div id="details-due-date-input" className="details-due-date" role="group">
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
                        setCalendarDate(new Date());
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
                          const newDate = new Date(calendarDate);
                          newDate.setMonth(newDate.getMonth() - 1);
                          setCalendarDate(newDate);
                        }}
                      >
                        &lt;
                      </button>
                      <div className="month-label">
                        {calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                      </div>
                      <button
                        className="month-nav"
                        onClick={() => {
                          const newDate = new Date(calendarDate);
                          newDate.setMonth(newDate.getMonth() + 1);
                          setCalendarDate(newDate);
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
                        const year = calendarDate.getFullYear();
                        const month = calendarDate.getMonth();
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
        
        {/* Coming Soon Modal */}
        {showComingSoonModal && (
          <div className="coming-soon-modal-overlay" onClick={() => setShowComingSoonModal(false)}>
            <div className="coming-soon-modal" onClick={e => e.stopPropagation()}>
              <div className="coming-soon-modal-content">
                <div className="coming-soon-icon">🚧</div>
                <h3>{comingSoonTheme} Theme</h3>
                <p>We're working on something amazing! This theme will be available soon.</p>
                <button className="coming-soon-close-btn" onClick={() => setShowComingSoonModal(false)}>Got it!</button>
              </div>
            </div>
          </div>
        )}
        
        {/* Debug component - will only show during development */}
        {process.env.NODE_ENV === 'development' && (
          <div style={{ 
            position: 'fixed', 
            bottom: '10px', 
            right: '10px', 
            background: 'rgba(0,0,0,0.7)', 
            color: 'white', 
            padding: '5px', 
            borderRadius: '5px',
            fontSize: '10px',
            zIndex: 9999,
            display: "block"  // Hidden by default, change to 'block' to see detection status
          }}>
            Mobile: {isMobile() ? 'Yes' : 'No'}
          </div>
        )}
      </div>
    </AuthProvider>
  );
}

export default App;
