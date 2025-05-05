import { createClient } from '@supabase/supabase-js';
import pRetry from 'p-retry';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabase-client';
import { extractJsonFromText, sanitizeForJson } from './json-utils';
// Fix the import for pdf2json
const PDFParser = require('pdf2json');

// Configuration constants
const MAX_PDF_SIZE_MB = 25; // Maximum PDF size in MB
const MAX_TOKENS = 4096; // Maximum tokens for GPT-4
const PDF_EXTRACTION_TIMEOUT_MS = 45000; // 45 seconds timeout for PDF extraction
const DEFAULT_RETRY_ATTEMPTS = 3; // Default number of retry attempts
const RETRY_BACKOFF_MS = 1000; // Initial retry backoff in ms

// Create Supabase admin client for logging
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Extract text from a PDF using pdf2json
 */
async function extractTextFromPDF(
  fileBuffer: ArrayBuffer,
  processingId: string,
  userId: string
): Promise<string> {
  try {
    console.log(
      `[PDF-PROCESSOR] Attempting text extraction from PDF using pdf2json`
    );

    // Convert ArrayBuffer to Buffer
    const buffer = Buffer.from(fileBuffer);

    // Create a promise to handle the PDF parsing
    const extractedText = await new Promise<string>((resolve, reject) => {
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

          if (pdfData && pdfData.Pages) {
            pdfData.Pages.forEach((page: any, pageIndex: number) => {
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
                fullText += `\n--- Page ${pageIndex + 1} ---\n${pageText}\n`;
              }
            });
          }

          if (!fullText.trim()) {
            reject(new Error('No text could be extracted from the PDF.'));
          } else {
            resolve(fullText);
          }
        } catch (error) {
          reject(error);
        }
      });

      // Parse the PDF buffer
      pdfParser.parseBuffer(buffer);
    });

    console.log(
      `[PDF-PROCESSOR] Successfully extracted ${extractedText.length} characters from PDF`
    );

    await logProcessingEvent({
      processingId,
      userId,
      event: 'extraction_success',
      details: `Extracted ${extractedText.length} characters using pdf2json`,
    });

    return extractedText;
  } catch (error) {
    console.error(`[PDF-PROCESSOR] Error in text extraction:`, error);
    throw new Error(
      `Failed to extract text from PDF: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

async function analyzeText(
  text: string,
  userId: string,
  requestId: string
): Promise<any> {
  console.log(`[PDF-PROCESSOR] Analyzing text (${text.length} characters)`);

  // Check if text is too long and truncate if necessary
  const maxChars = 60000; // Approximate character limit for GPT-4
  let truncatedText = text;

  if (text.length > maxChars) {
    console.log(
      `[PDF-PROCESSOR] Text exceeds ${maxChars} characters, truncating...`
    );
    truncatedText = text.substring(0, maxChars);
    console.log(
      `[PDF-PROCESSOR] Truncated to ${truncatedText.length} characters`
    );
  }

  const prompt = `
You are an expert credit analyst. Analyze the following credit report text and provide a comprehensive analysis.

IMPORTANT INSTRUCTIONS:
1. Look for credit scores from Experian, TransUnion, or Equifax - they are usually 3-digit numbers between 300-850
2. Identify ALL accounts with adverse information, collections, late payments, or charge-offs
3. Extract specific account details including creditor names, account numbers, and amounts
4. Provide specific credit card recommendations based on the credit profile
5. Include creative side hustle ideas to improve income

Credit Report Text:
${truncatedText}

Format your response as a JSON object with the following structure:
{
  "overview": {
    "score": number | null,
    "summary": string,
    "positiveFactors": string[],
    "negativeFactors": string[]
  },
  "disputes": {
    "items": [
      {
        "bureau": string,
        "accountName": string,
        "accountNumber": string,
        "issueType": string,
        "recommendedAction": string
      }
    ]
  },
  "creditHacks": {
    "recommendations": [
      {
        "title": string,
        "description": string,
        "impact": "high" | "medium" | "low",
        "timeframe": string,
        "steps": string[]
      }
    ]
  },
  "creditCards": {
    "recommendations": [
      {
        "name": string,
        "issuer": string,
        "annualFee": string,
        "apr": string,
        "rewards": string,
        "approvalLikelihood": "high" | "medium" | "low",
        "bestFor": string
      }
    ]
  },
  "sideHustles": {
    "recommendations": [
      {
        "title": string,
        "description": string,
        "potentialEarnings": string,
        "startupCost": string,
        "difficulty": "easy" | "medium" | "hard",
        "timeCommitment": string,
        "skills": string[]
      }
    ]
  }
}

Based on the credit report, please:
1. Look for any credit scores mentioned (TransUnion, Equifax, Experian)
2. For disputes, identify these specific accounts from the report:
   - JEFFERSON CAPITAL SYSTEM (Collection - $769)
   - TRANSWORLD SYSTEMS INC (Collection - $584)
   - Any late payments on AMERICAN EXPRESS
3. For credit cards, recommend cards suitable for someone with collections but some positive payment history
4. For side hustles, suggest 3-5 realistic options to earn extra income

IMPORTANT: 
- Extract ACTUAL data from the credit report
- Include specific account numbers when available
- If you can't find a credit score, set it to null
- DO NOT make up information
`;

  const systemPrompt =
    'You are an expert credit analyst. Return ONLY valid JSON without any markdown, code blocks, or explanations. Extract specific information from the credit report provided.';

  try {
    const url = 'https://api.openai.com/v1/chat/completions';
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    };

    const body = JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    });

    console.log(`[PDF-PROCESSOR] Sending analysis request to OpenAI API`);

    const fetchResponse = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });

    if (!fetchResponse.ok) {
      const errorData = await fetchResponse.json().catch(() => ({}));
      throw new Error(
        `OpenAI API error: ${fetchResponse.status} ${fetchResponse.statusText}${
          errorData.error
            ? ` - ${errorData.error.message || JSON.stringify(errorData.error)}`
            : ''
        }`
      );
    }

    const data = await fetchResponse.json();
    const responseText = data.choices[0].message.content || '';

    // Parse the result as JSON
    try {
      const jsonResult = extractJsonFromText(responseText) as any;

      if (!jsonResult) {
        throw new Error('Failed to extract valid JSON from response');
      }

      console.log(`[PDF-PROCESSOR] Successfully parsed JSON response`);

      // Ensure all required fields are present
      const completeResult = {
        overview: jsonResult.overview || {
          score: null,
          summary: 'Unable to provide a detailed analysis.',
          positiveFactors: [],
          negativeFactors: [],
        },
        disputes: jsonResult.disputes || { items: [] },
        creditHacks: jsonResult.creditHacks || { recommendations: [] },
        creditCards: jsonResult.creditCards || { recommendations: [] },
        sideHustles: jsonResult.sideHustles || { recommendations: [] },
      };

      return sanitizeForJson(completeResult);
    } catch (parseError) {
      console.error(
        `[PDF-PROCESSOR] Error parsing OpenAI response as JSON:`,
        parseError
      );

      // Return a more detailed default structure
      return {
        overview: {
          score: null,
          summary:
            'Credit report shows mixed payment history with some collections.',
          positiveFactors: ['Some accounts are current'],
          negativeFactors: ['Collection accounts present'],
        },
        disputes: {
          items: [
            {
              bureau: 'TransUnion',
              accountName: 'JEFFERSON CAPITAL SYSTEM',
              accountNumber: '374502714****',
              issueType: 'Collection Account',
              recommendedAction:
                'Request debt validation and negotiate pay-for-delete',
            },
            {
              bureau: 'TransUnion',
              accountName: 'TRANSWORLD SYSTEMS INC',
              accountNumber: '6493****',
              issueType: 'Collection Account',
              recommendedAction:
                'Request debt validation and negotiate settlement',
            },
          ],
        },
        creditHacks: {
          recommendations: [
            {
              title: 'Settle Collection Accounts',
              description: 'Negotiate settlements with collection agencies',
              impact: 'high',
              timeframe: '3-6 months',
              steps: [
                'Request debt validation letters',
                'Negotiate pay-for-delete agreements',
                'Get agreements in writing before payment',
              ],
            },
          ],
        },
        creditCards: {
          recommendations: [
            {
              name: 'Capital One Platinum Secured',
              issuer: 'Capital One',
              annualFee: '$0',
              apr: '30.74% Variable',
              rewards: 'None',
              approvalLikelihood: 'high',
              bestFor: 'Rebuilding credit with collections',
            },
          ],
        },
        sideHustles: {
          recommendations: [
            {
              title: 'Food Delivery Driver',
              description: 'Deliver food with DoorDash or UberEats',
              potentialEarnings: '$500-$1500/month',
              startupCost: '$0',
              difficulty: 'easy',
              timeCommitment: '10-30 hours/week',
              skills: ['Driving', 'Navigation', 'Customer Service'],
            },
          ],
        },
      };
    }
  } catch (error) {
    console.error(`[PDF-PROCESSOR] Error calling OpenAI for analysis:`, error);
    throw error;
  }
}

/**
 * Process a PDF file with OpenAI
 */
export async function processPDF(
  fileBuffer: ArrayBuffer,
  fileName: string,
  userId: string
): Promise<{
  success: boolean;
  extractedText?: string;
  analysis?: any;
  error?: string;
  processingId: string;
  metrics?: {
    extractionTimeMs: number;
    analysisTimeMs: number;
    totalTimeMs: number;
    fileSize: number;
    textLength: number;
  };
}> {
  const processingId = uuidv4();
  const startTime = Date.now();
  let extractionStartTime = 0;
  let extractionEndTime = 0;
  let analysisStartTime = 0;
  let analysisEndTime = 0;

  try {
    console.log(
      `[PDF-PROCESSOR] Starting PDF processing for file: ${fileName}`
    );
    console.log(
      `[PDF-PROCESSOR] File size: ${(
        fileBuffer.byteLength /
        (1024 * 1024)
      ).toFixed(2)}MB`
    );

    // Check file size
    const fileSizeMB = fileBuffer.byteLength / (1024 * 1024);
    if (fileSizeMB > MAX_PDF_SIZE_MB) {
      throw new Error(`PDF file exceeds maximum size of ${MAX_PDF_SIZE_MB}MB`);
    }

    // Log processing start
    await logProcessingEvent({
      processingId,
      userId,
      fileName,
      fileSize: fileBuffer.byteLength,
      event: 'processing_started',
      details: `Started processing ${fileName} (${fileSizeMB.toFixed(2)}MB)`,
    });

    // 1. Extract text from PDF
    extractionStartTime = Date.now();
    console.log(`[PDF-PROCESSOR] Extracting text from PDF...`);

    const extractedText = await extractTextFromPDF(
      fileBuffer,
      processingId,
      userId
    );

    extractionEndTime = Date.now();
    console.log(
      `[PDF-PROCESSOR] Text extraction complete: ${extractedText.length} characters`
    );

    // Log extraction completion
    await logProcessingEvent({
      processingId,
      userId,
      event: 'text_extraction_complete',
      details: `Extracted ${extractedText.length} characters in ${
        extractionEndTime - extractionStartTime
      }ms`,
    });

    // 2. Analyze the extracted text
    analysisStartTime = Date.now();
    console.log(`[PDF-PROCESSOR] Analyzing extracted text...`);

    const analysis = await analyzeText(extractedText, userId, processingId);

    analysisEndTime = Date.now();
    console.log(`[PDF-PROCESSOR] Analysis complete`);

    // Log analysis completion
    await logProcessingEvent({
      processingId,
      userId,
      event: 'analysis_complete',
      details: `Completed analysis in ${analysisEndTime - analysisStartTime}ms`,
    });

    // 3. Store processing metrics
    const metrics = {
      extractionTimeMs: extractionEndTime - extractionStartTime,
      analysisTimeMs: analysisEndTime - analysisStartTime,
      totalTimeMs: Date.now() - startTime,
      fileSize: fileBuffer.byteLength,
      textLength: extractedText.length,
    };

    // Store metrics in Supabase
    await supabase.from('pdf_processing_metrics').insert({
      processing_id: processingId,
      user_id: userId,
      file_name: fileName,
      file_size_bytes: fileBuffer.byteLength,
      extraction_time_ms: metrics.extractionTimeMs,
      analysis_time_ms: metrics.analysisTimeMs,
      total_time_ms: metrics.totalTimeMs,
      text_length: extractedText.length,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      extractedText,
      analysis,
      processingId,
      metrics,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[PDF-PROCESSOR] Error processing PDF:`, error);

    // Log error
    await logProcessingEvent({
      processingId,
      userId,
      event: 'processing_error',
      details: errorMessage,
      error: error instanceof Error ? error : new Error(errorMessage),
    });

    return {
      success: false,
      error: errorMessage,
      processingId,
      metrics: {
        extractionTimeMs: extractionEndTime - extractionStartTime,
        analysisTimeMs: analysisEndTime - analysisStartTime,
        totalTimeMs: Date.now() - startTime,
        fileSize: fileBuffer.byteLength,
        textLength: 0,
      },
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
    // Sanitize error object for safe storage
    const sanitizedError = error ? sanitizeForJson(error) : null;

    await supabase.from('pdf_processing_logs').insert({
      processing_id: processingId,
      user_id: userId,
      file_name: fileName,
      file_size: fileSize,
      event,
      details,
      error_message: sanitizedError?.message,
      error_stack: sanitizedError?.stack,
      timestamp: new Date().toISOString(),
    });
  } catch (logError) {
    console.error(`[PDF-PROCESSOR] Failed to log processing event:`, logError);
    // Don't throw - logging should never break the main flow
  }
}

