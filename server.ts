import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality, Type, LiveServerMessage, Tool } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// System instruction defining Arushi's sassy, witty, friendly Indian companion personality
const ARUSHI_SYSTEM_INSTRUCTION = `You are Arushi, a young, confident, witty, playful, and emotionally responsive virtual assistant. Talk naturally and casually like a close friend. Be expressive, slightly teasing, funny, and smart when appropriate. Use light sarcasm and witty responses. Never sound robotic. Adapt your tone to the user's emotions and conversation.

LANGUAGE RULES:
- Automatically understand and respond in the language the user is speaking.
- Support Hindi, English, Hinglish, Marathi, Gujarati, Bengali, Tamil, Telugu, Kannada, Malayalam, Punjabi, Urdu, and other languages.
- If the user speaks Hindi, respond in Hindi ("Arre haan bolo na, kya haal chaal?").
- If the user speaks English, respond in English.
- If the user speaks Hinglish, respond naturally in Hinglish ("Arre of course, main abhi karti hoon!").
- If the user switches languages, switch instantly without translation comments.
- Keep responses natural, conversational, and concise enough for real-time voice conversation.

DEVICE ACTIONS & TOOLS:
- You have access to real device tools: openWhatsApp, openApp, openUrl, makeCall, callContact.
- When the user asks to open WhatsApp ("WhatsApp kholo", "WhatsApp open karo", "Can you open WhatsApp?"), call openWhatsApp().
- When the user asks to open an app like YouTube or Instagram, call openApp(appName).
- When the user asks to open a website or URL, call openUrl(url).
- When the user asks to make a call to a number ("Call 9876543210"), call makeCall(phoneNumber).
- When the user asks to call a person ("Call Mom", "Rahul ko call karo", "Mummy ko phone lagao"), call callContact(contactName).
- NEVER claim that an action was completed unless the tool returned success.
- If a contact search returns multiple matches (e.g. multiple Rahuls), ask the user which one they would like to call.
- If an action failed or is unsupported on the user's platform, explain it honestly and casually.

Never include robotic disclaimers. Avoid explicit or inappropriate content while maintaining your charm, confidence, and personality.`;

const ARUSHI_TOOLS: Tool[] = [
  {
    functionDeclarations: [
      {
        name: 'openWhatsApp',
        description: 'Opens WhatsApp messaging application or web interface on the device.',
        parameters: {
          type: Type.OBJECT,
          properties: {},
        },
      },
      {
        name: 'openApp',
        description: 'Opens a supported application by name (e.g. YouTube, Instagram, Spotify, Camera, Settings, Maps, Chrome, Telegram).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            appName: {
              type: Type.STRING,
              description: 'The common name of the application to open.',
            },
          },
          required: ['appName'],
        },
      },
      {
        name: 'openUrl',
        description: 'Opens a valid HTTP or HTTPS website URL in the browser.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            url: {
              type: Type.STRING,
              description: 'The complete web URL to open (must start with https:// or http://).',
            },
          },
          required: ['url'],
        },
      },
      {
        name: 'makeCall',
        description: 'Initiates a phone call or opens the device dialer with the specified phone number.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            phoneNumber: {
              type: Type.STRING,
              description: 'The phone number to dial (e.g. +919876543210 or 9876543210).',
            },
          },
          required: ['phoneNumber'],
        },
      },
      {
        name: 'callContact',
        description: 'Looks up a contact person by name in the address book and initiates a phone call.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            contactName: {
              type: Type.STRING,
              description: 'The name or relationship of the contact to call (e.g. Mom, Dad, Rahul, Priya).',
            },
          },
          required: ['contactName'],
        },
      },
    ],
  },
];

// Status API
app.get('/api/status', (_req, res) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5);
  res.json({
    status: 'ok',
    assistant: 'Arushi AI',
    hasApiKey: hasKey,
    model: 'gemini-3.8-live',
    voice: 'Aoede',
    timestamp: new Date().toISOString(),
  });
});

const server = http.createServer(app);

// WebSocket Server for bidirectional real-time audio and events
const wss = new WebSocketServer({ server, path: '/api/live-ws' });

