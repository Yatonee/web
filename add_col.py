import sqlite3
conn = sqlite3.connect('data/attendance.db')
cur = conn.execute("PRAGMA table_info(employees)")
cols = [row[1] for row in cur.fetchall()]
print("Current columns:", cols)
print("Has employee_type_id:", 'employee_type_id' in cols)
print("Has salary_policy_id:", 'salary_policy_id' in cols)
conn.close()
