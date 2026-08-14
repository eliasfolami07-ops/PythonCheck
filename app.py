"""
Scalable Admin Dashboard — Flask backend
Serves a responsive, real-time-feeling dashboard with REST API endpoints.
"""
import sqlite3
import random
import datetime
from pathlib import Path
from flask import Flask, jsonify, render_template, request, g

APP_DIR = Path(__file__).parent
DB_PATH = APP_DIR / "dashboard.db"

app = Flask(__name__)


# ----------------------- Database helpers -----------------------
def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            role TEXT NOT NULL,
            status TEXT NOT NULL,
            joined TEXT NOT NULL
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS activity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            label TEXT NOT NULL,
            value INTEGER NOT NULL,
            ts TEXT NOT NULL
        )
    """)
    cur.execute("SELECT COUNT(*) FROM users")
    if cur.fetchone()[0] == 0:
        roles = ["Admin", "Editor", "Viewer", "Analyst"]
        statuses = ["active", "active", "active", "inactive", "pending"]
        names = [
            "Ada Lovelace", "Grace Hopper", "Alan Turing", "Katherine Johnson",
            "Tim Berners-Lee", "Margaret Hamilton", "Dennis Ritchie", "Radia Perlman",
            "Linus Torvalds", "Barbara Liskov", "John Carmack", "Hedy Lamarr",
        ]
        for i, n in enumerate(names):
            cur.execute(
                "INSERT INTO users (name, email, role, status, joined) VALUES (?,?,?,?,?)",
                (
                    n,
                    n.lower().replace(" ", ".") + "@example.com",
                    random.choice(roles),
                    random.choice(statuses),
                    (datetime.date.today() - datetime.timedelta(days=random.randint(1,400))).isoformat(),
                ),
            )
        for i in range(30):
            cur.execute(
                "INSERT INTO activity (label, value, ts) VALUES (?,?,?)",
                (
                    (datetime.date.today() - datetime.timedelta(days=29 - i)).strftime("%b %d"),
                    random.randint(40, 260),
                    datetime.datetime.now().isoformat(),
                ),
            )
        conn.commit()
    conn.close()


# ----------------------- Views -----------------------
@app.route("/")
def index():
    return render_template("index.html")


# ----------------------- API -----------------------
@app.route("/api/stats")
def api_stats():
    db = get_db()
    total_users = db.execute("SELECT COUNT(*) c FROM users").fetchone()["c"]
    active_users = db.execute("SELECT COUNT(*) c FROM users WHERE status='active'").fetchone()["c"]
    pending = db.execute("SELECT COUNT(*) c FROM users WHERE status='pending'").fetchone()["c"]
    revenue = round(random.uniform(18000, 26000), 2)
    return jsonify({
        "total_users": total_users,
        "active_users": active_users,
        "pending_users": pending,
        "revenue": revenue,
        "growth_pct": round(random.uniform(-3, 12), 1),
    })


@app.route("/api/activity")
def api_activity():
    db = get_db()
    rows = db.execute("SELECT label, value FROM activity ORDER BY id ASC").fetchall()
    return jsonify([{"label": r["label"], "value": r["value"]} for r in rows])


@app.route("/api/users")
def api_users():
    db = get_db()
    q = request.args.get("q", "").strip().lower()
    status = request.args.get("status", "").strip().lower()
    sql = "SELECT * FROM users WHERE 1=1"
    params = []
    if q:
        sql += " AND (LOWER(name) LIKE ? OR LOWER(email) LIKE ?)"
        params += [f"%{q}%", f"%{q}%"]
    if status and status != "all":
        sql += " AND status = ?"
        params.append(status)
    sql += " ORDER BY id DESC"
    rows = db.execute(sql, params).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/users/<int:user_id>/status", methods=["POST"])
def update_status(user_id):
    new_status = request.json.get("status")
    if new_status not in ("active", "inactive", "pending"):
        return jsonify({"error": "invalid status"}), 400
    db = get_db()
    db.execute("UPDATE users SET status=? WHERE id=?", (new_status, user_id))
    db.commit()
    return jsonify({"ok": True})


@app.route("/api/users", methods=["POST"])
def create_user():
    data = request.json
    db = get_db()
    db.execute(
        "INSERT INTO users (name, email, role, status, joined) VALUES (?,?,?,?,?)",
        (data["name"], data["email"], data.get("role", "Viewer"), "pending",
         datetime.date.today().isoformat()),
    )
    db.commit()
    return jsonify({"ok": True}), 201


@app.route("/api/users/<int:user_id>", methods=["DELETE"])
def delete_user(user_id):
    db = get_db()
    db.execute("DELETE FROM users WHERE id=?", (user_id,))
    db.commit()
    return jsonify({"ok": True})


if __name__ == "__main__":
    init_db()
    app.run(debug=True, host="0.0.0.0", port=5000)
