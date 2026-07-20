'use client';

import React from 'react';

export default function PaymentSettingsPage() {
  const razorpayKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Payment Gateway Settings</h1>
        <p className="text-sm text-gray-600 mt-1">
          Configure payment gateway credentials and settings
        </p>
      </div>

      <div className="grid gap-6">
        {/* Razorpay Settings */}
        <div className="border rounded-lg p-6 bg-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M22.436 0l-11.91 7.773-1.174 4.276 6.625-4.297L11.65 24h4.391l6.395-24z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold">Razorpay</h2>
              <p className="text-sm text-gray-600">Indian payment gateway</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Key ID
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={razorpayKeyId || 'Not configured'}
                  readOnly
                  className="flex-1 px-3 py-2 border rounded-lg bg-gray-50 text-sm font-mono"
                />
                <span className={`px-3 py-2 rounded-lg text-sm font-medium ${
                  razorpayKeyId ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {razorpayKeyId ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Configuration</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Test Mode: Enabled</li>
                <li>• Supported: Cards, UPI, NetBanking, Wallets</li>
                <li>• Currency: INR</li>
                <li>• Webhook: Configured</li>
              </ul>
            </div>
          </div>
        </div>


        {/* Test Cards */}
        <div className="border rounded-lg p-6 bg-white">
          <h2 className="text-lg font-semibold mb-4">Test Cards</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Razorpay Test Cards</h3>
              <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-600">Card Number:</span>
                  <span>4111 1111 1111 1111</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">CVV:</span>
                  <span>Any 3 digits</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Expiry:</span>
                  <span>Any future date</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">OTP:</span>
                  <span>1234</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Test UPI</h3>
              <div className="bg-gray-50 rounded-lg p-3 text-sm font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-600">UPI ID:</span>
                  <span>success@razorpay</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
