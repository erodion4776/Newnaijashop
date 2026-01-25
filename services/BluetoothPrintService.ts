
import { Sale, Settings } from '../types';

class BluetoothPrintService {
  // Fix: Use any because BluetoothDevice is not defined in standard TypeScript DOM types
  private device: any = null;
  // Fix: Use any because BluetoothRemoteGATTCharacteristic is not defined in standard TypeScript DOM types
  private characteristic: any = null;
  private isConnecting = false;

  public isSupported(): boolean {
    // Fix: Cast navigator to any to avoid "Property 'bluetooth' does not exist" error
    return 'bluetooth' in (navigator as any);
  }

  public isConnected(): boolean {
    return !!this.characteristic && this.device?.gatt?.connected || false;
  }

  public getDeviceName(): string {
    return this.device?.name || 'Unknown Printer';
  }

  public async connect(): Promise<boolean> {
    if (this.isConnecting) return false;
    this.isConnecting = true;

    try {
      // Standard UUID for many thermal printers and generic serial services
      // Fix: Cast navigator to any to access the Web Bluetooth API
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [
          { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
          { namePrefix: 'Printer' },
          { namePrefix: 'MTP' },
          { namePrefix: 'BlueTooth' }
        ],
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
      });

      const server = await device.gatt?.connect();
      if (!server) throw new Error("GATT Server not found");

      const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      // Look for the write characteristic
      const characteristics = await service.getCharacteristics();
      // Fix: characteristics is inferred as any array, but explicit casting ensures safety
      this.characteristic = characteristics.find((c: any) => c.properties.write || c.properties.writeWithoutResponse) || null;

      if (!this.characteristic) throw new Error("Write characteristic not found");

      this.device = device;
      
      device.addEventListener('gattserverdisconnected', () => {
        this.device = null;
        this.characteristic = null;
        console.warn("Printer Disconnected");
      });

      return true;
    } catch (err) {
      console.error("Bluetooth Connection Error:", err);
      throw err;
    } finally {
      this.isConnecting = false;
    }
  }

  private async writeBuffer(buffer: Uint8Array) {
    if (!this.characteristic) return;
    
    // Chunk size for reliable Bluetooth transmission
    const CHUNK_SIZE = 20;
    for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
      const chunk = buffer.slice(i, i + CHUNK_SIZE);
      await this.characteristic.writeValue(chunk);
    }
  }

  public async printReceipt(sale: Sale, settings: Settings): Promise<void> {
    if (!this.isConnected()) throw new Error("Printer not connected");

    const encoder = new TextEncoder();
    const commands: number[] = [
      0x1B, 0x40, // Initialize
      0x1B, 0x61, 0x01, // Center align
      0x1B, 0x45, 0x01, // Bold ON
    ];

    // Shop Header
    const shopName = `${settings.shop_name}\n`;
    commands.push(...Array.from(encoder.encode(shopName)));
    commands.push(0x1B, 0x45, 0x00); // Bold OFF
    
    if (settings.shop_address) {
      commands.push(...Array.from(encoder.encode(`${settings.shop_address}\n`)));
    }
    
    commands.push(...Array.from(encoder.encode(`Receipt: #${sale.sale_id.substring(0, 8)}\n`)));
    commands.push(...Array.from(encoder.encode(`Date: ${new Date(sale.timestamp).toLocaleString()}\n`)));
    commands.push(...Array.from(encoder.encode("--------------------------------\n")));

    // Items Table Header
    commands.push(0x1B, 0x61, 0x00); // Left align
    commands.push(...Array.from(encoder.encode("ITEM         QTY     PRICE\n")));
    
    // Items
    for (const item of sale.items) {
      const name = item.name.substring(0, 12).padEnd(13, ' ');
      const qty = item.quantity.toString().padEnd(8, ' ');
      const price = (item.price * item.quantity).toLocaleString();
      commands.push(...Array.from(encoder.encode(`${name}${qty}${price}\n`)));
    }

    commands.push(...Array.from(encoder.encode("--------------------------------\n")));
    
    // Total
    commands.push(0x1B, 0x61, 0x02); // Right align
    commands.push(0x1B, 0x45, 0x01); // Bold ON
    commands.push(...Array.from(encoder.encode(`TOTAL: N${sale.total_amount.toLocaleString()}\n`)));
    commands.push(0x1B, 0x45, 0x00); // Bold OFF

    // Footer
    commands.push(0x1B, 0x61, 0x01, 0x0A); // Center & Feed
    if (settings.receipt_footer) {
      commands.push(...Array.from(encoder.encode(`${settings.receipt_footer}\n`)));
    }
    commands.push(...Array.from(encoder.encode("Powered by NaijaShop POS\n\n\n\n\n")));
    
    // Cut paper (Partial)
    commands.push(0x1D, 0x56, 0x41, 0x00);

    await this.writeBuffer(new Uint8Array(commands));
  }

  public async printZReport(summary: any, settings: Settings | undefined, notes: string): Promise<void> {
    if (!this.isConnected()) throw new Error("Printer not connected");

    const encoder = new TextEncoder();
    const commands: number[] = [
      0x1B, 0x40, // Initialize
      0x1B, 0x61, 0x01, // Center
      0x1B, 0x45, 0x01, // Bold ON
    ];

    commands.push(...Array.from(encoder.encode("DAILY Z-REPORT\n")));
    commands.push(...Array.from(encoder.encode(`${settings?.shop_name || 'NAIJASHOP'}\n`)));
    commands.push(0x1B, 0x45, 0x00); // Bold OFF
    
    commands.push(...Array.from(encoder.encode(`DATE: ${new Date().toLocaleDateString()}\n`)));
    commands.push(...Array.from(encoder.encode("--------------------------------\n")));
    
    commands.push(0x1B, 0x61, 0x00); // Left
    commands.push(...Array.from(encoder.encode(`CASH IN HAND:  N${summary.cash.toLocaleString()}\n`)));
    commands.push(...Array.from(encoder.encode(`BANK TRANSFERS: N${summary.transfer.toLocaleString()}\n`)));
    commands.push(...Array.from(encoder.encode(`POS SALES:      N${summary.pos.toLocaleString()}\n`)));
    commands.push(...Array.from(encoder.encode(`TOTAL REVENUE:  N${summary.totalSales.toLocaleString()}\n`)));
    
    commands.push(...Array.from(encoder.encode("--------------------------------\n")));
    commands.push(...Array.from(encoder.encode(`TOTAL EXPENSES: N${summary.expenses.toLocaleString()}\n`)));
    
    commands.push(0x1B, 0x45, 0x01); // Bold ON
    commands.push(...Array.from(encoder.encode(`NET TAKE-HOME:  N${summary.netTakeHome.toLocaleString()}\n`)));
    commands.push(...Array.from(encoder.encode(`EST. PROFIT:    N${summary.interest.toLocaleString()}\n`)));
    commands.push(0x1B, 0x45, 0x00); // Bold OFF
    
    if (notes) {
      commands.push(...Array.from(encoder.encode("--------------------------------\n")));
      commands.push(...Array.from(encoder.encode(`NOTES: ${notes}\n`)));
    }
    
    commands.push(...Array.from(encoder.encode("\nTERMINAL SECURED FOR NIGHT\n")));
    commands.push(...Array.from(encoder.encode("--------------------------------\n\n\n\n\n")));
    
    // Cut
    commands.push(0x1D, 0x56, 0x41, 0x00);

    await this.writeBuffer(new Uint8Array(commands));
  }
}

export default new BluetoothPrintService();
