export function bookSearchPrompt(
  query: string,
  existingBooks: string[]
): string {
  const exclusionList =
    existingBooks.length > 0
      ? `\n\nIMPORTANT: The club has already read these books. Do NOT include any of them:\n${existingBooks.map((b) => `- ${b}`).join("\n")}`
      : "";

  return `You are a knowledgeable book expert helping a book club find their next read.

Search for books matching this description: "${query}"
${exclusionList}

Return a JSON object with this exact structure:
{
  "books": [
    {
      "title": "Book Title",
      "author": "Author Name",
      "description": "A 2-3 sentence summary of the book's main themes and arguments.",
      "whyMatch": "Why this book matches the query.",
      "pageCount": 320,
      "audiobookLength": "10 hours 30 minutes"
    }
  ]
}

For pageCount, provide the approximate number of pages as an integer.
For audiobookLength, provide the approximate audiobook duration as a human-readable string (e.g. "8 hours 15 minutes"). If no audiobook exists, use null.

Return up to 5 books. Honor the reader's stated genre and format preferences. Respond with ONLY the JSON object, no other text.`;
}

export function bookRecommendPrompt(
  readBooks: { title: string; author: string }[],
  preferences?: string
): string {
  const bookList = readBooks
    .map((b) => `- "${b.title}" by ${b.author}`)
    .join("\n");

  const preferencesSection = preferences
    ? `\n\nThe member has also expressed these preferences for their next book: "${preferences}"`
    : "";

  return `You are a knowledgeable book expert helping a book club choose their next read.

Here are the books the club has already read:
${bookList}
${preferencesSection}

Based on the club's reading history and any stated preferences, suggest 5 books they would enjoy. Choose books that complement their interests but also introduce new perspectives and topics. Do NOT recommend any book they have already read.

Return a JSON object with this exact structure:
{
  "recommendations": [
    {
      "title": "Book Title",
      "author": "Author Name",
      "description": "A 2-3 sentence summary of the book's main themes and arguments.",
      "whyRecommend": "Why this book is a good fit for the club based on their reading history.",
      "pageCount": 320,
      "audiobookLength": "10 hours 30 minutes"
    }
  ]
}

For pageCount, provide the approximate number of pages as an integer.
For audiobookLength, provide the approximate audiobook duration as a human-readable string (e.g. "8 hours 15 minutes"). If no audiobook exists, use null.

Respond with ONLY the JSON object, no other text.`;
}

export function bookLookupPrompt(title: string, author: string): string {
  return `You are a knowledgeable book expert. Provide details about the book "${title}" by ${author}.

Return a JSON object with this exact structure:
{
  "title": "Exact Book Title",
  "author": "Author Name",
  "description": "A 2-3 sentence summary of the book's main themes and arguments.",
  "pageCount": 320,
  "audiobookLength": "10 hours 30 minutes",
  "goodreadsRating": 4.2
}

For pageCount, provide the approximate number of pages as an integer.
For audiobookLength, provide the approximate audiobook duration as a human-readable string. If no audiobook exists, use null.
For goodreadsRating, provide the approximate Goodreads rating as a number. If unknown, use null.

Respond with ONLY the JSON object, no other text.`;
}
