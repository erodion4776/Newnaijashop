import { Sale, Settings } from '../types';

class BluetoothPrintService {
  private device: any = null;
  private characteristic: any = null;
  private isConnecting = false;

  public isSupported(): boolean {
    return 'bluetooth' in (navigator as any);
  }

  public isConnected(): boolean {
    return !!this.characteristic && this.device?.gatt?.connected || false;
  }

  public getDeviceName(): string {
    return this.device?.name || 'Unknown Printer';
  }

  /**
   * Attempts to connect to a new printer or resume a previous connection.
   */
  public async connect(): Promise<boolean> {
    if (this.isConnecting) return false;
    this.isConnecting = true;

    try {
      const nav = navigator as any;

      // Try to find previously paired devices first (Auto-connect logic)
      if (nav.bluetooth.getDevices) {
        const pairedDevices = await nav.bluetooth.getDevices();
        if (pairedDevices.length > 0) {
          const lastId = localStorage.getItem('last_printer_id');
          const autoDevice = pairedDevices.find((d: any) => d.id === lastId) || pairedDevices[0];
          
          try {
            const server = await autoDevice.gatt?.connect();
            if (server) {
              await this.setupService(autoDevice, server);
              this.isConnecting = false;
              return true;
            }
          } catch (e) {
            console.warn("Auto-reconnect failed, falling back to manual selection");
          }
        }
      }

      // Manual Request
      const device = await nav.bluetooth.requestDevice({
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

      await this.setupService(device, server);
      
      // Save for auto-connect
      localStorage.setItem('last_printer_id', device.id);
      
      return true;
    } catch (err) {
      console.error("Bluetooth Connection Error:", err);
      throw err;
    } finally {
      this.isConnecting = false;
    }
  }

  private async setupService(device: any, server: any) {
    const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
    const characteristics = await service.getCharacteristics();
    this.characteristic = characteristics.find((c: any) => c.properties.write || c.properties.writeWithoutResponse) || null;

    if (!this.characteristic) throw new Error("Write characteristic not found");

    this.device = device;
    device.addEventListener('gattserverdisconnected', () => {
      this.device = null;
      this.characteristic = null;
      console.warn("Printer Disconnected");
    });
  }

  private async writeBuffer(buffer: Uint8Array) {
    if (!this.characteristic) return;
    const CHUNK_SIZE = 20;
    for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
      const chunk = buffer.slice(i, i + CHUNK_SIZE);
      await this.characteristic.writeValue(chunk);
    }
  }

  public async printReceipt(sale: Sale, settings: Settings): Promise<void> {
    // Logic: Auto-connect if disconnected
    if (!this.isConnected()) {
      await this.connect();
    }

    const encoder = new TextEncoder();
    const commands: number[] = [
      0x1B, 0x40, // ESC @ - Initialize/Wake Up (Reset Buffer)
      0x1B, 0x61, 0x01, // Center align
      0x1B, 0x45, 0x01, // Bold ON
    ];

    // Narrow formatting: 32 chars max
    const shopName = `${settings.shop_name.substring(0, 31)}\n`;
    commands.push(...Array.from(encoder.encode(shopName)));
    commands.push(0x1B, 0x45, 0x00); // Bold OFF
    
    if (settings.shop_address) {
      commands.push(...Array.from(encoder.encode(`${settings.shop_address.substring(0, 31)}\n`)));
    }
    
    commands.push(...Array.from(encoder.encode(`ID: ${sale.sale_id.substring(0, 12)}\n`)));
    commands.push(...Array.from(encoder.encode(`Date: ${new Date(sale.timestamp).toLocaleDateString()}\n`)));
    commands.push(...Array.from(encoder.encode("--------------------------------\n"))); // 32 dashes

    // Items Table Header (32 chars)
    // ITEM(14) QTY(4) PRICE(14)
    commands.push(0x1B, 0x61, 0x00); // Left align
    commands.push(...Array.from(encoder.encode("ITEM           QTY         PRICE\n")));
    
    for (const item of sale.items) {
      const name = item.name.substring(0, 14).padEnd(15, ' ');
      const qty = item.quantity.toString().padEnd(4, ' ');
      const price = (item.price * item.quantity).toLocaleString().padStart(13, ' ');
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
      const footer = settings.receipt_footer.length > 32 ? settings.receipt_footer.substring(0, 31) : settings.receipt_footer;
      commands.push(...Array.from(encoder.encode(`${footer}\n`)));
    }
    commands.push(...Array.from(encoder.encode("NaijaShop POS - Offline First\n\n\n\n")));
    
    // Cut
    commands.push(0x1D, 0x56, 0x41, 0x00);

    await this.writeBuffer(new Uint8Array(commands));
  }

  public async printZReport(summary: any, settings: Settings | undefined, notes: string): Promise<void> {
    if (!this.isConnected()) await this.connect();

    const encoder = new TextEncoder();
    const commands: number[] = [
      0x1B, 0x40, // ESC @ - Initialize
      0x1B, 0x61, 0x01, // Center
      0x1B, 0x45, 0x01, // Bold ON
    ];

    commands.push(...Array.from(encoder.encode("DAILY Z-REPORT\n")));
    commands.push(...Array.from(encoder.encode(`${settings?.shop_name.substring(0, 31) || 'NAIJASHOP'}\n`)));
    commands.push(0x1B, 0x45, 0x00); // Bold OFF
    
    commands.push(...Array.from(encoder.encode(`DATE: ${new Date().toLocaleDateString()}\n`)));
    commands.push(...Array.from(encoder.encode("--------------------------------\n")));
    
    commands.push(0x1B, 0x61, 0x00); // Left
    commands.push(...Array.from(encoder.encode(`CASH:      N${summary.cash.toLocaleString().padStart(18, ' ')}\n`)));
    commands.push(...Array.from(encoder.encode(`TRANSFER:  N${summary.transfer.toLocaleString().padStart(18, ' ')}\n`)));
    commands.push(...Array.from(encoder.encode(`TOTAL:     N${summary.totalSales.toLocaleString().padStart(18, ' ')}\n`)));
    
    commands.push(...Array.from(encoder.encode("--------------------------------\n")));
    commands.push(0x1B, 0x45, 0x01); // Bold ON
    commands.push(...Array.from(encoder.encode(`NET:       N${summary.netTakeHome.toLocaleString().padStart(18, ' ')}\n`)));
    commands.push(0x1B, 0x45, 0x00); // Bold OFF
    
    commands.push(...Array.from(encoder.encode("\nTERMINAL SECURED\n\n\n\n")));
    
    commands.push(0x1D, 0x56, 0x41, 0x00);

    await this.writeBuffer(new Uint8Array(commands));
  }
}

export default new BluetoothPrintService();