import React, { useState } from 'react';
import './App.css';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputValue, setInputValue] = useState('');

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

  // Only showing active tasks
  const activeTodos = todos.filter(todo => !todo.completed);

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
        
        <ul className="todo-list">
          {activeTodos.map(todo => (
            <li key={todo.id}>
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
          {activeTodos.length === 0 && (
            <div className="empty-state">
              <p>No active tasks! Add a new task to get started.</p>
            </div>
          )}
        </ul>
      </header>
    </div>
  );
}

export default App;
