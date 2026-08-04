import mongoose from 'mongoose';

const tenantUsageSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, unique: true, index: true },
    totalTokens: { type: Number, default: 0 },
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    totalRequests: { type: Number, default: 0 },
    
    // Capped array of recent request timestamps (last 2000 max) for time-window calculations
    recentRequests: [
      {
        timestamp: { type: Date, default: Date.now, index: true },
      },
    ],
  },
  { timestamps: true }
);

export const TenantUsage = mongoose.model('TenantUsage', tenantUsageSchema);
