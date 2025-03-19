import React, { useState, useRef, useEffect, createRef } from 'react';
import './App.css';

interface Subtask {
  id: number;
  text: string;
  completed: boolean;
  dueDate: Date | null;
}

interface Todo {
  id: number;
  text: string;
  completed: boolean;
  dueDate: Date | null;
  subtasks: Subtask[];
  isExpanded: boolean; // Track if subtasks are expanded/visible
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
  
  // For app title editing
  const [appTitle, setAppTitle] = useState('Your to-dos');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isTitleHovered, setIsTitleHovered] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  
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

  // Load title from localStorage on initial render
  useEffect(() => {
    const savedTodos = localStorage.getItem('todos');
    const savedTitle = localStorage.getItem('appTitle');
    
    if (savedTitle) {
      setAppTitle(savedTitle);
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
  }, []);

  // Save todos and title to localStorage when they change
  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos));
  }, [todos]);
  
  useEffect(() => {
    localStorage.setItem('appTitle', appTitle);
  }, [appTitle]);

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
        text: inputValue,
        completed: false,
        dueDate: newTaskDueDate,
        subtasks: [],
        isExpanded: false
      };
      setTodos([...todos, newTodo]);
      setInputValue('');
      // Reset the new task due date after adding
      setNewTaskDueDate(null);
    }
  };

  const handleToggleTodo = (id: number) => {
    // Mark as completed then remove after a short delay to show the checkmark animation
    setTodos(
      todos.map(todo => 
        todo.id === id ? { ...todo, completed: true } : todo
      )
    );
    
    // Remove the completed task after 800ms (longer for better animation)
    setTimeout(() => {
      setTodos(todos.filter(todo => todo.id !== id));
    }, 800);
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
    
    // Update the todo with the new text
    setTodos(
      todos.map(todo => 
        todo.id === editingTaskId ? { ...todo, text: trimmedText } : todo
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
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };
  
  // Handle date selection for a task
  const handleDateSelect = (id: number, date: Date) => {
    setTodos(
      todos.map(todo => 
        todo.id === id ? { ...todo, dueDate: date } : todo
      )
    );
    
    // Close the calendar
    setCalendarOpenForId(null);
  };
  
  // Toggle calendar visibility for a task
  const toggleCalendar = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setCalendarOpenForId(calendarOpenForId === id ? null : id);
  };

  // Toggle calendar visibility for new task with debouncing
  const toggleNewTaskCalendar = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent double-clicks by debouncing
    if (isCalendarClickPendingRef.current) return;
    
    isCalendarClickPendingRef.current = true;
    console.log('Calendar icon clicked'); // Debug log
    
    // Toggle the calendar visibility
    setIsNewTaskCalendarOpen(!isNewTaskCalendarOpen);
    
    // Close any task calendars if open
    if (calendarOpenForId !== null) {
      setCalendarOpenForId(null);
    }
    
    // Reset the debounce flag after 300ms
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
    const latestSubtaskDate = getLatestSubtaskDate(subtasks);
    
    if (!latestSubtaskDate) return;
    
    setTodos(prevTodos => 
      prevTodos.map(todo => {
        if (todo.id === todoId) {
          // Only update if the task has no due date or if the latest subtask date is later
          if (!todo.dueDate || latestSubtaskDate > todo.dueDate) {
            return { ...todo, dueDate: latestSubtaskDate };
          }
        }
        return todo;
      })
    );
  };

  // Update handleSaveNewSubtask to check dates
  const handleSaveNewSubtask = (todoId: number) => {
    if (newSubtaskText.trim() === '') {
      setAddingSubtaskForId(null);
      return;
    }

    const newSubtask: Subtask = {
      id: Date.now(),
      text: newSubtaskText.trim(),
      completed: false,
      dueDate: null
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
                  ? { ...subtask, text: trimmedText } 
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
    setTodos(
      todos.map(todo => 
        todo.id === todoId 
          ? {
              ...todo,
              subtasks: todo.subtasks.map(subtask => 
                subtask.id === subtaskId 
                  ? { ...subtask, completed: !subtask.completed } 
                  : subtask
              )
            } 
          : todo
      )
    );
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

  // Toggle calendar for subtask
  const toggleSubtaskCalendar = (e: React.MouseEvent, todoId: number, subtaskId: number) => {
    e.stopPropagation();
    
    // Close if the same subtask calendar is already open
    if (calendarOpenForSubtask && 
        calendarOpenForSubtask.todoId === todoId && 
        calendarOpenForSubtask.subtaskId === subtaskId) {
      setCalendarOpenForSubtask(null);
    } else {
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

  // Update handleSubtaskDateSelect to check and update parent task date
  const handleSubtaskDateSelect = (todoId: number, subtaskId: number, date: Date) => {
    setTodos(prevTodos => {
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
        // Always recalculate the latest date from all subtasks
        const latestDate = getLatestSubtaskDate(updatedTodo.subtasks);
        
        // Always update the parent task's due date to match the latest subtask date
        // This ensures if the latest subtask date changes (earlier or later), the parent reflects it
        return updatedTodos.map(todo => 
          todo.id === todoId ? { ...todo, dueDate: latestDate } : todo
        );
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

  return (
    <div className="App">
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
            <h1>
              {appTitle || 'Your to-dos'}
              {isTitleHovered && (
                <span className="title-edit-icon" title="Edit title">
                  ✎
                </span>
              )}
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
        
        {/* Add sort toggle */}
        <div className="sort-options">
          <button 
            className={`sort-toggle ${sortTasksByDueDate ? 'active' : ''}`}
            onClick={() => setSortTasksByDueDate(!sortTasksByDueDate)}
            title={sortTasksByDueDate ? "Disable due date sorting" : "Sort tasks by due date"}
          >
            {sortTasksByDueDate ? "✓ " : ""}Sort by due date
          </button>
        </div>
        
        <div className="todo-container">
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
                          <span className="todo-text">{todo.text}</span>
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
                          className="edit-btn"
                          onClick={() => handleEditStart(todo.id, todo.text)}
                          aria-label="Edit task"
                        >
                          ✎
                        </button>
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
                        {sortByDueDate([...todo.subtasks]).map((subtask) => (
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
                                      <span className="subtask-text">{subtask.text}</span>
                                      {subtask.dueDate && (
                                        <span className="subtask-due-date">Due: {formatDate(subtask.dueDate)}</span>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                              
                              {(!editingSubtaskId || editingSubtaskId.subtaskId !== subtask.id) && (
                                <div className="subtask-actions">
                                  <button
                                    type="button"
                                    className="edit-subtask-btn"
                                    onClick={() => handleEditSubtaskStart(todo.id, subtask.id, subtask.text)}
                                    aria-label="Edit subtask"
                                  >
                                    ✎
                                  </button>
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
                  <div className="month-title">
                    {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </div>
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
                      const today = new Date();
                      const year = today.getFullYear();
                      const month = today.getMonth();
                      
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
                <div className="month-title">
                  {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </div>
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
                    const today = new Date();
                    const year = today.getFullYear();
                    const month = today.getMonth();
                    
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
                      <div className="month-title">
                        {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </div>
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
                          const today = new Date();
                          const year = today.getFullYear();
                          const month = today.getMonth();
                          
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
    </div>
  );
}

export default App;
