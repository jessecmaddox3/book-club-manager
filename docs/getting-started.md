# Your first book club

> **TL;DR:** Install Node.js, unzip the project, and open the Start file. The example club runs in your browser, but its records live in a folder on your computer.

## Open it

Download and install the LTS option from [nodejs.org](https://nodejs.org/). Accept the normal installer defaults. If a terminal was already open, close and reopen it after installing Node.

Download the project ZIP from this repository's latest release, then extract it. On Windows, use **Extract All** first. Do not run the Start file from inside the ZIP preview. A normal folder such as Documents is fine; avoid a folder shared publicly or synchronized to a public repository.

On Mac, double-click **Start.command**. If macOS does not open it, open Terminal, type `cd ` with a trailing space, drag the extracted folder into the terminal, and press Return. Then type `bash Start.command` and press Return.

On Windows, double-click **Start.cmd**. On Linux, open a terminal in the folder and run `sh start.sh`.

The first start downloads dependencies and builds the app. Later starts reuse that installation unless its code changes. When it is ready, your browser opens. If it does not, open **http://127.0.0.1:5055** yourself.

## Take a quick tour

Choose **Remy (organizer)** to see the organizer screens. The exact display label appears in the picker. Try the current ballot, the reading history, a member page, and the rating backlog. Then choose another invented reader to see the member experience.

Some readers have already voted. A reader who has not voted must submit the ballot before seeing open-ballot results. Organizer screens contain individual responses; ordinary ballot pages omit who recommended each book.

Under **Suggest a book**, enter a title and author and preview the book. No AI lookup is required. Save it, and it appears in your pending suggestions below the form. This list is private to that reader and the organizer's operational tools.

## Stop and return

Keep the terminal open while using the club. Click the terminal and press **Control+C** to stop safely. Reopen the same Start file to return to your saved example.

The default data folder is `.local/demo` inside the project. The leading dot may hide it in your file browser. Do not delete or replace it to fix a startup error. Use the [backup guide](backups.md).

Only one process can own a local data folder. Close the app before running an organizer command. After a forced crash, the stale lock can take 30 seconds to expire.

## Common snags

| Message or symptom | Next step |
| --- | --- |
| Node cannot be found | Install Node.js LTS, then reopen the terminal or Start file. |
| A download fails on first start | Check your internet connection and retry. No account or payment is required. |
| Port 5055 is already in use | Close the other copy of this app. Do not stop an unfamiliar process. |
| Demo is already open | Stop its other terminal with Control+C. A browser tab alone does not own the database. |
| Saved database is missing or incomplete | Preserve the folder and restore a backup into a new folder. The app will not silently replace your records. |
| Changes are missing | Check that you opened the same extracted folder and configured data location. |

A local address beginning with `127.0.0.1` points to your own computer. Sending that link to your club will not share your installation. Follow the [hosted guide](hosting.md) when you're ready for shared accounts.
