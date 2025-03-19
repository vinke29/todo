import React, { useState, useRef, useEffect, createRef } from 'react';
import './App.css';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
  dueDate: Date | null;
}

function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverTaskId, setDragOverTaskId] = useState<number | null>(null);
  const [isDropEndZone, setIsDropEndZone] = useState(false);
  // IMPORTANT: This is the list we'll show during dragging - a visual preview
  const [previewTodos, setPreviewTodos] = useState<Todo[]>([]);
  // Add state for tracking which task is being edited
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const endDropZoneRef = useRef<HTMLDivElement>(null);
  const todoListRef = useRef<HTMLUListElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  
  // Store mouse position data to enhance drop detection
  const mousePositionRef = useRef({ x: 0, y: 0 });
  
  // Track if we're in an active drop operation to reduce flickering
  const isActiveDropTargetRef = useRef(false);
  
  // Filter only active todos
  const activeTodos = todos.filter(todo => !todo.completed);
  
  // Add state for tracking which task has an open calendar
  const [calendarOpenForId, setCalendarOpenForId] = useState<number | null>(null);
  
  // Load todos from localStorage on initial render
  useEffect(() => {
    const savedTodos = localStorage.getItem('todos');
    if (savedTodos) {
      try {
        setTodos(JSON.parse(savedTodos));
      } catch (e) {
        console.error('Failed to parse saved todos');
      }
    }
  }, []);

  // Save todos to localStorage when they change
  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos));
  }, [todos]);
  
  // Focus the edit input when entering edit mode
  useEffect(() => {
    if (editingTaskId !== null && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingTaskId]);

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
  }, [isDragging, draggedTaskId, dragOverTaskId, isDropEndZone, todos]);

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
        dueDate: null
      };
      setTodos([...todos, newTodo]);
      setInputValue('');
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

  return (
    <div className="App">
      <header className="App-header">
        <h1>Simple Todo App</h1>
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
          <button onClick={handleAddTodo}>Add</button>
        </div>
        
        <div className="todo-container">
          <ul ref={todoListRef} className="todo-list">
            {/* Use the preview todos for rendering during drag operations */}
            {previewTodos.map(todo => (
              <li 
                key={todo.id}
                data-id={todo.id}
                draggable={editingTaskId !== todo.id}
                onDragStart={(e) => handleDragStart(e, todo.id)}
                onDragOver={(e) => handleDragOver(e, todo.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, todo.id)}
                onDragEnd={handleDragEnd}
                className={`
                  ${draggedTaskId === todo.id ? 'dragging' : ''} 
                  ${dragOverTaskId === todo.id ? 'drag-over' : ''}
                  ${editingTaskId === todo.id ? 'editing' : ''}
                  preview-item
                `}
              >
                <div className="todo-item">
                  <button 
                    className={`checkbox ${todo.completed ? 'checked' : ''}`}
                    onClick={() => handleToggleTodo(todo.id)}
                    aria-label="Mark as complete"
                    disabled={editingTaskId === todo.id}
                  >
                    {todo.completed && '✓'}
                  </button>
                  
                  {editingTaskId === todo.id ? (
                    <input
                      ref={editInputRef}
                      type="text"
                      className="edit-input"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onBlur={handleEditSave}
                      onKeyDown={handleEditKeyDown}
                    />
                  ) : (
                    <div className="todo-text-container">
                      <span className="todo-text">
                        {todo.text}
                      </span>
                      
                      {todo.dueDate && (
                        <div className="todo-due-date">
                          {formatDate(todo.dueDate)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="todo-actions">
                  <button 
                    className="edit-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditStart(todo.id, todo.text);
                    }}
                    aria-label="Edit task"
                    disabled={editingTaskId === todo.id}
                  >
                    ✎
                  </button>
                  
                  <button 
                    className="calendar-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCalendar(e, todo.id);
                    }}
                    aria-label="Select due date"
                    disabled={editingTaskId === todo.id}
                  >
                    📅
                  </button>
                </div>
                <button 
                  className="delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTodo(todo.id);
                  }}
                  disabled={editingTaskId === todo.id}
                >
                  Delete
                </button>
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
          
          {previewTodos.length === 0 && (
            <div className="empty-state">
              <p>No active tasks! Add a new task to get started.</p>
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
    </div>
  );
}

export default App;
