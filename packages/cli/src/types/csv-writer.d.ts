/**
 * Type declarations for csv-writer module
 */

declare module 'csv-writer' {
  export interface ObjectCsvWriterParams {
    path: string;
    header: Array<{ id: string; title: string }>;
    append?: boolean;
    encoding?: string;
  }

  export interface ArrayCsvWriterParams {
    path: string;
    header?: string[];
  }

  export interface CsvWriter<T> {
    writeRecords(records: T[]): Promise<void>;
  }

  export function createObjectCsvWriter<T = any>(params: ObjectCsvWriterParams): CsvWriter<T>;

  export function createArrayCsvWriter<T extends any[] = any[]>(
    params: ArrayCsvWriterParams
  ): CsvWriter<T>;
}
