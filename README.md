# cmsc128-IndivProject_-Sabandal-.

# To-Do Web App
To-Do list application that supports full CRUD with data persistence and basic/expanded features.

### Backend: 
Flask (Python) + SQLite (file-based DB).

### Frontend: 
Vanilla HTML/JS + Tailwind (CDN).

## Feature Checklist

### Minimum

>To-Do list interface (Ongoing / Completed columns)

>Add task

>Set Due Date & Time (string input accepted; also date/time pickers available)

>Delete task (with confirmation dialog)

>Edit task

>Mark task as Done / Ongoing

>Data persists after refresh (SQLite database)

### Expanded

>Task priority with color tags: High (red), Mid (yellow), Low (green)

>Timestamp recorded when the task is created (createdAt, UTC ISO string)

>Date picker for due date

>Time picker for due time

>Sorting: Date Added (createdAt), Due Date, Priority

### Tech Stack
Backend: Python 3.10+ / Flask / flask-cors

Database: SQLite (db.sqlite3 in project directory)

Frontend: Static index.html (fetch API), TailwindCSS via CDN



## REST API ( Examples )

1. List task
   
        
         GET /api/tasks?sortBy=<dateAdded|createdAt|dueDate|priority>&order=<asc|desc>

   Example
        
         curl "http://127.0.0.1:5000/api/tasks?sortBy=createdAt&order=desc"
      

   Response

    
   
         
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
      
      
 

3. Create task



         POST /api/tasks
         Content-Type: application/json



Body


      {
        "title": "Buy milk",
        "description": "2 liters",
        "priority": "Mid",
        "dueDate": "2025-10-05",
        "dueTime": "18:00"
      }



Example


      curl -X POST "http://127.0.0.1:5000/api/tasks" \
        -H "Content-Type: application/json" \
        -d '{"title":"Buy milk","description":"2 liters","priority":"Mid","dueDate":"2025-10-05","dueTime":"18:00"}'



## How the Frontend Connects to the Database

### User action in the UI
The user clicks Add Task, Edit, Delete, or Mark as Done in index.html.

### Frontend builds an HTTP request
JavaScript uses fetch() to call the Flask API (e.g., POST /api/tasks, GET /api/tasks, PATCH /api/tasks/:id, DELETE /api/tasks/:id).
Base URL: http://127.0.0.1:5000/api (see API_BASE in the frontend script).

### CORS allows the browser→API call
Flask has flask-cors enabled for /api/*, so the browser is allowed to call the API from the page.

### Flask route receives the request
The matching route function runs in app.py:

>list_tasks() for GET /api/tasks
>get_task() for GET /api/tasks/:id
>create_task() for POST /api/tasks
>update_task() for PATCH /api/tasks/:id
>delete_task() for DELETE /api/tasks/:id

### Backend opens the database
The route calls get_conn() which returns a SQLite connection to db.sqlite3 (file on disk).
>init_db() (run at server start) ensures the tasks table exists.

### SQL operation runs
The route executes the appropriate SQL:
>SELECT (read), INSERT (create), UPDATE (edit/mark done), or DELETE (remove).

### DB rows → JSON (API shape)
Results are converted with row_to_task() into the frontend’s expected JSON (e.g., isDone as boolean, createdAt as ISO string, dueDate/dueTime as strings).

### API responds; frontend updates the UI
Flask returns JSON. The frontend receives it in .then(...), and:
>Repaints lists via fetchTasks() (for reads or after creates/updates/deletes).
>Renders cards with title, description, priority tag, created timestamp, and due info.



## Notes on Validation

> title is required and must be non-empty.

> priority must be one of High, Mid, Low.

> status must be ongoing or completed.

> isDone is stored as integer (0/1) in DB, returned as boolean in JSON.
