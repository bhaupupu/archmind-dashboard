// @acme/billing-svc HTTP routes — exposes the billing API other services call.
import express from 'express';

export const router = express.Router();

router.post('/api/charge', (req, res) => {
  res.json({ charged: true });
});

router.get('/api/invoices', (req, res) => {
  res.json({ invoices: [] });
});
