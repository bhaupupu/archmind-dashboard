# Sample Python file for the ingestion spike fixture.
# Contains a PLANTED FAKE SECRET (not a real credential).

import hashlib

password = "hunter2hunter2"  # planted: generic-assigned-secret


class Invoice:
    def __init__(self, customer_id: str, amount_cents: int) -> None:
        self.customer_id = customer_id
        self.amount_cents = amount_cents

    def checksum(self) -> str:
        raw = f"{self.customer_id}:{self.amount_cents}"
        return hashlib.sha256(raw.encode()).hexdigest()


def total_cents(invoices: list[Invoice]) -> int:
    return sum(i.amount_cents for i in invoices)


def format_amount(cents: int) -> str:
    return f"${cents / 100:.2f}"
