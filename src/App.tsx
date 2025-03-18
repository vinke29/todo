import React, { useState, useRef, useEffect } from 'react';
import './App.css';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverTaskId, setDragOverTaskId] = useState<number | null>(null);
  const [isDropEndZone, setIsDropEndZone] = useState(false);
  const endDropZoneRef = useRef<HTMLDivElement>(null);
  const todoListRef = useRef<HTMLUListElement>(null);

  const handleAddTodo = () => {
    if (inputValue.trim() !== '') {
      const newTodo: Todo = {
        id: Date.now(),
        text: inputValue,
        completed: false
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
    
    // Remove the completed task after 500ms
    setTimeout(() => {
      setTodos(todos.filter(todo => todo.id !== id));
    }, 500);
  };

  const handleDeleteTodo = (id: number) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  // Create visually reordered list for preview during drag
  const getReorderedTodos = () => {
    if (!draggedTaskId || (!dragOverTaskId && !isDropEndZone)) {
      return todos.filter(todo => !todo.completed);
    }

    // Create a copy of the active todos
    const activeTodos = todos.filter(todo => !todo.completed);
    const draggedTaskIndex = activeTodos.findIndex(todo => todo.id === draggedTaskId);
    
    if (draggedTaskIndex === -1) return activeTodos;
    
    const result = [...activeTodos];
    const [draggedItem] = result.splice(draggedTaskIndex, 1);
    
    if (isDropEndZone) {
      // Add to the end
      result.push(draggedItem);
    } else if (dragOverTaskId) {
      // Add at the specific position
      const dropIndex = result.findIndex(todo => todo.id === dragOverTaskId);
      if (dropIndex !== -1) {
        result.splice(dropIndex, 0, draggedItem);
      } else {
        result.push(draggedItem);
      }
    }
    
    return result;
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent<HTMLLIElement>, id: number) => {
    setDraggedTaskId(id);
    setIsDragging(true);
    e.currentTarget.classList.add('dragging');
    // Make the drag image more transparent
    if (e.dataTransfer.setDragImage) {
      const draggedElement = e.currentTarget;
      e.dataTransfer.setDragImage(draggedElement, 20, 20);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLIElement | HTMLDivElement>, id?: number) => {
    e.preventDefault();
    
    // If this is the end drop zone
    if (!id) {
      setIsDropEndZone(true);
      setDragOverTaskId(null);
      return;
    }
    
    if (draggedTaskId === null || draggedTaskId === id) return;
    
    setDragOverTaskId(id);
    setIsDropEndZone(false);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLIElement | HTMLDivElement>) => {
    // Only set to false if we're leaving the element we're currently over
    const relatedTarget = e.relatedTarget as HTMLElement;
    
    if (e.currentTarget.contains(relatedTarget)) {
      return; // Don't reset if we're just moving within the same element
    }
    
    if (e.currentTarget === endDropZoneRef.current) {
      setIsDropEndZone(false);
    } else if (dragOverTaskId && e.currentTarget.getAttribute('data-id') === dragOverTaskId.toString()) {
      setDragOverTaskId(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLLIElement | HTMLDivElement>, targetId?: number) => {
    e.preventDefault();
    
    if (draggedTaskId === null) return;
    
    // Reorder the tasks
    const updatedTodos = [...todos];
    const draggedTaskIndex = updatedTodos.findIndex(todo => todo.id === draggedTaskId);
    const draggedTask = updatedTodos[draggedTaskIndex];
    
    // Remove the dragged task from its original position
    updatedTodos.splice(draggedTaskIndex, 1);
    
    // If dropping at the end
    if (isDropEndZone || !targetId) {
      // Add to the end of the array
      updatedTodos.push(draggedTask);
    } else {
      // If dropping at a specific position and not on itself
      if (draggedTaskId !== targetId) {
        // Find the index of the target task
        const targetTaskIndex = updatedTodos.findIndex(todo => todo.id === targetId);
        
        // Insert the dragged task at the new position
        updatedTodos.splice(targetTaskIndex, 0, draggedTask);
      }
    }
    
    // Update the state with the new order
    setTodos(updatedTodos);
  };

  const handleDragEnd = (e: React.DragEvent<HTMLLIElement>) => {
    e.currentTarget.classList.remove('dragging');
    setDraggedTaskId(null);
    setDragOverTaskId(null);
    setIsDragging(false);
    setIsDropEndZone(false);
  };

  // Only showing active tasks with visual preview during drag
  const visibleTodos = getReorderedTodos();

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
          />
          <button onClick={handleAddTodo}>Add</button>
        </div>
        
        <div className="todo-container">
          <ul ref={todoListRef} className="todo-list">
            {visibleTodos.map(todo => (
              <li 
                key={todo.id}
                data-id={todo.id}
                draggable
                onDragStart={(e) => handleDragStart(e, todo.id)}
                onDragOver={(e) => handleDragOver(e, todo.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, todo.id)}
                onDragEnd={handleDragEnd}
                className={`
                  ${draggedTaskId === todo.id ? 'dragging' : ''} 
                  ${dragOverTaskId === todo.id ? 'drag-over' : ''}
                `}
              >
                <div className="todo-item">
                  <button 
                    className="checkbox"
                    onClick={() => handleToggleTodo(todo.id)}
                    aria-label="Mark as complete"
                  >
                    {todo.completed && '✓'}
                  </button>
                  <span className="todo-text">
                    {todo.text}
                  </span>
                </div>
                <button 
                  className="delete-btn"
                  onClick={() => handleDeleteTodo(todo.id)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
          
          {/* Special drop zone for the end of the list - now invisible */}
          {isDragging && visibleTodos.length > 0 && (
            <div 
              ref={endDropZoneRef}
              className={`end-drop-zone ${isDropEndZone ? 'drag-over' : ''}`}
              onDragOver={(e) => handleDragOver(e)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e)}
            >
              {/* No text content - just a target area */}
            </div>
          )}
          
          {visibleTodos.length === 0 && (
            <div className="empty-state">
              <p>No active tasks! Add a new task to get started.</p>
            </div>
          )}
        </div>
      </header>
    </div>
  );
}

export default App;
