from http.server import BaseHTTPRequestHandler, HTTPServer
import hashlib
import json
import os
import sqlite3
import sys

PORT = 8000
DB_NAME = "lost_found_Project.db"


def hash_password(password: str) -> str:
  """Hashes user passwords with SHA-256 before saving to SQLite."""
  return hashlib.sha256(password.encode("utf-8")).hexdigest()


def get_db_connection():
  conn = sqlite3.connect(DB_NAME)
  conn.row_factory = sqlite3.Row
  return conn


def init_db():
  conn = get_db_connection()
  cursor = conn.cursor()

  # 1. Users Table (Stores user credentials)
  cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

  # 2. Items Table
  cursor.execute("""
        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            location TEXT NOT NULL,
            contact TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Lost',
            image TEXT,
            reported_by TEXT DEFAULT 'Anonymous',
            claimed_by TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
  conn.commit()

  # Safe automatic schema migrations for existing database files
  cursor.execute("PRAGMA table_info(items)")
  columns = [row["name"] for row in cursor.fetchall()]

  if "image" not in columns:
    cursor.execute("ALTER TABLE items ADD COLUMN image TEXT")
  if "reported_by" not in columns:
    cursor.execute(
        "ALTER TABLE items ADD COLUMN reported_by TEXT DEFAULT 'Anonymous'"
    )
  if "claimed_by" not in columns:
    cursor.execute("ALTER TABLE items ADD COLUMN claimed_by TEXT DEFAULT NULL")
  if "created_at" not in columns:
    cursor.execute(
        "ALTER TABLE items ADD COLUMN created_at TIMESTAMP DEFAULT"
        " CURRENT_TIMESTAMP"
    )

  conn.commit()
  conn.close()


class RequestHandler(BaseHTTPRequestHandler):

  def _send_json(self, data, status=200):
    self.send_response(status)
    self.send_header("Content-Type", "application/json")
    self.send_header("Access-Control-Allow-Origin", "*")
    self.send_header(
        "Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS"
    )
    self.send_header("Access-Control-Allow-Headers", "Content-Type")
    self.end_headers()
    self.wfile.write(json.dumps(data).encode("utf-8"))

  def _serve_file(self, filename, content_type):
    if os.path.exists(filename):
      self.send_response(200)
      self.send_header("Content-Type", content_type)
      self.end_headers()
      with open(filename, "rb") as f:
        self.wfile.write(f.read())
    else:
      self.send_response(404)
      self.end_headers()

  def do_OPTIONS(self):
    self.send_response(200)
    self.send_header("Access-Control-Allow-Origin", "*")
    self.send_header(
        "Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS"
    )
    self.send_header("Access-Control-Allow-Headers", "Content-Type")
    self.end_headers()

  def do_GET(self):
    path = self.path.split("?")[0]

    # Serve static frontend assets
    if path in ("/", "/index.html"):
      self._serve_file("index.html", "text/html")
    elif path == "/style.css":
      self._serve_file("style.css", "text/css")
    elif path == "/script.js":
      self._serve_file("script.js", "application/javascript")
    elif path.endswith((".png", ".jpg", ".jpeg", ".svg", ".webp", ".ico")):
      ext = path.split(".")[-1].lower()
      content_type = (
          "image/svg+xml"
          if ext == "svg"
          else f"image/{'jpeg' if ext == 'jpg' else ext}"
      )
      self._serve_file(path.lstrip("/"), content_type)

    # API: Fetch all items with reporter and claimer names
    elif path == "/api/items":
      try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
                    SELECT id, title, category, location, contact, status, image, 
                           reported_by, claimed_by, created_at 
                    FROM items ORDER BY id DESC
                """)
        rows = cursor.fetchall()
        conn.close()

        items = [
            {
                "id": r["id"],
                "title": r["title"],
                "category": r["category"],
                "location": r["location"],
                "contact": r["contact"],
                "status": r["status"],
                "image": r["image"] if r["image"] else "",
                "reported_by": r["reported_by"]
                if r["reported_by"]
                else "Anonymous",
                "claimed_by": r["claimed_by"],
                "created_at": r["created_at"],
            }
            for r in rows
        ]
        self._send_json(items)
      except Exception as e:
        self._send_json({"error": str(e)}, 500)
    else:
      self.send_response(404)
      self.end_headers()

  def do_POST(self):
    content_len = int(self.headers.get("Content-Length", 0))
    body = self.rfile.read(content_len).decode("utf-8")
    data = json.loads(body) if body else {}

    # API: Create Account (Register)
    if self.path == "/api/register":
      username = data.get("username", "").strip()
      password = data.get("password", "").strip()

      if not username or not password:
        self._send_json(
            {"error": "Username and password cannot be empty."}, 400
        )
        return

      try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (username, password) VALUES (?, ?)",
            (username, hash_password(password)),
        )
        conn.commit()
        conn.close()
        self._send_json(
            {"message": "Account created successfully!", "username": username},
            201,
        )
      except sqlite3.IntegrityError:
        self._send_json({"error": "That username is already taken."}, 409)
      except Exception as e:
        self._send_json({"error": str(e)}, 500)

    # API: Login Verification
    elif self.path == "/api/login":
      username = data.get("username", "").strip()
      password = data.get("password", "").strip()

      try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM users WHERE username = ? AND password = ?",
            (username, hash_password(password)),
        )
        user = cursor.fetchone()
        conn.close()

        if user:
          self._send_json(
              {"message": "Login successful!", "username": username}
          )
        else:
          self._send_json({"error": "Invalid username or password."}, 401)
      except Exception as e:
        self._send_json({"error": str(e)}, 500)

    # API: Publish New Item Notice with User Attribution
    elif self.path == "/api/items":
      try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
                    INSERT INTO items (title, category, location, contact, status, image, reported_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
            (
                data.get("title", "").strip(),
                data.get("category", "Others"),
                data.get("location", "").strip(),
                data.get("contact", "").strip(),
                data.get("status", "Lost"),
                data.get("image", ""),
                data.get("reported_by", "Anonymous").strip(),
            ),
        )
        conn.commit()
        conn.close()
        self._send_json({"message": "Item saved successfully!"}, 201)
      except Exception as e:
        print("POST Error:", e)
        self._send_json({"error": str(e)}, 500)

  def do_PUT(self):
    # API: Mark Item as Claimed with Username
    if self.path.startswith("/api/claim/"):
      try:
        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len).decode("utf-8")
        data = json.loads(body) if body else {}

        item_id = int(self.path.split("/")[-1])
        claimed_by = data.get("claimed_by", "Anonymous")

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
                    UPDATE items 
                    SET status = 'Claimed', claimed_by = ? 
                    WHERE id = ?
                """,
            (claimed_by, item_id),
        )
        conn.commit()
        conn.close()
        self._send_json({"message": "Item marked as Claimed!"})
      except Exception as e:
        print("PUT Error:", e)
        self._send_json({"error": str(e)}, 500)

  def do_DELETE(self):
    # API: Delete Item Notice
    if self.path.startswith("/api/items/"):
      try:
        item_id = int(self.path.split("/")[-1])
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM items WHERE id = ?", (item_id,))
        conn.commit()
        conn.close()
        self._send_json({"message": "Notice deleted successfully!"})
      except Exception as e:
        print("DELETE Error:", e)
        self._send_json({"error": str(e)}, 500)


if __name__ == "__main__":
  init_db()
  server = HTTPServer(("localhost", PORT), RequestHandler)
  print(f"\n==========================================")
  print(f" Campus Portal Active at: http://localhost:{PORT}")
  print(f" Press Ctrl+C in terminal to stop server")
  print(f"==========================================\n")
  try:
    server.serve_forever()
  except KeyboardInterrupt:
    print("\nShutting down server cleanly...")
    sys.exit(0)