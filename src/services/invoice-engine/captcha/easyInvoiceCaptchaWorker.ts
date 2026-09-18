import { createWorker, Worker } from 'tesseract.js';

let worker: Worker | null = null;
let workerPromise: Promise<Worker> | null = null;
let recognitionQueue: Promise<unknown> = Promise.resolve();
let terminationPromise: Promise<void> | null = null;

async function initializeWorker(): Promise<Worker> {
  if (terminationPromise) {
    await terminationPromise;
  }
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

export type CaptchaImageSource = string | Buffer | Uint8Array;

async function resolveImageSource(imageSource: CaptchaImageSource): Promise<Buffer> {
  if (Buffer.isBuffer(imageSource)) return imageSource;
  if (imageSource instanceof Uint8Array) return Buffer.from(imageSource);

  const input = imageSource.trim();
  if (!input) throw new Error('Dữ liệu Captcha rỗng.');

  if (/^https?:\/\//i.test(input)) {
    const response = await fetch(input);
    if (!response.ok) {
      throw new Error(`Không thể tải ảnh Captcha (HTTP ${response.status}).`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  const base64 = input.startsWith('data:image/')
    ? input.slice(input.indexOf(',') + 1)
    : input;
  const image = Buffer.from(base64, 'base64');
  if (image.length === 0) throw new Error('Ảnh Captcha Base64 không hợp lệ.');
  return image;
}

/**
 * Nhận diện Captcha số bằng worker dùng chung.
 * Các yêu cầu được xếp hàng vì một Tesseract worker chỉ xử lý một ảnh tại một thời điểm.
 */
export function solveCaptcha(imageSource: CaptchaImageSource): Promise<string> {
  if (terminationPromise) {
    return Promise.reject(new Error('Captcha worker đang được giải phóng, vui lòng thử lại.'));
  }

  const job = recognitionQueue.then(async () => {
    const image = await resolveImageSource(imageSource);
    const activeWorker = await initializeWorker();
    const result = await activeWorker.recognize(image);
    const digits = (result.data.text || '').replace(/[^0-9]/g, '');
    return digits.length === 4 ? digits : '';
  });

  recognitionQueue = job.catch(() => undefined);
  return job;
}

/**
 * Đợi các job hiện tại hoàn tất rồi giải phóng worker. Lần gọi solveCaptcha
 * tiếp theo sẽ tự khởi tạo lại worker.
 */
export async function terminateWorker(): Promise<void> {
  if (terminationPromise) return terminationPromise;

  terminationPromise = recognitionQueue.then(async () => {
    if (worker) {
      await worker.terminate();
      worker = null;
    }
    workerPromise = null;
  }).finally(() => {
    terminationPromise = null;
  });

  return terminationPromise;
}
