import React, { useState } from 'react';
import './App.css';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

type FilterStatus = 'all' | 'active' | 'completed';

function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

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
    setTodos(
      todos.map(todo => 
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  const handleDeleteTodo = (id: number) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const filteredTodos = todos.filter(todo => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'active') return !todo.completed;
    if (filterStatus === 'completed') return todo.completed;
    return true;
  });

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
        
        <div className="filter-buttons">
          <button 
            className={filterStatus === 'all' ? 'active' : ''} 
            onClick={() => setFilterStatus('all')}
          >
            All
          </button>
          <button 
            className={filterStatus === 'active' ? 'active' : ''} 
            onClick={() => setFilterStatus('active')}
          >
            Active
          </button>
          <button 
            className={filterStatus === 'completed' ? 'active' : ''}
            onClick={() => setFilterStatus('completed')}
          >
            Completed
          </button>
        </div>

        <ul className="todo-list">
          {filteredTodos.map(todo => (
            <li key={todo.id} className={todo.completed ? 'completed' : ''}>
              <span onClick={() => handleToggleTodo(todo.id)}>
                {todo.text}
              </span>
              <button onClick={() => handleDeleteTodo(todo.id)}>Delete</button>
            </li>
          ))}
        </ul>
      </header>
    </div>
  );
}

export default App;
