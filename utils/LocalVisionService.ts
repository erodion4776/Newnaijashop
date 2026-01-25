
import { createWorker } from 'tesseract.js';

export interface ScannedProduct {
  name: string;
  price: number;
  stock_qty: number;
}

class LocalVisionService {
  /**
   * Optimizes an image for OCR by converting to grayscale and boosting contrast
   */
  private async preprocessImage(imageFile: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(e.target?.result as string);

          canvas.width = img.width;
          canvas.height = img.height;

          // Step 1: Draw image
          ctx.drawImage(img, 0, 0);

          // Step 2: Grayscale & Contrast
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          for (let i = 0; i < data.length; i += 4) {
            // Standard grayscale luminosity
            const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            
            // Contrast boost (thresholding or simple linear scaling)
            // Anything below 128 becomes darker, above becomes lighter
            let color = avg;
            const threshold = 128;
            const contrast = 1.5; // 50% increase
            color = contrast * (color - threshold) + threshold;
            
            data[i] = data[i+1] = data[i+2] = Math.min(255, Math.max(0, color));
          }

          ctx.putImageData(imageData, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(imageFile);
    });
  }

  /**
   * Core logic to extract and parse text into structured products
   */
  public async processStockPhoto(imageFile: File): Promise<ScannedProduct[]> {
    const optimizedImage = await this.preprocessImage(imageFile);
    
    // Tesseract.js runs entirely on-device
    const worker = await createWorker('eng');
    
    // Set parameters to whitelist only specific characters: alphanumeric, space, dash, and dot.
    // This prevents the local AI from returning messy symbols like #, %, etc.
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ -. ',
    });

    const { data: { text } } = await worker.recognize(optimizedImage);
    await worker.terminate();

    return this.naijaLogicParser(text);
  }

  /**
   * Specialized parser for common Nigerian ledger formats:
   * Pattern 1: [Name] [Price] (Milo 500g 2500)
   * Pattern 2: [Name] - [Price] - [Qty] (Sugar - 1200 - 5)
   */
  public naijaLogicParser(rawText: string): ScannedProduct[] {
    const lines = rawText.split('\n');
    const products: ScannedProduct[] = [];

    lines.forEach(line => {
      const cleanLine = line.trim();
      if (cleanLine.length < 3) return;

      // Normalize line: replace dashes with spaces, remove special chars
      const normalized = cleanLine.replace(/-/g, ' ').replace(/[^\w\s]/g, '');
      const parts = normalized.split(/\s+/).filter(p => p.length > 0);

      if (parts.length >= 2) {
        // Find numbers in the parts
        const numbers = parts.filter(p => /^\d+$/.test(p)).map(Number);
        
        let name = "";
        let price = 0;
        let qty = 1;

        if (numbers.length === 2) {
          // Assume Price is the larger one or the last one
          // Qty is usually smaller or follows price
          price = Math.max(...numbers);
          qty = Math.min(...numbers);
          // Name is everything before the numbers
          name = parts.filter(p => !/^\d+$/.test(p)).join(' ');
        } else if (numbers.length === 1) {
          price = numbers[0];
          name = parts.filter(p => !/^\d+$/.test(p)).join(' ');
        } else if (numbers.length >= 3) {
          // More complex: [Name] [Price] [Qty] [Total]
          // Usually Price is the middle large one
          price = numbers[0];
          qty = numbers[1];
          name = parts.filter(p => !/^\d+$/.test(p)).join(' ');
        }

        // Clean up common OCR mistakes (e.g. 'O' for '0')
        if (name && price > 0) {
          products.push({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            price: Math.round(price / 50) * 50, // Round to nearest 50 (Naija Rounding)
            stock_qty: qty > 0 ? qty : 1
          });
        }
      }
    });

    return products;
  }
}

export default new LocalVisionService();
