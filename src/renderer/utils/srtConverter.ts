/**
 * Converts transcript segments to SRT format
 */

export interface SRTSegment {
  text: string;
  start: number; // milliseconds
  end: number; // milliseconds
  spk?: number;
}

/**
 * Format milliseconds to SRT timestamp format: HH:MM:SS,mmm
 */
function formatSRTTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const milliseconds = ms % 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}

/**
 * Convert transcript segments to SRT format string
 */
export function convertToSRT(segments: SRTSegment[]): string {
  if (!segments || segments.length === 0) {
    return '';
  }

  const srtBlocks = segments.map((segment, index) => {
    const sequenceNumber = index + 1;
    const startTime = formatSRTTimestamp(segment.start);
    const endTime = formatSRTTimestamp(segment.end);
    const text = segment.text.trim();

    // SRT format:
    // 1
    // 00:00:01,000 --> 00:00:04,000
    // Subtitle text
    // (blank line)
    return `${sequenceNumber}\n${startTime} --> ${endTime}\n${text}\n`;
  });

  return srtBlocks.join('\n');
}

/**
 * Download SRT content as a file
 */
export function downloadSRT(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.srt') ? filename : `${filename}.srt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