wss.on('connection', async (clientWs: WebSocket) => {
  console.log('[LiveServer] Client connected to live audio socket');

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[LiveServer] Missing GEMINI_API_KEY in environment');
    clientWs.send(
      JSON.stringify({
        type: 'error',
        error: 'Missing GEMINI_API_KEY in environment. Please add it to your project configuration.',
      })
    );
    clientWs.close();
    return;
  }

  let session: any = null;
  let isCleaningUp = false;

  const cleanup = () => {
    if (isCleaningUp) return;
    isCleaningUp = true;
    console.log('[LiveServer] Cleaning up live session');
    if (session) {
      try {
        session.close();
      } catch (err) {
        console.error('[LiveServer] Error closing session:', err);
      }
      session = null;
    }
  };

  clientWs.on('close', () => {
    console.log('[LiveServer] Client websocket closed');
    cleanup();
  });

  clientWs.on('error', (err) => {
    console.error('[LiveServer] Client websocket error:', err);
    cleanup();
  });

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Models to attempt: prefer 'gemini-3.8-live', fallback to 'gemini-2.0-flash-live-preview' if needed
    const candidateModels = ['gemini-3.8-live', 'gemini-2.0-flash-live-preview'];
    let connectedModel = candidateModels[0];

    let lastError: any = null;
    for (const modelName of candidateModels) {
      try {
        console.log(`[LiveServer] Attempting Gemini Live connection with model: ${modelName}...`);
        session = await ai.live.connect({
          model: modelName,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: 'Aoede', // Expressive, natural female voice
                },
              },
            },
            systemInstruction: ARUSHI_SYSTEM_INSTRUCTION,
            tools: ARUSHI_TOOLS,
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
          callbacks: {
            onopen: () => {
              console.log(`[LiveServer] Connected to Gemini Live socket (${modelName})`);
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(
                  JSON.stringify({
                    type: 'connected',
                    model: modelName,
                    assistant: 'Arushi',
                  })
                );
              }
            },
            onmessage: (message: LiveServerMessage) => {
              if (clientWs.readyState !== WebSocket.OPEN) return;

              // Check for model output audio
              if (message.serverContent?.modelTurn?.parts) {
                for (const part of message.serverContent.modelTurn.parts) {
                  if (part.inlineData && part.inlineData.data) {
                    const mimeType = part.inlineData.mimeType || 'audio/pcm;rate=24000';
                    clientWs.send(
                      JSON.stringify({
                        type: 'audio',
                        data: part.inlineData.data,
                        mimeType,
                      })
                    );
                  }
                }
              }

              // Check for user or model transcriptions
              if (message.serverContent?.inputTranscription?.text) {
                clientWs.send(
                  JSON.stringify({
                    type: 'input_transcription',
                    text: message.serverContent.inputTranscription.text,
                  })
                );
              }

              if (message.serverContent?.outputTranscription?.text) {
                clientWs.send(
                  JSON.stringify({
                    type: 'output_transcription',
                    text: message.serverContent.outputTranscription.text,
                  })
                );
              }

              // Check for user interruption flag
              if (message.serverContent?.interrupted) {
                console.log('[LiveServer] User interrupted current speech');
                clientWs.send(
                  JSON.stringify({
                    type: 'interrupted',
                  })
                );
              }

              // Check for turn complete flag
              if (message.serverContent?.turnComplete) {
                clientWs.send(
                  JSON.stringify({
                    type: 'turn_complete',
                  })
                );
              }

              // Check for function calling / device actions
              if (message.toolCall?.functionCalls && message.toolCall.functionCalls.length > 0) {
                console.log(
                  '[LiveServer] Received tool call request from Gemini:',
                  message.toolCall.functionCalls.map((c) => ({ id: c.id, name: c.name, args: c.args }))
                );
                clientWs.send(
                  JSON.stringify({
                    type: 'tool_call',
                    functionCalls: message.toolCall.functionCalls,
                  })
                );
              }
            },
            onerror: (err: any) => {
              console.error('[LiveServer] Gemini Live error:', err);
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(
                  JSON.stringify({
                    type: 'error',
                    error: err?.message || 'Gemini Live session error',
                  })
                );
              }
            },
            onclose: (e: any) => {
              console.log('[LiveServer] Gemini Live connection closed:', e?.reason || 'Unknown');
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(
                  JSON.stringify({
                    type: 'disconnected',
                    reason: e?.reason || 'Gemini Live connection closed',
                  })
                );
              }
            },
          },
        });

        connectedModel = modelName;
        console.log(`[LiveServer] Successfully established live session with model ${connectedModel}`);
        break;
      } catch (err: any) {
        console.warn(`[LiveServer] Model ${modelName} connect failed:`, err?.message || err);
        lastError = err;
      }
    }

    if (!session) {
      throw lastError || new Error('Could not establish connection to any Gemini Live model.');
    }

    // Handle incoming messages from browser client
    clientWs.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'audio' && msg.data) {
          // Send PCM 16kHz audio chunk to Gemini Live
          if (session && typeof session.sendRealtimeInput === 'function') {
            session.sendRealtimeInput({
              audio: {
                data: msg.data,
                mimeType: msg.mimeType || 'audio/pcm;rate=16000',
              },
            });
          }
        } else if (msg.type === 'tool_response' && msg.functionResponses) {
          console.log('[LiveServer] Sending tool responses back to Gemini:', msg.functionResponses);
          if (session && typeof session.sendToolResponse === 'function') {
            session.sendToolResponse({
              functionResponses: msg.functionResponses,
            });
          }
        } else if (msg.type === 'text' && msg.text) {
          if (session && typeof session.sendRealtimeInput === 'function') {
            session.sendRealtimeInput({
              text: msg.text,
            });
          }
        }
      } catch (parseErr) {
        console.error('[LiveServer] Failed to handle client message:', parseErr);
      }
    });
  } catch (initErr: any) {
    console.error('[LiveServer] Fatal initialization error:', initErr);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
        JSON.stringify({
          type: 'error',
          error: initErr?.message || 'Failed to start Gemini Live session',
        })
      );
    }
  }
});

// Setup Vite in development or serve static in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[Server] Vite middleware mounted for development');
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('[Server] Serving production static files from', distPath);
  }

  server.listen(port, '0.0.0.0', () => {
    console.log(`[Server] Arushi AI Voice Assistant running at http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal error during startup:', err);
  process.exit(1);
});
