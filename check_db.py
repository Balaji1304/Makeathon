import sys
import os

# add app to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.connection import SessionLocal
from app.database.models import Address

db = SessionLocal()
results = db.query(Address.address_id, Address.city, Address.country).all()

count_street = 0
for r in results:
    if r.country == 'street':
        count_street += 1
        print(f"ID: {r.address_id}, City: {r.city}, Country: {r.country}")
        
print(f"Total rows with country='street': {count_street}")
