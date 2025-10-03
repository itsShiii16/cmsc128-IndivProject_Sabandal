# cmsc128-IndivProject_-Sabandal-.

# To-Do Web App
To-Do list application that supports full CRUD with data persistence and basic/expanded features.

Backend: Flask (Python) + SQLite (file-based DB).
Frontend: Vanilla HTML/JS + Tailwind (CDN).

Feature Checklist
    Minimum
        To-Do list interface (Ongoing / Completed columns)
        Add task
        Set Due Date & Time (string input accepted; also date/time pickers available)
        Delete task (with confirmation dialog)
        Edit task
        Mark task as Done / Ongoing
        Data persists after refresh (SQLite database)

    Expanded

        Task priority with color tags: High (red), Mid (yellow), Low (green)
        Timestamp recorded when the task is created (createdAt, UTC ISO string)
        Date picker for due date
        Time picker for due time
        Sorting: Date Added (createdAt), Due Date, Priority

Tech Stack
Backend: Python 3.10+ / Flask / flask-cors
Database: SQLite (db.sqlite3 in project directory)
Frontend: Static index.html (fetch API), TailwindCSS via CDN


## REST API ( Examples )

1. List task
   """
   GET /api/tasks?sortBy=<dateAdded|createdAt|dueDate|priority>&order=<asc|desc>
   """

   """
   curl "http://127.0.0.1:5000/api/tasks?sortBy=createdAt&order=desc"
   """

   Response
   """
   [
  {
    "id": 1,
    "title": "Buy milk",
    "description": "2 liters",
    "priority": "Mid",
    "dueDate": "2025-10-05",
    "dueTime": "18:00",
    "isDone": false,
    "status": "ongoing",
    "createdAt": "2025-10-03T04:12:33Z"
  }
  """

2. Create task
"""
POST /api/tasks
Content-Type: application/json

"""

Body
"""
{
  "title": "Buy milk",
  "description": "2 liters",
  "priority": "Mid",
  "dueDate": "2025-10-05",
  "dueTime": "18:00"
}
"""

Example
"""
curl -X POST "http://127.0.0.1:5000/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{"title":"Buy milk","description":"2 liters","priority":"Mid","dueDate":"2025-10-05","dueTime":"18:00"}'

"""


Notes on Validation

- title is required and must be non-empty.
- priority must be one of High, Mid, Low.
- status must be ongoing or completed.
- isDone is stored as integer (0/1) in DB, returned as boolean in JSON.
