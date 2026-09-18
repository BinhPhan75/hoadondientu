import { createWorker, Worker } from 'tesseract.js';

let worker: Worker | null = null;
let workerPromise: Promise<Worker> | null = null;
let recognitionQueue: Promise<unknown> = Promise.resolve();

async function initializeWorker(): Promise<Worker> {
  if (worker) return worker;
  if (workerPromise) return workerPromise;

  workerPromise = createWorker('eng', 1).then(async (createdWorker) => {
    await createdWorker.setParameters({
      tessedit_char_whitelist: '0123456789',
      tessedit_pageseg_mode: '7' as any,
    });
    worker = createdWorker;
    return createdWorker;
  }).catch((error) => {
    workerPromise = null;
    throw error;
  });

  return workerPromise;
}

/**
 * Keeps one configured Tesseract worker for the lifetime of the process.
 * Recognition is serialized because a Tesseract worker handles one job at a time.
 */
export function initializeEasyInvoiceCaptchaWorker(): Promise<void> {
  return initializeWorker().then(() => undefined);
}

export function solveCaptcha(imageBase64: string): Promise<string> {
  const input = imageBase64.trim();
  if (!input) {
    return Promise.reject(new Error('Dữ liệu Captcha rỗng.'));
  }

  const image = input.startsWith('data:image/')
    ? Buffer.from(input.slice(input.indexOf(',') + 1), 'base64')
    : Buffer.from(input, 'base64');

  const job = recognitionQueue.then(async () => {
    const activeWorker = await initializeWorker();
    const result = await activeWorker.recognize(image);
    return (result.data.text || '').replace(/[^0-9]/g, '');
  });

  recognitionQueue = job.catch(() => undefined);
  return job;
}
