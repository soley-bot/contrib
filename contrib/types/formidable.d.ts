/**
 * Minimal ambient type declaration for formidable@3.x (no bundled types).
 * Only the surface area used by pages/api/evidence/create.ts is declared.
 */
declare module 'formidable' {
  interface FormidableOptions {
    maxFileSize?: number;
    keepExtensions?: boolean;
    multiples?: boolean;
  }

  interface File {
    filepath: string;
    originalFilename: string | null;
    mimetype: string | null;
    size: number;
  }

  type Fields = Record<string, string[]>;
  type Files = Record<string, File | File[]>;
  type ParseCallback = (err: Error | null, fields: Fields, files: Files) => void;

  interface IncomingForm {
    parse(req: unknown, cb: ParseCallback): void;
  }

  function formidable(options?: FormidableOptions): IncomingForm;
  export default formidable;
  export { File, Fields, Files, FormidableOptions, IncomingForm };
}
