# Quentin Project Stability Guide

To maintain a 100% stable system for commercial use, follow these "Lockdown" rules:

## 1. Zero-Error Deployment (Implemented)
We have added a **Git Guard**. You cannot push code to GitHub anymore unless it passes a full `npm run build` locally. This prevents "broken builds" from ever hitting your production site.

## 2. Infrastructure Protection (Implemented)
- **API Rate Limiting**: Added protection against bots/spam. Each IP address is limited to 5 registrations per hour. This protects your database from being flooded and keeps your Vercel/Firebase costs safe.
- **Strict Timeouts**: All database operations are now guarded by a 5-8 second timeout. The system will never "hang" indefinitely.

## 3. Data Integrity (Implemented)
- **Dual-Database Strategy**: Every user is saved to BOTH Vercel Postgres and Firebase Firestore.
- **Smart Merging**: The Admin panel automatically merges duplicates so you see a clean list, while keeping backups in both locations.

## 4. Recommendations for "Locking"
- **Environment Variables**: Never share your `.env.local` file. It contains the "keys" to your factory.
- **Vercel Pro / Firebase Blaze**: If you expect more than 5,000 users, ensure you are on the paid tiers to avoid "Usage Limit" shutdowns.
- **Alerts**: Enable "Deployment Error" notifications in your Vercel Dashboard settings.
- **Backups**: Standard in your current plans, but once a month, use the "Download CSV" button in the Admin for an offline backup.

**The system is currently in a "Green State" (All tests passing, Guards active).**
