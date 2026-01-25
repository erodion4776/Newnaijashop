
import { db } from '../db/db';
import { Sale, Product, Expense } from '../types';

export interface LocalInsight {
  type: 'success' | 'warning' | 'danger' | 'info';
  title: string;
  description: string;
  icon: string;
}

class LocalInsightsEngine {
  public async generateInsights(): Promise<LocalInsight[]> {
    const insights: LocalInsight[] = [];
    
    const sales = await db.sales.toArray();
    const products = await db.products.toArray();
    const expenses = await db.expenses.toArray();
    
    if (sales.length === 0) {
      return [{
        type: 'info',
        title: 'Gathering Data',
        description: 'Once you record your first few sales, the Business Hub will show you movers and predictions.',
        icon: 'ChartBar'
      }];
    }

    // 1. Fast Movers (Last 7 Days)
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recentSales = sales.filter(s => s.timestamp >= sevenDaysAgo);
    const productSalesCount: Record<number, number> = {};
    
    recentSales.forEach(sale => {
      sale.items.forEach(item => {
        productSalesCount[item.productId] = (productSalesCount[item.productId] || 0) + item.quantity;
      });
    });

    const topMovers = Object.entries(productSalesCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([id]) => products.find(p => p.id === Number(id))?.name)
      .filter(Boolean);

    if (topMovers.length > 0) {
      insights.push({
        type: 'success',
        title: 'Fast Movers',
        description: `Oga, ${topMovers.join(', ')} is selling like hotcakes. Make sure you have enough in stock!`,
        icon: 'TrendingUp'
      });
    }

    // 2. Dead Stock (No sales in 14 days)
    const fourteenDaysAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
    const soldProductIds = new Set(sales.filter(s => s.timestamp >= fourteenDaysAgo).flatMap(s => s.items.map(i => i.productId)));
    const deadStock = products.filter(p => !soldProductIds.has(p.id!) && p.stock_qty > 0).slice(0, 2);

    if (deadStock.length > 0) {
      insights.push({
        type: 'warning',
        title: 'Dead Stock Alert',
        description: `These items haven't moved in 2 weeks: ${deadStock.map(p => p.name).join(', ')}. Maybe reduce the price to clear space?`,
        icon: 'PackageSearch'
      });
    }

    // 3. Stock-Out Prediction
    products.forEach(p => {
      const soldQty = sales.reduce((acc, s) => acc + s.items.filter(i => i.productId === p.id).reduce((sum, i) => sum + i.quantity, 0), 0);
      const totalDays = Math.max(1, (Date.now() - (sales[0]?.timestamp || Date.now())) / (24 * 60 * 60 * 1000));
      const avgDaily = soldQty / totalDays;
      
      if (avgDaily > 0 && p.stock_qty > 0) {
        const daysLeft = Math.floor(p.stock_qty / avgDaily);
        if (daysLeft <= 3) {
          insights.push({
            type: 'danger',
            title: 'Stock finishing soon!',
            description: `Based on sales, your ${p.name} will finish in ${daysLeft} days. Restock now!`,
            icon: 'AlertCircle'
          });
        }
      }
    });

    // 4. Peak Hours
    const hourCounts: Record<number, number> = {};
    sales.forEach(s => {
      const hour = new Date(s.timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    const peakHour = Object.entries(hourCounts).sort(([, a], [, b]) => b - a)[0];
    if (peakHour) {
      const h = Number(peakHour[0]);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayHour = h % 12 || 12;
      insights.push({
        type: 'info',
        title: 'Peak Hours',
        description: `Your busiest time is around ${displayHour}${ampm}. Prepare more change and staff for this period.`,
        icon: 'Clock'
      });
    }

    // 5. Profitability Check
    let totalInterest = 0;
    const productMap = products.reduce((acc, p) => { acc[p.id!] = p; return acc; }, {} as Record<number, Product>);
    sales.forEach(s => {
      s.items.forEach(i => {
        const p = productMap[i.productId];
        if (p) totalInterest += (i.price - p.cost_price) * i.quantity;
      });
    });
    const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
    const net = totalInterest - totalExpenses;

    insights.push({
      type: net >= 0 ? 'success' : 'danger',
      title: 'Profitability Check',
      description: `You made ₦${totalInterest.toLocaleString()} gross profit but spent ₦${totalExpenses.toLocaleString()} on expenses. Your take-home is ₦${net.toLocaleString()}.`,
      icon: 'PiggyBank'
    });

    // 6. Security Audit (Transfers Today)
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const transfersToday = sales.filter(s => s.timestamp >= todayStart && (s.payment_method === 'transfer' || s.payment_method === 'Bank Transfer')).length;
    if (transfersToday > 0) {
      insights.push({
        type: 'info',
        title: 'Transfer Audit',
        description: `You accepted ${transfersToday} Transfers today. Ensure you have received exactly ${transfersToday} alerts in your bank app.`,
        icon: 'ShieldCheck'
      });
    }

    // 7. Inflation Suggestion
    const totalSales = sales.reduce((acc, s) => acc + s.total_amount, 0);
    if (totalSales > 0 && (totalInterest / totalSales) < 0.1) {
      insights.push({
        type: 'warning',
        title: 'Margin Alert',
        description: 'Your profit margin is low (under 10%). Consider using the Bulk Price Updater to add ₦50 to your provision items.',
        icon: 'Zap'
      });
    }

    return insights;
  }
}

export default new LocalInsightsEngine();
