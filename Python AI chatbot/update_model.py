import sqlite3

conn = sqlite3.connect('database.db')
cursor = conn.cursor()
cursor.execute("UPDATE settings SET value = 'google/gemini-2.5-flash' WHERE key = 'model'")
conn.commit()
cursor.execute("SELECT key, value FROM settings WHERE key = 'model'")
print("Updated model:", cursor.fetchone())
conn.close()
