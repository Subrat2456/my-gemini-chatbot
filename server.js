// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3000;

// --- Configuration ---
const MODEL_NAME = "gemini-1.5-flash-latest"; // Or your preferred model like "gemini-pro"
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error("FATAL ERROR: GEMINI_API_KEY is not set in the .env file or environment variables.");
    process.exit(1); // Exit if API key is missing
}

const genAI = new GoogleGenerativeAI(API_KEY);

// --- Middleware ---
app.use(cors()); // Enable CORS for all routes. For production, configure specific origins.
app.use(express.json({ limit: '5mb' })); // To parse JSON request bodies, increased limit for file content
app.use(express.static('public')); // Serve static files (like index.html) from the 'public' folder

// --- In-memory chat history (simple example) ---
// For a real app, you'd use proper session management and a database.
let chatHistories = {};
const DEFAULT_SESSION_ID = 'default_user_session'; // Single session for this example

function getChatSession(sessionId = DEFAULT_SESSION_ID) {
    if (!chatHistories[sessionId]) {
        console.log(`Initializing new chat session for: ${sessionId}`);
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });
        chatHistories[sessionId] = model.startChat({
            history: [
                // Optional: You can prime the chat with system instructions or initial history here
                // { role: "user", parts: [{ text: "You are a helpful and friendly AI assistant." }] },
                // { role: "model", parts: [{ text: "Okay, I understand! How can I assist you today?" }] },
            ],
            generationConfig: {
                // maxOutputTokens: 2048, // Default for gemini-1.5-flash is 8192, gemini-pro 2048
                // temperature: 0.9,
                // topK: 1,
                // topP: 1,
            },
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            ],
        });
    }
    return chatHistories[sessionId];
}

// --- Routes ---
app.post('/chat', async (req, res) => {
    try {
        const userMessage = req.body.message;
        if (!userMessage || typeof userMessage !== 'string' || userMessage.trim() === "") {
            return res.status(400).json({ error: 'Message is required and must be a non-empty string.' });
        }

        // Simple logging of the received message (or its beginning for long messages)
        console.log(`Received message (first 100 chars): ${userMessage.substring(0,100)}...`);

        const chat = getChatSession(); // Using default session for this example
        const result = await chat.sendMessage(userMessage);

        // Check for blocked content
        if (result.response.promptFeedback && result.response.promptFeedback.blockReason) {
            const blockReason = result.response.promptFeedback.blockReason;
            console.warn(`AI response blocked due to: ${blockReason}`);
            let userFriendlyMessage = `Your request was blocked. Reason: ${blockReason}. Please try rephrasing.`;
             if (result.response.candidates && result.response.candidates.length > 0 && result.response.candidates[0].finishReason === 'SAFETY') {
                 userFriendlyMessage = `Your message or the model's response was blocked due to safety concerns (Reason: ${blockReason}). Please try a different prompt.`;
            }
            return res.status(400).json({ error: userFriendlyMessage });
        }

        const aiReply = result.response.text();
        res.json({ reply: aiReply });

    } catch (error) {
        console.error('Error in /chat endpoint:', error);
        let errorMessage = "Sorry, I encountered an error processing your request. Please try again.";
        if (error.response && error.response.promptFeedback && error.response.promptFeedback.blockReason) {
            errorMessage = `Your message was blocked. Reason: ${error.response.promptFeedback.blockReason}. Please rephrase your message.`;
        } else if (error.message) {
            errorMessage = `Server error: ${error.message}`; // More detailed for server logs, generic for client
        }
        res.status(500).json({ error: errorMessage });
    }
});

app.post('/reset-chat', (req, res) => {
    try {
        console.log("Resetting chat history for session:", DEFAULT_SESSION_ID);
        delete chatHistories[DEFAULT_SESSION_ID];
        getChatSession(); // Re-initialize the chat so it's ready with a fresh state
        res.json({ message: 'Chat history reset successfully.' });
    } catch (error) {
        console.error("Error resetting chat:", error);
        res.status(500).json({ error: "Failed to reset chat history." });
    }
});

// Catch-all for serving index.html (if not found by express.static, e.g. root path)
// This ensures your single page app's routing works if you add more complex client-side routes later.
// For now, express.static handles it if index.html is in public/
app.get('*', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});


app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
    console.log(`Frontend should be available at http://localhost:${port}/`);
});