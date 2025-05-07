{
    "name": "gemini-chatbot",
    "version": "1.0.0",
    "description": "A conversational AI chatbot using Gemini API",
    "main": "server.js",
    "scripts": {
      "start": "node server.js",  // <<< CRUCIAL FOR VERCEL
      "test": "echo \"Error: no test specified\" && exit 1"
    },
    "dependencies": {
      "@google/generative-ai": "^0.x.x", // Use your actual version
      "dotenv": "^16.x.x",             // Use your actual version
      "express": "^4.x.x"              // Use your actual version
    },
    "author": "Subrat",
    "license": "ISC"
  }