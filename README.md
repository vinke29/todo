# Simple Todo App

This is a simplified todo application built with React and TypeScript. The app has been stripped down to its basic functionality to avoid any security permission issues.

## Features

- Add new tasks by typing in the input field and clicking "Add" or pressing Enter
- Mark tasks as completed by clicking on them
- Delete tasks by clicking the "Delete" button

## Getting Started

To run the application:

1. Make sure you have Node.js installed (version 14.x or later recommended)
2. Install dependencies:
   ```
   npm install
   ```
3. Start the development server:
   ```
   npm start
   ```
4. The app will open in your browser at [http://localhost:3000](http://localhost:3000)

## Troubleshooting

If you encounter permission issues:

1. Delete the `node_modules` folder:
   ```
   rm -rf node_modules
   ```
2. Clear npm cache:
   ```
   npm cache clean --force
   ```
3. Reinstall dependencies:
   ```
   npm install
   ```

## Further Development

This is a basic implementation. You can extend it by:

- Adding local storage to persist todos between sessions
- Implementing categories or tags for todos
- Adding due dates and priority levels
- Implementing filtering and sorting options

## License

© 2025 Ignacio Vinke. All rights reserved.

This code is proprietary and confidential. Unauthorized copying, modification,
distribution, or use of this software, via any medium, is strictly prohibited.
