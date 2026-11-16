# Shilian Address Book

A Software Engineering (FZU–MU) Extreme Programming assignment. Shilian supports creating, editing, deleting, searching, and favoriting contacts, along with bulk import and export through Excel.

## Run Locally

On Windows, double-click `start.cmd` or run `.\start.cmd` in PowerShell. Keep the window open while using the address book.

You can also run the application with Python 3.10 or later:

```powershell
python -m pip install -r requirements.txt
python server.py
```

Open [the local address book](http://127.0.0.1:8765/). Press Ctrl+C in the terminal to stop the server.

## Import and Export Excel Files

1. Select **Export Excel** to save an `.xlsx` file. Exporting an empty address book produces a blank template.
2. Keep the template's original header row. The columns represent name, favorite status, phone, email, social account, and address. Leave the favorite field blank to import the contact without a star.
3. Put each contact on a separate row. Separate multiple entries of the same type with line breaks within the same cell. Store phone numbers as text to preserve leading zeroes.
4. Import appends contacts, so importing the same file twice creates duplicates. If any row fails validation, the whole import is rejected.

Contacts are kept in the current browser. Use an Excel export to back them up or move them to another browser.

## Project Structure

| File | Purpose |
| --- | --- |
| `index.html`, `style.css` | Page markup and responsive layout |
| `app.js` | Contact editing, filtering, browser storage, and Excel requests |
| `server.py` | Local HTTP server and workbook endpoints |
| `workbook.py` | Excel conversion and contact validation |

## Run Tests

```powershell
python -m unittest -v
```

See [Coding Standards](CODING_STANDARDS.md) for contribution guidelines.
