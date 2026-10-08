import React, { useEffect, useState } from 'react';
import { CreditCard, TrendingUp, IndianRupee, ArrowDownRight, ArrowUpRight, Clock } from 'lucide-react';
import api from '@/lib/api';

export default function WalletPage() {
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWalletData() {
      try {
        const [walletRes, txRes] = await Promise.all([
          api.getWallet(),
          api.getWalletTransactions()
        ]);
        if (walletRes?.data) setWallet(walletRes.data);
        if (txRes?.data) setTransactions(txRes.data);
      } catch (err) {
        console.error("Failed to load wallet data", err);
      } finally {
        setLoading(false);
      }
    }
    fetchWalletData();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading wallet data...</div>;
  }

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1F1F1F]">Wallet & Earnings</h1>
          <p className="text-xs text-gray-500">Track your revenue, commissions, and available payouts.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
            <IndianRupee className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Available Balance</p>
            <h3 className="text-2xl font-extrabold text-[#1F1F1F]">{formatMoney(wallet?.balance)}</h3>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Pending Settlement</p>
            <h3 className="text-2xl font-extrabold text-[#1F1F1F]">{formatMoney(wallet?.pendingBalance)}</h3>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Earned</p>
            <h3 className="text-2xl font-extrabold text-[#1F1F1F]">{formatMoney(wallet?.totalEarned)}</h3>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-xs">
        <h2 className="text-lg font-bold text-[#1F1F1F] mb-4">Transaction History</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#E5E5E5] text-gray-400 font-bold uppercase tracking-wider text-xs">
                <th className="pb-3">Type</th>
                <th className="pb-3">Description</th>
                <th className="pb-3">Reference</th>
                <th className="pb-3">Date</th>
                <th className="pb-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E5]">
              {transactions.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-gray-500">No transactions found</td></tr>
              ) : (
                transactions.map((tx: any) => (
                  <tr key={tx._id} className="hover:bg-[#FAF9F7] transition-colors">
                    <td className="py-4">
                      {tx.type === 'CREDIT' ? (
                        <span className="inline-flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded text-xs font-bold">
                          <ArrowDownRight className="w-3 h-3" /> CREDIT
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded text-xs font-bold">
                          <ArrowUpRight className="w-3 h-3" /> DEBIT
                        </span>
                      )}
                    </td>
                    <td className="py-4 text-[#1F1F1F] max-w-[200px] truncate">{tx.description}</td>
                    <td className="py-4 text-gray-500 font-mono text-xs">{tx.referenceType}: {tx.referenceId}</td>
                    <td className="py-4 text-gray-500 text-xs">{new Date(tx.createdAt).toLocaleString()}</td>
                    <td className={`py-4 text-right font-bold ${tx.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.type === 'CREDIT' ? '+' : '-'}{formatMoney(tx.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
