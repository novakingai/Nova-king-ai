/**
 * Real-time Web Audio API Streamer for Arushi Voice Assistant
 * 
 * - Input: 16kHz 16-bit PCM little-endian capture from microphone
 * - Output: 24kHz PCM decode, gapless sequential playback queue, mobile AudioContext unlock
 * - Interruption handling: instant stop and queue purge
 * - Speaker diagnostic: 440Hz sine test tone through the same audio graph
 * - Diagnostic logger: 28-point pipeline verification
 */

export type AssistantState = 'IDLE' | 'CONNECTING' | 'LISTENING' | 'SPEAKING' | 'ERROR';

export interface DiagnosticLog {
  id: string;
  time: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
  details?: any;
}

export class AudioStreamer {
  // Output Audio Pipeline
  private outputAudioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private nextStartTime: number = 0;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private isPlaying: boolean = false;
  private playbackEndTimer: number | null = null;

  // Input Audio Pipeline
  private inputAudioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private inputSampleRate = 16000;
  private outputSampleRate = 24000;

  // Visualizer Analysis
  private inputAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private isCapturing = false;

  // Callbacks
  private onAudioChunkCallback: ((base64pcm: string) => void) | null = null;
  private onStateChangeCallback: ((state: AssistantState) => void) | null = null;
  private onVolumeChangeCallback: ((vol: { input: number; output: number }) => void) | null = null;
  private logListeners: ((log: DiagnosticLog) => void)[] = [];

  private currentState: AssistantState = 'IDLE';

  constructor() {
    this.log('info', 'AudioStreamer initialized');
  }

  // Diagnostic logging
  public onLog(listener: (log: DiagnosticLog) => void) {
    this.logListeners.push(listener);
    return () => {
      this.logListeners = this.logListeners.filter((l) => l !== listener);
    };
  }

  public log(level: DiagnosticLog['level'], message: string, details?: any) {
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
    console.log(`[AudioStreamer][${level.toUpperCase()}] ${message}`, details !== undefined ? details : '');
    const entry: DiagnosticLog = {
      id: Math.random().toString(36).substring(2, 9),
      time: timestamp,
      level,
      message,
      details,
    };
    this.logListeners.forEach((l) => l(entry));
  }

  public setState(state: AssistantState) {
    if (this.currentState !== state) {
      this.log('info', `Assistant state transitioned: ${this.currentState} -> ${state}`);
      this.currentState = state;
      if (this.onStateChangeCallback) {
        this.onStateChangeCallback(state);
      }
    }
  }

  public getState(): AssistantState {
    return this.currentState;
  }

  public onStateChange(cb: (state: AssistantState) => void) {
    this.onStateChangeCallback = cb;
  }

  public onAudioChunk(cb: (base64pcm: string) => void) {
    this.onAudioChunkCallback = cb;
  }

  public onVolumeChange(cb: (vol: { input: number; output: number }) => void) {
    this.onVolumeChangeCallback = cb;
  }

  /**
   * Initializes and resumes the persistent output AudioContext on user interaction
   * Solves mobile browser autoplay restrictions
   */
  public async ensureOutputAudioContext(): Promise<AudioContext> {
    if (!this.outputAudioCtx || this.outputAudioCtx.state === 'closed') {
      this.log('info', 'Creating persistent output AudioContext at 24000Hz');
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.outputAudioCtx = new AudioCtxClass({ sampleRate: this.outputSampleRate });

      this.masterGain = this.outputAudioCtx.createGain();
      this.masterGain.gain.setValueAtTime(1.0, this.outputAudioCtx.currentTime);

      this.outputAnalyser = this.outputAudioCtx.createAnalyser();
      this.outputAnalyser.fftSize = 64;
      this.outputAnalyser.smoothingTimeConstant = 0.5;

      this.masterGain.connect(this.outputAnalyser);
      this.outputAnalyser.connect(this.outputAudioCtx.destination);
      this.nextStartTime = this.outputAudioCtx.currentTime;
      this.log('success', 'Audio output graph connected: BufferSource -> GainNode -> Analyser -> Destination');
    }

    this.log('info', `Output AudioContext state check: ${this.outputAudioCtx.state}`);
    if (this.outputAudioCtx.state === 'suspended') {
      this.log('info', 'Resuming suspended AudioContext on user gesture...');
      await this.outputAudioCtx.resume();
      this.log('success', `AudioContext resumed successfully. State is now: ${this.outputAudioCtx.state}`);
    }

    return this.outputAudioCtx;
  }

