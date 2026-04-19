import { describe, it, expect } from 'vitest';
import { sanitizeFilename, buildObjectKey, MAX_FILE_BYTES, ALLOWED_MIME_TYPES } from '@/lib/evidence-upload';

describe('sanitizeFilename', () => {
  it('keeps alphanumeric, dot, dash, underscore', () => {
    expect(sanitizeFilename('intro-slides_v2.pdf')).toBe('intro-slides_v2.pdf');
  });

  it('replaces unsafe chars with underscore', () => {
    expect(sanitizeFilename('My File (final)!.pdf')).toBe('My_File__final__.pdf');
  });

  it('replaces path separators (dots stay — filename is single component)', () => {
    // Dots remain (they are in the allow-list); only path separators are replaced.
    // Safe because sanitizeFilename output is joined into a fixed path shape, never used as a raw path.
    expect(sanitizeFilename('../../etc/passwd')).toBe('.._.._etc_passwd');
  });

  it('truncates to 120 chars, preserving extension', () => {
    const long = 'a'.repeat(200) + '.pdf';
    const out = sanitizeFilename(long);
    expect(out.length).toBeLessThanOrEqual(120);
    expect(out.endsWith('.pdf')).toBe(true);
  });

  it('returns "file" for empty input', () => {
    expect(sanitizeFilename('')).toBe('file');
    expect(sanitizeFilename('   ')).toBe('file');
  });
});

describe('buildObjectKey', () => {
  it('composes {group_id}/{task_id}/{evidence_id}-{filename}', () => {
    const key = buildObjectKey({
      groupId: '11111111-1111-1111-1111-111111111111',
      taskId:  '22222222-2222-2222-2222-222222222222',
      evidenceId: '33333333-3333-3333-3333-333333333333',
      filename: 'slides.pdf',
    });
    expect(key).toBe(
      '11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222/33333333-3333-3333-3333-333333333333-slides.pdf'
    );
  });

  it('sanitizes the filename component', () => {
    const key = buildObjectKey({
      groupId: 'g', taskId: 't', evidenceId: 'e',
      filename: 'My Slides!.pdf',
    });
    expect(key).toBe('g/t/e-My_Slides_.pdf');
  });
});

describe('constants', () => {
  it('MAX_FILE_BYTES is 4 MB', () => {
    expect(MAX_FILE_BYTES).toBe(4 * 1024 * 1024);
  });

  it('ALLOWED_MIME_TYPES includes the expected set', () => {
    expect(ALLOWED_MIME_TYPES).toContain('image/png');
    expect(ALLOWED_MIME_TYPES).toContain('application/pdf');
    expect(ALLOWED_MIME_TYPES).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(ALLOWED_MIME_TYPES).not.toContain('application/x-msdownload'); // .exe
  });
});
