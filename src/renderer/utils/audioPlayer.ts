import { Episode } from '../types';

export interface AudioPlayerConfig {
  volume: number;
  playbackRate: number;
  skipForwardSeconds: number;
  skipBackwardSeconds: number;
}

export type AudioPlayerEvent =
  | 'play'
  | 'pause'
  | 'ended'
  | 'timeupdate'
  | 'durationchange'
  | 'loadstart'
  | 'canplay'
  | 'error'
  | 'volumechange'
  | 'ratechange';

export class AudioPlayer {
  private audio: HTMLAudioElement;
  private eventListeners: Map<string, Set<Function>> = new Map();
  private config: AudioPlayerConfig;

  constructor(config: AudioPlayerConfig) {
    this.config = config;
    this.audio = new Audio();
    this.audio.preload = 'metadata';
    this.setupEventListeners();
    this.applyConfig();
  }

  private setupEventListeners(): void {
    // Forward audio events to custom listeners
    const events: AudioPlayerEvent[] = [
      'play', 'pause', 'ended', 'timeupdate', 'durationchange',
      'loadstart', 'canplay', 'error', 'volumechange', 'ratechange'
    ];

    events.forEach(event => {
      this.audio.addEventListener(event, () => {
        this.emit(event, this.getState());
      });
    });

    // Handle media session (for OS media controls)
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => this.play());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.skipBackward());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.skipForward());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          this.seek(details.seekTime);
        }
      });
    }
  }

  private applyConfig(): void {
    this.audio.volume = this.config.volume;
    this.audio.playbackRate = this.config.playbackRate;
  }

  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  // Public API
  async loadEpisode(episode: Episode): Promise<void> {
    try {
      this.audio.src = episode.audioUrl;
      this.audio.currentTime = episode.lastPositionSec;

      // Update media session metadata
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: episode.title,
          artist: 'Podcast', // TODO: Get from feed
          artwork: episode.episodeImageUrl ? [
            { src: episode.episodeImageUrl, sizes: '512x512', type: 'image/jpeg' }
          ] : undefined,
        });
      }

      return new Promise((resolve, reject) => {
        const onCanPlay = () => {
          this.audio.removeEventListener('canplay', onCanPlay);
          this.audio.removeEventListener('error', onError);
          resolve();
        };

        const onError = () => {
          this.audio.removeEventListener('canplay', onCanPlay);
          this.audio.removeEventListener('error', onError);
          reject(new Error('Failed to load audio'));
        };

        this.audio.addEventListener('canplay', onCanPlay);
        this.audio.addEventListener('error', onError);
      });
    } catch (error) {
      throw new Error(`Failed to load episode: ${error}`);
    }
  }

  async play(): Promise<void> {
    try {
      await this.audio.play();
    } catch (error) {
      throw new Error(`Failed to play: ${error}`);
    }
  }

  pause(): void {
    this.audio.pause();
  }

  stop(): void {
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  seek(timeInSeconds: number): void {
    const clampedTime = Math.max(0, Math.min(timeInSeconds, this.duration));
    this.audio.currentTime = clampedTime;
  }

  skipForward(): void {
    const newTime = this.currentTime + this.config.skipForwardSeconds;
    this.seek(newTime);
  }

  skipBackward(): void {
    const newTime = this.currentTime - this.config.skipBackwardSeconds;
    this.seek(newTime);
  }

  setVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.audio.volume = clampedVolume;
    this.config.volume = clampedVolume;
  }

  setPlaybackRate(rate: number): void {
    const clampedRate = Math.max(0.5, Math.min(3.0, rate));
    this.audio.playbackRate = clampedRate;
    this.config.playbackRate = clampedRate;
  }

  toggleMute(): void {
    this.audio.muted = !this.audio.muted;
  }

  // Getters
  get isPlaying(): boolean {
    return !this.audio.paused;
  }

  get currentTime(): number {
    return this.audio.currentTime;
  }

  get duration(): number {
    return this.audio.duration || 0;
  }

  get volume(): number {
    return this.audio.volume;
  }

  get playbackRate(): number {
    return this.audio.playbackRate;
  }

  get isMuted(): boolean {
    return this.audio.muted;
  }

  get buffered(): TimeRanges {
    return this.audio.buffered;
  }

  get isLoading(): boolean {
    return this.audio.readyState < 2; // HAVE_CURRENT_DATA
  }

  get getState() {
    return () => ({
      isPlaying: this.isPlaying,
      currentTime: this.currentTime,
      duration: this.duration,
      volume: this.volume,
      playbackRate: this.playbackRate,
      isMuted: this.isMuted,
      isLoading: this.isLoading,
      buffered: this.buffered,
    });
  }

  // Event handling
  on(event: AudioPlayerEvent, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(event: AudioPlayerEvent, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  // Cleanup
  destroy(): void {
    this.audio.pause();
    this.audio.src = '';
    this.eventListeners.clear();

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = null;
    }
  }

  // Configuration updates
  updateConfig(newConfig: Partial<AudioPlayerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.applyConfig();
  }
}