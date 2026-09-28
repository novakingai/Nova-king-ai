/**
 * Gemini Live Client Manager
 * Bridges WebSocket connection between browser client and server.ts
 * Manages audio streaming, live function calling, transcriptions, and session state.
 */

import { audioStreamer, AssistantState } from './audioStreamer';
import { deviceBridge, ActionResult } from './deviceBridge';

export interface TranscriptEntry {
  id: string;
  sender: 'user' | 'arushi';
  text: string;
  timestamp: string;
}

export interface LiveClientEvents {
  onStateChange?: (state: AssistantState) => void;
  onTranscript?: (entry: TranscriptEntry) => void;
  onAction?: (action: ActionResult) => void;
  onError?: (error: string) => void;
}

export class LiveClient {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private events: LiveClientEvents = {};
  private currentInputTranscript = '';
  private currentOutputTranscript = '';

  constructor() {
    // Hook audio streamer state
    audioStreamer.onStateChange((state) => {
      if (this.events.onStateChange) {
        this.events.onStateChange(state);
      }
    });

    // Wire device bridge listener
    deviceBridge.onActionExecuted((result) => {
      if (this.events.onAction) {
        this.events.onAction(result);
      }
    });

    // Wire audio chunks captured by mic to send over WebSocket
    audioStreamer.onAudioChunk((base64pcm) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: 'audio',
            data: base64pcm,
            mimeType: 'audio/pcm;rate=16000',
          })
        );
      }
    });
  }

  public setEvents(events: LiveClientEvents) {
    this.events = events;
  }

  public async start(): Promise<void> {
    audioStreamer.log('info', 'Starting Arushi session...');
    audioStreamer.setState('CONNECTING');

    // 1. Mobile unlock AudioContext first (requires user gesture)
    try {
      await audioStreamer.ensureOutputAudioContext();
    } catch (err: any) {
      audioStreamer.log('error', `Failed to initialize AudioContext: ${err?.message || err}`);
    }

    // 2. Open WebSocket connection to full-stack server
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/live-ws`;

    audioStreamer.log('info', `Connecting to live backend socket at: ${wsUrl}`);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = async () => {
        audioStreamer.log('success', 'Backend WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;

        // 3. Start microphone capture
        try {
          await audioStreamer.startMicrophone();
        } catch (micErr: any) {
          audioStreamer.log('error', `Microphone access failed: ${micErr?.message || micErr}`);
          audioStreamer.setState('ERROR');
          if (this.events.onError) {
            this.events.onError('Microphone permission was denied or is unavailable. Please grant microphone access in browser settings.');
          }
        }
      };

      this.ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'connected') {
            audioStreamer.log('success', `Gemini Live connected with model: ${msg.model}`);
            audioStreamer.setState('LISTENING');
          } else if (msg.type === 'audio' && msg.data) {
            // Received audio chunk from Gemini
            await audioStreamer.playGeminiAudioChunk(msg.data, msg.mimeType);
          } else if (msg.type === 'interrupted') {
            audioStreamer.log('info', 'Received interrupted signal from Gemini Live');
            audioStreamer.handleInterruption();
          } else if (msg.type === 'input_transcription') {
            const text = msg.text || '';
            this.currentInputTranscript += ' ' + text;
            this.emitTranscript('user', text.trim());
          } else if (msg.type === 'output_transcription') {
            const text = msg.text || '';
            this.currentOutputTranscript += ' ' + text;
            this.emitTranscript('arushi', text.trim());
          } else if (msg.type === 'tool_call' && msg.functionCalls) {
            audioStreamer.log('info', `Handling ${msg.functionCalls.length} tool calls from Gemini`);
            await this.handleToolCalls(msg.functionCalls);
          } else if (msg.type === 'error') {
            audioStreamer.log('error', `Server error: ${msg.error}`);
            if (this.events.onError) {
              this.events.onError(msg.error);
            }
          } else if (msg.type === 'disconnected') {
            audioStreamer.log('warn', `Server disconnected: ${msg.reason}`);
            this.stop();
          }
        } catch (err: any) {
          audioStreamer.log('error', `Failed to parse server message: ${err?.message || err}`);
        }
      };

      this.ws.onerror = (err) => {
        audioStreamer.log('error', 'WebSocket error occurred', err);
        if (this.events.onError) {
          this.events.onError('Connection error to Gemini Live backend.');
        }
      };

      this.ws.onclose = () => {
        audioStreamer.log('info', 'Backend WebSocket closed');
        this.isConnected = false;
        if (audioStreamer.getState() !== 'ERROR') {
          audioStreamer.setState('IDLE');
        }
      };
    } catch (err: any) {
      audioStreamer.log('error', `WebSocket creation failed: ${err?.message || err}`);
      audioStreamer.setState('ERROR');
    }
  }

  private emitTranscript(sender: 'user' | 'arushi', text: string) {
    if (!text) return;
    if (this.events.onTranscript) {
      this.events.onTranscript({
        id: Math.random().toString(36).substring(2, 9),
        sender,
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });
    }
  }

  private async handleToolCalls(functionCalls: any[]) {
    const functionResponses: any[] = [];

    for (const call of functionCalls) {
      audioStreamer.log('info', `Executing tool: ${call.name}`, call.args);
      const actionResult = await deviceBridge.executeTool(call.name, call.args || {});

      functionResponses.push({
        id: call.id,
        response: {
          output: actionResult,
        },
      });
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      audioStreamer.log('info', 'Sending tool execution responses back to Gemini Live:', functionResponses);
      this.ws.send(
        JSON.stringify({
          type: 'tool_response',
          functionResponses,
        })
      );
    }
  }

  public stop(): void {
    audioStreamer.log('info', 'Stopping Arushi session...');
    audioStreamer.stopMicrophone();
    audioStreamer.handleInterruption();

    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        // ignore
      }
      this.ws = null;
    }

    this.isConnected = false;
    audioStreamer.setState('IDLE');
  }

  public isSessionActive(): boolean {
    return this.isConnected && audioStreamer.getState() !== 'IDLE' && audioStreamer.getState() !== 'ERROR';
  }
}

export const liveClient = new LiveClient();
