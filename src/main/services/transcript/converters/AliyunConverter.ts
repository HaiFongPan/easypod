import { BaseTranscriptConverter } from "../TranscriptConverter";
import {
  AliyunRawData,
  RawTranscriptData,
  SentenceInfo,
  AliyunSentence,
} from "../../../types/transcript";

/**
 * Convert Aliyun transcription payload into the unified subtitle structure.
 */
export class AliyunConverter extends BaseTranscriptConverter {
  convertToSentenceInfo(raw: RawTranscriptData): SentenceInfo[] {
    const data = raw as AliyunRawData;
    const sentences: SentenceInfo[] = [];

    for (const transcript of data.transcripts ?? []) {
      for (const sentence of transcript.sentences ?? []) {
        sentences.push({
          text: sentence.text,
          start: sentence.begin_time,
          end: sentence.end_time,
          timestamp: this.extractWordTimestamps(sentence),
          spk: this.resolveSpeakerId(transcript.channel_id, sentence.speaker_id),
        });
      }
    }

    return this.mergeSentences(sentences);
  }

  extractText(raw: RawTranscriptData): string {
    const data = raw as AliyunRawData;
    return (data.transcripts ?? [])
      .map((transcript) => transcript.text)
      .filter(Boolean)
      .join("\n");
  }

  calculateSpeakerCount(raw: RawTranscriptData): number {
    const data = raw as AliyunRawData;
    const speakerIds = new Set<number>();

    for (const transcript of data.transcripts ?? []) {
      if (typeof transcript.channel_id === "number") {
        speakerIds.add(transcript.channel_id);
      }

      for (const sentence of transcript.sentences ?? []) {
        if (typeof sentence.speaker_id === "number") {
          speakerIds.add(sentence.speaker_id);
        }
      }
    }

    return speakerIds.size || 1;
  }

  private extractWordTimestamps(sentence: AliyunSentence): number[][] {
    if (!sentence.words?.length) {
      return [[sentence.begin_time, sentence.end_time]];
    }

    return sentence.words.map((word) => [word.begin_time, word.end_time]);
  }

  private resolveSpeakerId(channelId?: number, speakerId?: number): number {
    if (typeof speakerId === "number") {
      return speakerId;
    }
    if (typeof channelId === "number") {
      return channelId;
    }
    return 0;
  }
}