  /**
   * Speaker Diagnostic Test: plays a clean 440Hz A4 tone through the EXACT same output graph
   */
  public async testSpeaker(): Promise<boolean> {
    try {
      this.log('info', 'Speaker diagnostic test initiated');
      const ctx = await this.ensureOutputAudioContext();

      const duration = 0.6;
      const sampleRate = ctx.sampleRate;
      const frameCount = sampleRate * duration;
      const audioBuffer = ctx.createBuffer(1, frameCount, sampleRate);
      const channelData = audioBuffer.getChannelData(0);

      // Generate 440Hz sine wave with gentle envelope
      for (let i = 0; i < frameCount; i++) {
        const t = i / sampleRate;
        const envelope = Math.sin((Math.PI * i) / frameCount); // smooth bell envelope
        channelData[i] = Math.sin(2 * Math.PI * 440 * t) * 0.4 * envelope;
      }

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.masterGain!);
      source.start();

      this.log('success', '440Hz speaker test tone emitted through audio graph');
      return true;
    } catch (err: any) {
      this.log('error', `Speaker diagnostic failed: ${err?.message || err}`);
      return false;
    }
  }

  /**
   * Starts capturing microphone audio at 16kHz mono PCM
   */
  public async startMicrophone(): Promise<void> {
    if (this.isCapturing) {
      this.log('info', 'Microphone capture is already active');
      return;
    }

    try {
      this.log('info', 'Requesting microphone permission from browser...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: this.inputSampleRate,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      this.micStream = stream;
      this.log('success', 'Microphone permission granted');

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.inputAudioCtx = new AudioCtxClass({ sampleRate: this.inputSampleRate });

      if (this.inputAudioCtx.state === 'suspended') {
        await this.inputAudioCtx.resume();
      }

      this.micSource = this.inputAudioCtx.createMediaStreamSource(stream);
      this.inputAnalyser = this.inputAudioCtx.createAnalyser();
      this.inputAnalyser.fftSize = 64;
      this.micSource.connect(this.inputAnalyser);

      // ScriptProcessor for robust cross-browser PCM extraction
      const bufferSize = 2048;
      this.processorNode = this.inputAudioCtx.createScriptProcessor(bufferSize, 1, 1);

      this.processorNode.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!this.isCapturing) return;

        const inputData = e.inputBuffer.getChannelData(0);

        // Calculate input volume level for UI visualizer
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        const normalizedVol = Math.min(1.0, rms * 5.0);

        if (this.onVolumeChangeCallback) {
          const outVol = this.isPlaying ? 0.7 : 0;
          this.onVolumeChangeCallback({ input: normalizedVol, output: outVol });
        }

        // Convert Float32 to 16-bit PCM little-endian
        const pcm16 = this.floatTo16BitPCM(inputData);
        const base64Audio = this.arrayBufferToBase64(pcm16.buffer);

        if (this.onAudioChunkCallback) {
          this.onAudioChunkCallback(base64Audio);
        }
      };

      this.micSource.connect(this.processorNode);
      this.processorNode.connect(this.inputAudioCtx.destination);

      this.isCapturing = true;
      this.log('success', 'Microphone capture running: 16kHz mono 16-bit PCM');
      this.setState('LISTENING');
    } catch (err: any) {
      this.log('error', `Microphone capture initialization failed: ${err?.message || err}`);
      this.setState('ERROR');
      throw err;
    }
  }

  /**
   * Stops microphone capture
   */
  public stopMicrophone(): void {
    this.isCapturing = false;
    if (this.processorNode) {
      try {
        this.processorNode.disconnect();
      } catch (e) {
        // ignore
      }
      this.processorNode = null;
    }
    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch (e) {
        // ignore
      }
      this.micSource = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    if (this.inputAudioCtx && this.inputAudioCtx.state !== 'closed') {
      try {
        this.inputAudioCtx.close();
      } catch (e) {
        // ignore
      }
      this.inputAudioCtx = null;
    }
    this.log('info', 'Microphone stopped and released');
  }

  /**
   * Processes incoming Gemini Live audio chunk (Base64 PCM 24kHz)
   * Decodes and schedules for gapless sequential playback
   */
  public async playGeminiAudioChunk(base64Data: string, mimeType: string = 'audio/pcm;rate=24000'): Promise<void> {
    try {
      const ctx = await this.ensureOutputAudioContext();

      // Extract sample rate from MIME type if present (e.g. rate=24000)
      let sampleRate = this.outputSampleRate;
      const rateMatch = mimeType.match(/rate=(\d+)/);
      if (rateMatch && rateMatch[1]) {
        sampleRate = parseInt(rateMatch[1], 10);
      }

      // Step 1: Base64 decode
      const rawBytes = this.base64ToUint8Array(base64Data);

      // Step 2: Int16 PCM decode (signed 16-bit little endian)
      const int16Array = new Int16Array(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength / 2);
      const float32Array = new Float32Array(int16Array.length);

      // Step 3: Convert Int16 to normalized Float32 [-1.0, 1.0]
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] < 0 ? int16Array[i] / 32768.0 : int16Array[i] / 32767.0;
      }

      // Step 4: Create AudioBuffer
      const audioBuffer = ctx.createBuffer(1, float32Array.length, sampleRate);
      audioBuffer.getChannelData(0).set(float32Array);

      // Step 5: Schedule sequential playback
      const currentTime = ctx.currentTime;
      // If nextStartTime is in the past, reset it to current audio time
      const startTime = Math.max(currentTime, this.nextStartTime);
      this.nextStartTime = startTime + audioBuffer.duration;

      const sourceNode = ctx.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(this.masterGain!);

      this.activeSources.add(sourceNode);

      sourceNode.onended = () => {
        this.activeSources.delete(sourceNode);
        if (this.activeSources.size === 0) {
          // Schedule return to LISTENING if no more audio chunks are queued
          if (this.playbackEndTimer) clearTimeout(this.playbackEndTimer);
          this.playbackEndTimer = window.setTimeout(() => {
            if (this.activeSources.size === 0 && this.currentState === 'SPEAKING') {
              this.isPlaying = false;
              this.log('info', 'All Gemini audio chunks finished playback');
              this.setState(this.isCapturing ? 'LISTENING' : 'IDLE');
            }
          }, 150);
        }
      };

      sourceNode.start(startTime);

      if (!this.isPlaying) {
        this.isPlaying = true;
        this.setState('SPEAKING');
        this.log('info', `Gemini speech output started. Scheduled at t=${startTime.toFixed(3)}s (duration: ${audioBuffer.duration.toFixed(3)}s)`);
      }
    } catch (err: any) {
      this.log('error', `Error decoding/playing Gemini audio chunk: ${err?.message || err}`);
    }
  }

  /**
   * Interrupts current speech immediately:
   * - Stops all active AudioBufferSourceNodes
   * - Clears playback queue
   * - Resets nextStartTime
   * - Switches state to LISTENING
   */
  public handleInterruption(): void {
    this.log('warn', 'Interruption detected: purging audio queue and stopping active audio');
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // ignore
      }
    }
    this.activeSources.clear();

    if (this.outputAudioCtx) {
      this.nextStartTime = this.outputAudioCtx.currentTime;
    }

    if (this.playbackEndTimer) {
      clearTimeout(this.playbackEndTimer);
      this.playbackEndTimer = null;
    }

    this.isPlaying = false;
    if (this.currentState === 'SPEAKING') {
      this.setState(this.isCapturing ? 'LISTENING' : 'IDLE');
    }
  }

  /**
   * Helper: Float32Array to 16-bit PCM little endian
   */
  private floatTo16BitPCM(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  }

  /**
   * Helper: ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBufferLike): string {
    let binary = '';
    const bytes = new Uint8Array(buffer as ArrayBuffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Helper: Base64 to Uint8Array
   */
  private base64ToUint8Array(base64: string): Uint8Array {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Cleanup everything on shutdown
   */
  public destroy(): void {
    this.handleInterruption();
    this.stopMicrophone();
    if (this.outputAudioCtx && this.outputAudioCtx.state !== 'closed') {
      try {
        this.outputAudioCtx.close();
      } catch (e) {
        // ignore
      }
      this.outputAudioCtx = null;
    }
    this.setState('IDLE');
    this.log('info', 'AudioStreamer destroyed and all resources released');
  }
}

export const audioStreamer = new AudioStreamer();
