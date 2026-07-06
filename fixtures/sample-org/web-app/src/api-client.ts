// @acme/web-app calls the billing service over HTTP (service-to-service).
export async function charge(amountCents: number): Promise<boolean> {
  const res = await fetch('/api/charge', {
    method: 'POST',
    body: JSON.stringify({ amountCents }),
  });
  const data = await res.json();
  return data.charged === true;
}

export async function loadInvoices(): Promise<unknown[]> {
  const res = await fetch('/api/invoices');
  return res.json();
}
