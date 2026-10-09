# Campus Lost & Found Portal

A lightweight, full-stack web application designed for college campuses to report, track, search, and claim lost and found belongings[cite: 1]. The portal features user authentication, image compression, real-time filtering, and attribution for reported and claimed items[cite: 1, 4, 5].

---

## Features

- **Authentication Gateway**: Directs unauthenticated visitors to a sign-in/sign-up screen before accessing the notice board and submission panel[cite: 1].
- **Password Security**: Stores user passwords securely using SHA-256 cryptographic hashing.
- **Item Attribution**: Displays the username of the user who reported an item (`Reported by: @username`) and the user who resolved it (`Claimed by: @username`).
- **Client-Side Image Optimization**: Automatically resizes uploaded photos using HTML5 Canvas to keep image sizes small (JPEG @ 70% quality, max width 600px) before storing them as Base64 strings[cite: 4].
- **Instant Search & Multi-Filter**: Filter notices in real time by category (ID Card, Electronics, Books, Keys, etc.)[cite: 1], resolution status (Lost, Found, Claimed)[cite: 1], and search queries matching keywords or usernames[cite: 4].
- **Zero Third-Party Dependencies**: The backend runs purely on Python's built-in standard library (`http.server`, `sqlite3`, `hashlib`, `json`, `os`, `sys`).

---

## Tech Stack

- **Frontend**: HTML5[cite: 1], CSS3 (CSS Variables, Flexbox, CSS Grid)[cite: 6], Vanilla JavaScript (ES6+ Fetch API, Canvas API)[cite: 4]
- **Backend**: Python 3 standard library (`http.server`)
- **Database**: SQLite3 (`lost_found_Project.db`)[cite: 3, 5]
- **Font & Assets**: Plus Jakarta Sans (Google Fonts)[cite: 1]

---

## Database Schema

The SQLite database (`lost_found_Project.db`) contains two primary tables[cite: 3, 5]:

### `users`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary key, auto-incrementing |
| `username` | TEXT | Unique student/staff username |
| `password` | TEXT | SHA-256 hashed password string |
| `created_at` | TIMESTAMP | Account registration timestamp |

### `items`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary key, auto-incrementing[cite: 3, 5] |
| `title` | TEXT | Item name/title[cite: 3, 5] |
| `category` | TEXT | Item category[cite: 3, 5] |
| `location` | TEXT | Last seen or found campus location[cite: 3, 5] |
| `contact` | TEXT | Finder or owner contact information[cite: 3, 5] |
| `status` | TEXT | Status: `'Lost'`, `'Found'`, or `'Claimed'`[cite: 3, 5] |
| `image` | TEXT | Compressed Base64 JPEG string[cite: 3, 5] |
| `reported_by` | TEXT | Username of the reporter |
| `claimed_by` | TEXT | Username of the claimer (`NULL` until claimed) |
| `created_at` | TIMESTAMP | Notice creation timestamp[cite: 3, 5] |

---

## Project Structure

```text
├── index.html               # Main application layout and authentication view
├── style.css                # Custom CSS styling, responsive layout, and theme
├── script.js                # Frontend controllers, canvas compression, API calls
├── server.py                # Python HTTP server and SQLite database controller
├── lost_found_Project.db    # SQLite database file
├── logo.png                 # Campus/Institute brand logo
└── README.md                # Project documentation