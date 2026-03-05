import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.connection import SessionLocal
from app.database.models import Address

db = SessionLocal()
results = db.query(Address.address_id, Address.city, Address.country).limit(50).all()

for r in results:
    if 'street' in str(r.city).lower() or 'street' in str(r.country).lower() or 'улица' in str(r.city).lower():
        print(f"ID: {r.address_id}, City: {r.city}, Country: {r.country}")
