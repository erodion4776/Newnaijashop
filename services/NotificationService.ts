
import { db } from '../db/db';
import { Sale, Product } from '../types';

const LOGO_URL = "https://i.ibb.co/BH8pgbJc/1767139026100-019b71b1-5718-7b92-9987-b4ed4c0e3c36.png";

class NotificationService {
  private static instance: NotificationService;
  
  private constructor() {
    this.setupHooks();
    this.updateLastUsed();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Request notification permissions
   */
  public async requestPermission(): Promise<NotificationPermission> {
    const permission = await Notification.requestPermission();
    return permission;
  }

  /**
   * Debugging utility to check permission status and test notification delivery
   */
  public async sendTestNotification() {
    alert('Permission Status: ' + Notification.permission);
    await this.sendNotification('NaijaShop Test', 'If you see this, notifications are correctly configured!');
  }

  /**
   * Specifically handles low stock alerts using the Service Worker
   * This ensures the notification works effectively on Android/PWAs
   */
  public async sendLowStockAlert(productName: string) {
    console.log('Low stock check triggered for:', productName);
    
    if (Notification.permission !== 'granted') {
      console.warn('Notification permission not granted. Skipping alert for:', productName);
      return;
    }

    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        registration.showNotification('⚠️ Out of Stock', {
          body: `${productName} has just finished! Remember to restock.`,
          icon: LOGO_URL,
          badge: LOGO_URL,
          vibrate: [200, 100, 200],
          tag: 'low-stock-' + productName,
          renotify: true
        } as any);
      } catch (err) {
        console.error('Failed to send Service Worker notification:', err);
      }
    } else {
      // Fallback for environments without Service Worker (though PWA should have it)
      new Notification('⚠️ Out of Stock', {
        body: `${productName} has just finished!`,
        icon: LOGO_URL
      });
    }
  }

  /**
   * Send a general local notification
   */
  public async sendNotification(title: string, body: string) {
    if (Notification.permission === 'granted') {
      const registration = await navigator.serviceWorker.ready;
      
      // Explicitly set icon and badge for brand consistency across OS platforms
      registration.showNotification(title, {
        body: body,
        icon: LOGO_URL,
        badge: LOGO_URL,
        vibrate: [200, 100, 200],
        tag: 'naijashop-notification',
        renotify: true
      } as any);
    }
  }

  /**
   * Save current date as last used to localStorage
   */
  private updateLastUsed() {
    localStorage.setItem('last_used_date', Date.now().toString());
  }

  /**
   * Setup Dexie hooks to monitor stock levels without modifying original components
   */
  private setupHooks() {
    // Monitor product updates for low stock (0 units)
    db.products.hook('updating', (mods: Partial<Product>, primKey, obj) => {
      if ('stock_qty' in mods && mods.stock_qty === 0 && obj.stock_qty > 0) {
        // We use a small delay to ensure the transaction completes before notifying
        setTimeout(() => {
          this.sendLowStockAlert(obj.name);
        }, 1000);
      }
    });
  }

  /**
   * Logic for the Nightly Sales Report
   */
  public async checkDailyReport() {
    const now = new Date();
    const currentHour = now.getHours();
    
    // Only trigger after 8:00 PM (20:00)
    if (currentHour < 20) return;

    const todayStr = now.toISOString().split('T')[0];
    const lastReportDate = localStorage.getItem('last_daily_report_date');

    // Prevent duplicate reports for the same day
    if (lastReportDate === todayStr) return;

    const startOfToday = new Date().setHours(0, 0, 0, 0);
    const endOfToday = new Date().setHours(23, 59, 59, 999);

    const sales = await db.sales
      .where('timestamp')
      .between(startOfToday, endOfToday)
      .toArray();

    const products = await db.products.toArray();
    const productMap = products.reduce((acc, p) => {
      if (p.id) acc[p.id] = p;
      return acc;
    }, {} as Record<number, Product>);

    let totalSales = 0;
    let totalInterest = 0;

    sales.forEach(sale => {
      totalSales += sale.total_amount;
      sale.items.forEach(item => {
        const product = productMap[item.productId];
        const cost = product?.cost_price || 0;
        totalInterest += (item.price - cost) * item.quantity;
      });
    });

    if (sales.length > 0) {
      this.sendNotification(
        "💰 Today's Report",
        `You made ₦${totalSales.toLocaleString()} today with a profit of ₦${totalInterest.toLocaleString()}. Well done, Oga!`
      );
      localStorage.setItem('last_daily_report_date', todayStr);
    }
  }

  /**
   * Logic for 30-day inactivity reminder
   * Runs on app initialization
   */
  public checkInactivityReminder() {
    const lastUsed = localStorage.getItem('last_used_date');
    if (!lastUsed) return;

    const lastUsedMs = parseInt(lastUsed);
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    if (Date.now() - lastUsedMs > thirtyDaysMs) {
      this.sendNotification(
        '👋 NaijaShop Misses You!',
        'Your shop records are waiting. Open the app to stay on top of your business.'
      );
    }
  }
}

export default NotificationService.getInstance();