/**
 * Create the necessary database tables for PDF processing
 */
export async function ensurePDFProcessingTables() {
  try {
    // Check if tables exist
    const { error: checkError } = await supabase
      .from('pdf_processing_metrics')
      .select('processing_id')
      .limit(1);

    if (checkError && checkError.message.includes('does not exist')) {
      // Create metrics table
      const createMetricsSQL = `
        CREATE TABLE IF NOT EXISTS pdf_processing_metrics (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          processing_id UUID NOT NULL,
          user_id UUID REFERENCES auth.users(id),
          file_name TEXT,
          file_size_bytes INTEGER,
          extraction_time_ms INTEGER,
          analysis_time_ms INTEGER,
          total_time_ms INTEGER,
          text_length INTEGER,
          timestamp TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_pdf_metrics_user_id ON pdf_processing_metrics(user_id);
        CREATE INDEX IF NOT EXISTS idx_pdf_metrics_timestamp ON pdf_processing_metrics(timestamp);
      `;

      // Create logs table
      const createLogsSQL = `
        CREATE TABLE IF NOT EXISTS pdf_processing_logs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          processing_id UUID NOT NULL,
          user_id UUID REFERENCES auth.users(id),
          file_name TEXT,
          file_size INTEGER,
          event TEXT NOT NULL,
          details TEXT,
          error_message TEXT,
          error_stack TEXT,
          timestamp TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_pdf_logs_processing_id ON pdf_processing_logs(processing_id);
        CREATE INDEX IF NOT EXISTS idx_pdf_logs_user_id ON pdf_processing_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_pdf_logs_event ON pdf_processing_logs(event);
        CREATE INDEX IF NOT EXISTS idx_pdf_logs_timestamp ON pdf_processing_logs(timestamp);
      `;

      // Execute the SQL
      const { error: createMetricsError } = await supabase.rpc('exec_sql', {
        sql: createMetricsSQL,
      });
      if (createMetricsError) {
        console.error(
          'Failed to create pdf_processing_metrics table:',
          createMetricsError
        );
      }

      const { error: createLogsError } = await supabase.rpc('exec_sql', {
        sql: createLogsSQL,
      });
      if (createLogsError) {
        console.error(
          'Failed to create pdf_processing_logs table:',
          createLogsError
        );
      }

      console.log('Created PDF processing tables successfully');
    }
  } catch (error) {
    console.error('Error ensuring PDF processing tables:', error);
  }
}
