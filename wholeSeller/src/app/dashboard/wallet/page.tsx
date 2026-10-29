import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, TrendingUp, IndianRupee, ArrowDownRight, ArrowUpRight, Clock } from 'lucide-react';
import api from '@/lib/api';
import { useWholesaler } from '@/context/WholesalerContext';
import { wholesalerQueryKeys } from '@/lib/query-client';

export default function WalletPage() {
  const { profile } = useWholesaler();
  const walletQuery = useQuery({
    queryKey: wholesalerQueryKeys.resource(profile.id || 'unknown', 'wallet'),
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const [walletRes, txRes] = await Promise.all([
        api.getWallet(),
        api.getWalletTransactions(),
      ]);
      return { wallet: walletRes?.data ?? null, transactions: txRes?.data ?? [] };
    },
    enabled: Boolean(profile.id),
  });
  const wallet = walletQuery.data?.wallet;
  const transactions = walletQuery.data?.transactions ?? [];
  const loading = walletQuery.isLoading;

  useEffect(() => {
    if (walletQuery.error) console.error("Failed to load wallet data", walletQuery.error);
  }, [walletQuery.error]);

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
          <h1 className="text-2xl font-extrabold text-tradeflow-navy">Wallet & Earnings</h1>
          <p className="text-xs text-gray-500">Track your revenue, commissions, and available payouts.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-tradeflow-gray-200 p-6 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
            <IndianRupee className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Available Balance</p>
            <h3 className="text-2xl font-extrabold text-tradeflow-navy">{formatMoney(wallet?.availableBalance)}</h3>
            <p className="mt-1 text-xs text-gray-500">Released earnings after payouts and pending requests.</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-tradeflow-gray-200 p-6 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Pending Settlement</p>
            <h3 className="text-2xl font-extrabold text-tradeflow-navy">{formatMoney(wallet?.pendingBalance)}</h3>
            <p className="mt-1 text-xs text-gray-500">Earnings awaiting settlement or held for a return.</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-tradeflow-gray-200 p-6 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Earned</p>
            <h3 className="text-2xl font-extrabold text-tradeflow-navy">{formatMoney(wallet?.totalEarned)}</h3>
            <p className="mt-1 text-xs text-gray-500">Order earnings after commission and refunds.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-tradeflow-gray-200 p-6 shadow-xs">
        <h2 className="text-lg font-bold text-tradeflow-navy mb-4">Transaction History</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-tradeflow-gray-200 text-gray-400 font-bold uppercase tracking-wider text-xs">
                <th className="pb-3">Type</th>
                <th className="pb-3">Description</th>
                <th className="pb-3">Reference</th>
                <th className="pb-3">Date</th>
                <th className="pb-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-tradeflow-gray-200">
              {transactions.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-gray-500">No transactions found</td></tr>
              ) : (
                transactions.map((tx: any) => (
                  <tr key={tx._id} className="hover:bg-tradeflow-gray-50 transition-colors">
                    <td className="py-4">
                      {tx.type === 'CREDIT' ? (
                        <span className="inline-flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded text-xs font-bold">
                          <ArrowDownRight className="w-3 h-3" /> CREDIT
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-gray-700 bg-gray-100 px-2 py-1 rounded text-xs font-bold">
                          <ArrowUpRight className="w-3 h-3" /> DEBIT
                        </span>
                      )}
                    </td>
                    <td className="py-4 text-tradeflow-navy max-w-[200px] truncate">{tx.description}</td>
                    <td className="py-4 text-gray-500 font-mono text-xs">{tx.referenceType}: {tx.referenceId}</td>
                    <td className="py-4 text-gray-500 text-xs">{new Date(tx.createdAt).toLocaleString()}</td>
                    <td className={`py-4 text-right font-bold ${tx.type === 'CREDIT' ? 'text-green-600' : 'text-gray-700'}`}>
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
