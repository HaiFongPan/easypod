import { BaseTranscriptConverter } from '../TranscriptConverter';
import {
  FunasrRawData,
  SentenceInfo,
  RawTranscriptData,
  FunasrSentenceInfo,
} from '../../../types/transcript';

export class FunasrConverter extends BaseTranscriptConverter {
  convertToSentenceInfo(raw: RawTranscriptData): SentenceInfo[] {
    const funasrData = raw as FunasrRawData;

    // FunASR's sentence_info is already in standard format
    const sentences = funasrData.sentence_info.map((item: FunasrSentenceInfo) => ({
      text: item.text,
      start: item.start,
      end: item.end,
      timestamp: item.timestamp,
      spk: item.spk || 0,
    }));

    return this.mergeSentences(sentences);
  }

  extractText(raw: RawTranscriptData): string {
    const funasrData = raw as FunasrRawData;
    return funasrData.text;
  }

  calculateSpeakerCount(raw: RawTranscriptData): number {
    const funasrData = raw as FunasrRawData;

    if (!funasrData.sentence_info || funasrData.sentence_info.length === 0) {
      return 1;
    }

    const maxSpk = Math.max(...funasrData.sentence_info.map((s: FunasrSentenceInfo) => s.spk || 0));
    return maxSpk + 1; // spk starts from 0
  }
}
