import { TranscriptService } from '../../types/transcript';
import { VoiceToTextService } from './VoiceToTextService';

/**
 * Factory for VoiceToText services
 */
export class VoiceToTextFactory {
  private static services: Map<TranscriptService, VoiceToTextService> = new Map();

  /**
   * Register a service instance
   */
  static register(service: VoiceToTextService): void {
    this.services.set(service.serviceName, service);
  }

  /**
   * Get service instance by name
   */
  static getService(serviceName: TranscriptService): VoiceToTextService {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Voice to text service not found: ${serviceName}`);
    }
    return service;
  }

  /**
   * Get all registered services
   */
  static getAllServices(): VoiceToTextService[] {
    return Array.from(this.services.values());
  }

  /**
   * Check if a service is registered
   */
  static hasService(serviceName: TranscriptService): boolean {
    return this.services.has(serviceName);
  }

  /**
   * Unregister a service
   */
  static unregister(serviceName: TranscriptService): void {
    this.services.delete(serviceName);
  }

  /**
   * Clear all registered services
   */
  static clear(): void {
    this.services.clear();
  }
}
