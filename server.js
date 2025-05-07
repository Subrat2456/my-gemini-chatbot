// server.js
require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai'); // Import HarmBlockThreshold

const app = express();
const port = process.env.PORT || 3000;

// --- Gemini API Configuration ---
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("Error: GEMINI_API_KEY is not set. Please check your .env file.");
    process.exit(1);
}
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-latest" // Or "gemini-pro"
});

// --- Safety Settings (Optional but Recommended) ---
const safetySettings = [
    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
];

// --- Persistent Chat Instance ---
let chatSession; // Will hold our ongoing chat

async function initializeChat() {
    console.log("Initializing new chat session...");
    // System instruction to guide the AI's behavior and persona
    const systemInstruction = `You are a highly intelligent and helpful AI assistant, similar to the one the user is accustomed to interacting with.
Your primary goal is to assist users with their queries, provide comprehensive information, generate text, and engage in natural conversation.
If asked to generate code, please ensure it is enclosed in markdown code blocks (e.g., \`\`\`python ... \`\`\`).
Maintain a friendly, professional, and informative tone.
Remember the context of our current conversation to provide relevant follow-up responses.
If you are unsure about something, it's okay to say so.
You can refer to content from uploaded files if the user provides them and asks questions about them.
Be ready to handle a variety of tasks like summarization, explanation, creative writing, and problem-solving.`;

    chatSession = model.startChat({
        history: [
            { role: "user", parts: [{ text: systemInstruction }] },
            { role: "model", parts: [{ text: "Understood! I am ready to assist you. How can I help you today?" }] }
        ],
        generationConfig: {
            maxOutputTokens: 2000, // Increased for longer conversations
            // temperature: 0.7, // Adjust for creativity vs. factuality
        },
        safetySettings: safetySettings // Apply safety settings
    });
    console.log("Chat session initialized.");
}

initializeChat(); // Initialize chat when the server starts

// --- Middleware ---
app.use(express.json({ limit: '10mb' })); // Increase limit for file content
app.use(express.static('public'));

// --- API Endpoint for Chat ---
app.post('/chat', async (req, res) => {
    try {
        if (!chatSession) {
            // This should ideally not happen if initializeChat is called on server start
            // and after /reset-chat. But as a fallback:
            console.warn("Chat session was not initialized. Re-initializing.");
            await initializeChat();
            if (!chatSession) { // Still not initialized after attempt
                 return res.status(500).json({ error: "Chat session could not be initialized. Please try again." });
            }
        }

        const userInput = req.body.message;
        if (!userInput) {
            return res.status(400).json({ error: "Message is required" });
        }

        console.log('User input:', userInput.substring(0, 100) + (userInput.length > 100 ? "..." : "")); // Log truncated input

        const result = await chatSession.sendMessage(userInput);
        const response = await result.response;
        const aiResponseText = response.text();

        // console.log('AI Response:', aiResponseText.substring(0,100) + "...");
        res.json({ reply: aiResponseText });

    } catch (error) {
        console.error('Error processing chat:', error);
        let errorMessage = "An error occurred while processing your request.";
        let statusCode = 500;

        if (error.message) {
            if (error.message.includes('API key not valid')) {
                errorMessage = "Invalid API Key. Please check your configuration.";
                statusCode = 401;
            } else if (error.message.includes('quota')) {
                errorMessage = "API Quota exceeded. Please check your Google Cloud Console.";
                statusCode = 429;
            } else if (error.message.includes('SAFETY')) {
                // This can happen if the input or output violates safety settings
                errorMessage = "The response was blocked due to safety settings. Please rephrase your request or try a different topic.";
                statusCode = 400; // Bad Request, as the input might have triggered it
            } else if (error.response && error.response.promptFeedback && error.response.promptFeedback.blockReason) {
                // More specific safety feedback
                errorMessage = `Request blocked: ${error.response.promptFeedback.blockReason}. Please modify your prompt.`;
                statusCode = 400;
            }
        }
        res.status(statusCode).json({ error: errorMessage });
    }
});

// --- Endpoint to Reset Chat (New Feature) ---
app.post('/reset-chat', async (req, res) => {
    console.log("Resetting chat session as per user request...");
    await initializeChat(); // Re-initialize with the system prompt
    res.json({ message: "Chat session has been reset successfully." });
});


// --- Start Server ---
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
