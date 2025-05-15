import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Use the same PDF parser as pdf-processor.ts
const PDFParser = require('pdf2json');

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Create Supabase admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Process a PDF file by extracting text
 * This uses pdf2json which is more compatible with Next.js
 */
export async function processPDF(
  fileBuffer: ArrayBuffer,
  fileName: string,
  userId: string,
  options: {
    maxPages?: number;
  } = {}
): Promise<{
  success: boolean;
  text?: string;
  pageCount?: number;
  error?: string;
  processingId: string;
}> {
  const processingId = uuidv4();
  const startTime = Date.now();

  // Default options
  const { maxPages = 20 } = options;

  try {
    console.log(
      `[PDF-PROCESSOR] Starting PDF processing for file: ${fileName}`
    );

    // Log processing start
    await logProcessingEvent({
      processingId,
      userId,
      fileName,
      fileSize: fileBuffer.byteLength,
      event: 'processing_started',
      details: `Started processing ${fileName} (${(
        fileBuffer.byteLength /
        (1024 * 1024)
      ).toFixed(2)}MB)`,
    });

    // Convert ArrayBuffer to Buffer
    const buffer = Buffer.from(fileBuffer);

    // Create a promise to handle the PDF parsing
    const result = await new Promise<{ text: string; pageCount: number }>(
      (resolve, reject) => {
        const pdfParser = new PDFParser(null, 1);

        pdfParser.on('pdfParser_dataError', (errData: any) => {
          console.error(
            `[PDF-PROCESSOR] PDF parsing error:`,
            errData.parserError
          );
          reject(new Error(`PDF parsing failed: ${errData.parserError}`));
        });

        pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
          try {
            // Extract text from all pages
            let fullText = '';
            let pageCount = 0;

            if (pdfData && pdfData.Pages) {
              pageCount = pdfData.Pages.length;

              // Limit pages to process
              const pagesToProcess = Math.min(pageCount, maxPages);

              for (let pageIndex = 0; pageIndex < pagesToProcess; pageIndex++) {
                const page = pdfData.Pages[pageIndex];
                let pageText = '';

                if (page.Texts) {
                  page.Texts.forEach((text: any) => {
                    if (text.R && text.R[0] && text.R[0].T) {
                      // Decode the text properly
                      const decodedText = decodeURIComponent(text.R[0].T);
                      pageText += decodedText + ' ';
                    }
                  });
                }

                if (pageText) {
                  fullText += `--- Page ${pageIndex + 1} ---\n${pageText}\n\n`;
                }
              }
            }

            if (!fullText.trim()) {
              reject(new Error('No text could be extracted from the PDF.'));
            } else {
              resolve({ text: fullText, pageCount });
            }
          } catch (error) {
            reject(error);
          }
        });

        // Parse the PDF buffer
        pdfParser.parseBuffer(buffer);
      }
    );

    console.log(
      `[PDF-PROCESSOR] Successfully extracted ${result.text.length} characters from PDF`
    );

    // Log completion
    await logProcessingEvent({
      processingId,
      userId,
      event: 'processing_complete',
      details: `Processed ${result.pageCount} pages in ${
        Date.now() - startTime
      }ms`,
    });

    return {
      success: true,
      text: result.text,
      pageCount: result.pageCount,
      processingId,
    };
  } catch (error) {
    console.error(`[PDF-PROCESSOR] Error processing PDF:`, error);

    // Try fallback method if primary method fails
    try {
      console.log(`[PDF-PROCESSOR] Attempting fallback extraction...`);
      const fallbackResult = await extractTextFromPDFFallback(
        fileBuffer,
        userId
      );

      if (fallbackResult.success && fallbackResult.text) {
        console.log(`[PDF-PROCESSOR] Fallback extraction succeeded`);

        // Log fallback success
        await logProcessingEvent({
          processingId,
          userId,
          event: 'fallback_extraction_success',
          details: `Fallback extracted ${
            fallbackResult.text.length
          } characters in ${Date.now() - startTime}ms`,
        });

        return {
          success: true,
          text: fallbackResult.text,
          processingId,
        };
      } else {
        throw new Error(
          fallbackResult.error || 'Fallback extraction also failed'
        );
      }
    } catch (fallbackError) {
      // Log error for both primary and fallback methods
      await logProcessingEvent({
        processingId,
        userId,
        event: 'processing_error',
        details: error instanceof Error ? error.message : String(error),
        error: error instanceof Error ? error : new Error(String(error)),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        processingId,
      };
    }
  }
}

/**
 * Fallback method to extract text from PDF using a simpler approach
 */
export async function extractTextFromPDFFallback(
  fileBuffer: ArrayBuffer,
  userId: string
): Promise<{
  success: boolean;
  text?: string;
  error?: string;
}> {
  try {
    // Use pdf-parse as a fallback
    const pdfParse = require('pdf-parse');

    const dataBuffer = Buffer.from(fileBuffer);
    const data = await pdfParse(dataBuffer);

    return {
      success: true,
      text: data.text,
    };
  } catch (error) {
    console.error(`[PDF-PROCESSOR] Fallback extraction failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Log a PDF processing event
 */
async function logProcessingEvent({
  processingId,
  userId,
  fileName,
  fileSize,
  event,
  details,
  error,
}: {
  processingId: string;
  userId: string;
  fileName?: string;
  fileSize?: number;
  event: string;
  details: string;
  error?: Error;
}) {
  try {
    await supabase.from('pdf_processing_logs').insert({
      processing_id: processingId,
      user_id: userId,
      file_name: fileName,
      file_size: fileSize,
      event,
      details,
      error_message: error?.message,
      error_stack: error?.stack,
      timestamp: new Date().toISOString(),
    });
  } catch (logError) {
    console.error(`[PDF-PROCESSOR] Failed to log processing event:`, logError);
    // Don't throw - logging should never break the main flow
  }
}
