
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import LocalVisionService, { ScannedProduct } from './LocalVisionService';

class FileImportService {
  /**
   * General entry point for all local file types
   */
  public async processFile(file: File): Promise<ScannedProduct[]> {
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (['jpg', 'jpeg', 'png'].includes(extension || '')) {
      return await LocalVisionService.processStockPhoto(file);
    }

    if (['xlsx', 'xls', 'csv'].includes(extension || '')) {
      return await this.parseExcel(file);
    }

    if (extension === 'docx') {
      return await this.parseWord(file);
    }

    throw new Error('Unsupported file format. Please use Excel, Word, or a Photo.');
  }

  /**
   * Local Excel/CSV parsing with smart header detection
   */
  private async parseExcel(file: File): Promise<ScannedProduct[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

          if (rows.length < 2) return resolve([]);

          const headers = rows[0].map(h => String(h).toLowerCase());
          
          // Smart Header Mapping
          const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('item') || h.includes('desc') || h.includes('product'));
          const priceIdx = headers.findIndex(h => h.includes('price') || h.includes('cost') || h.includes('selling') || h.includes('rate'));
          const stockIdx = headers.findIndex(h => h.includes('stock') || h.includes('qty') || h.includes('count') || h.includes('quantity') || h.includes('available'));

          const products: ScannedProduct[] = [];
          
          // Skip header row
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const name = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '';
            const price = priceIdx !== -1 ? parseFloat(row[priceIdx]) : 0;
            const stock = stockIdx !== -1 ? parseInt(row[stockIdx]) : 1;

            if (name && !isNaN(price)) {
              products.push({
                name,
                price: Math.round(price / 50) * 50,
                stock_qty: isNaN(stock) ? 1 : stock
              });
            }
          }
          resolve(products);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Local Word document parsing using Mammoth and the Naija-Logic OCR parser
   */
  private async parseWord(file: File): Promise<ScannedProduct[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const result = await mammoth.extractRawText({ arrayBuffer });
          const products = LocalVisionService.naijaLogicParser(result.value);
          resolve(products);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }
}

export default new FileImportService();
