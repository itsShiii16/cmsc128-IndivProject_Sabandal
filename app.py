import sqlite3
from datetime import datetime
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask import render_template

BASE_DIR = Path(__file__).resolve().parent          # folder that contains app.py
DB_PATH = BASE_DIR / "db.sqlite3"                    # Backend/db.sqlite3
ALLOWED_PRIORITIES = {"High", "Mid", "Low"}          # whitelist for priority values

# Sorting: map API query values to actual DB column names
SORT_COLUMNS = {
    "dateAdded": "created_at",
    "createdAt": "created_at",   
    "dueDate": "due_date",
    "priority": "priority",
}

app = Flask(__name__)   
CORS(app, resources={r"/api/*": {"origins": "*"}})

@app.route('/')
def home():                                           # returns index html
    return render_template('index.html')

def get_conn() -> sqlite3.Connection:
    """Open a SQLite connection to our DB file."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row  # enable name-based access to columns
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db() -> None:
    """Create the tasks table if it doesn't exist yet, and add the 'status' column if it's missing."""
    with get_conn() as conn:
        # Create tasks table if it doesn't exist
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                priority TEXT CHECK(priority IN ('High','Mid','Low')) DEFAULT 'Mid',
                due_date TEXT,   -- YYYY-MM-DD
                due_time TEXT,   -- HH:MM
                is_done INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                status TEXT CHECK(status IN ('ongoing', 'completed')) DEFAULT 'ongoing'
            );
            """
        )

        # Add 'status' column if it doesn't exist
        try:
            conn.execute("SELECT status FROM tasks LIMIT 1;")
        except sqlite3.OperationalError:
            # 'status' column doesn't exist, add it
            conn.execute(
                """
                ALTER TABLE tasks ADD COLUMN status TEXT CHECK(status IN ('ongoing', 'completed')) DEFAULT 'ongoing';
                """
            )

def row_to_task(r: sqlite3.Row) -> dict:
    """Convert a DB row to the JSON shape our frontend expects."""
    return {
        "id": r["id"],
        "title": r["title"],
        "description": r["description"],
        "priority": r["priority"],
        "dueDate": r["due_date"],
        "dueTime": r["due_time"],
        "isDone": bool(r["is_done"]),
        "status": r["status"],  # Include the status field
        "createdAt": r["created_at"],
    }

# Small utilities
def error(message: str, status: int = 400):
    """Consistent error JSON."""
    return jsonify({"error": message}), status

def now_iso_utc() -> str:
    """UTC timestamp as ISO-8601 (e.g., 2025-09-29T12:34:56Z)."""
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

@app.get("/api/tasks")
def list_tasks():
    """List all tasks, with optional sorting."""
    sort_by = request.args.get("sortBy", "dateAdded")
    order = request.args.get("order", "asc").lower()

    col = SORT_COLUMNS.get(sort_by, SORT_COLUMNS["dateAdded"])
    direction = "DESC" if order == "desc" else "ASC"

    with get_conn() as conn:
        rows = conn.execute(
            f"SELECT * FROM tasks ORDER BY {col} {direction}, id ASC;"
        ).fetchall()

    return jsonify([row_to_task(r) for r in rows]), 200

@app.get("/api/tasks/<int:task_id>")
def get_task(task_id: int):
    """Get a task by its ID."""
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM tasks WHERE id = ?;", (task_id,)).fetchone()
        if row is None:
            return error("Task not found.", status=404)
        return jsonify(row_to_task(row)), 200

@app.post("/api/tasks")
def create_task():
    """Create a new task."""
    data = request.get_json(silent=True) or {}

    # Basic validation
    title = (data.get("title") or "").strip()
    if not title:
        return error("Field 'title' is required.")
    priority = data.get("priority") or "Mid"
    if priority not in ALLOWED_PRIORITIES:
        return error("Field 'priority' must be one of High, Mid, Low.")

    # Prepare values
    description = (data.get("description") or None)
    due_date = data.get("dueDate") or None
    due_time = data.get("dueTime") or None
    status = data.get("status", "ongoing")  # Default status is 'ongoing'
    created_at = now_iso_utc()

    with get_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO tasks (title, description, priority, due_date, due_time, is_done, status, created_at)
            VALUES (?, ?, ?, ?, ?, 0, ?, ?)
            """,
            (title, description, priority, due_date, due_time, status, created_at),
        )
        new_id = cur.lastrowid
        row = conn.execute("SELECT * FROM tasks WHERE id = ?;", (new_id,)).fetchone()

    return jsonify(row_to_task(row)), 201

@app.patch("/api/tasks/<int:task_id>")
def update_task(task_id: int):
    """Update parts of a task (title, description, priority, dueDate, dueTime, isDone, status)."""
    data = request.get_json(silent=True) or {}

    #Build dynamic SQL safely
    fields, params = [], []

    if "title" in data:
        title = (data["title"] or "").strip()
        if not title:
            return error("Field 'title' cannot be empty.")
        fields.append("title = ?")
        params.append(title)

    if "description" in data:
        fields.append("description = ?")
        params.append(data["description"] or None)

    if "priority" in data:
        if data["priority"] not in ALLOWED_PRIORITIES:
            return error("Field 'priority' must be one of High, Mid, Low.")
        fields.append("priority = ?")
        params.append(data["priority"])

    if "dueDate" in data:
        fields.append("due_date = ?")
        params.append(data["dueDate"] or None)

    if "dueTime" in data:
        fields.append("due_time = ?")
        params.append(data["dueTime"] or None)

    if "isDone" in data:
        fields.append("is_done = ?")
        params.append(1 if bool(data["isDone"]) else 0)

    if "status" in data:
        if data["status"] not in ["ongoing", "completed"]:
            return error("Invalid status. Must be 'ongoing' or 'completed'.")
        fields.append("status = ?")
        params.append(data["status"])

    if not fields:
        return error("No updatable fields provided.")

    with get_conn() as conn:
        exists = conn.execute("SELECT 1 FROM tasks WHERE id = ?;", (task_id,)).fetchone()
        if not exists:
            return error("Task not found.", status=404)

        conn.execute(f"UPDATE tasks SET {', '.join(fields)} WHERE id = ?;", (*params, task_id))
        row = conn.execute("SELECT * FROM tasks WHERE id = ?;", (task_id,)).fetchone()

    return jsonify(row_to_task(row)), 200

@app.delete("/api/tasks/<int:task_id>")
def delete_task(task_id: int):
    """Delete a task; return the deleted task body (useful for 'Undo' on the client)."""
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM tasks WHERE id = ?;", (task_id,)).fetchone()
        if not row:
            return error("Task not found.", status=404)

        deleted = row_to_task(row)
        conn.execute("DELETE FROM tasks WHERE id = ?;", (task_id,))

    return jsonify(deleted), 200

if __name__ == "__main__":
    init_db()  # Make sure the table exists and status column is added
    app.run(debug=True, port=5000)
