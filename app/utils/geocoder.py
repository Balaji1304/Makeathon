import logging
import time
from typing import Optional

from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError
from sqlalchemy.orm import Session

from app.database.connection import SessionLocal
from app.database.models import Address

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Cache to avoid hitting API repeatedly for the same city/country
geocode_cache = {}

def get_coordinates(city: str, country: str) -> Optional[tuple[float, float]]:
    cache_key = f"{city},{country}"
    if cache_key in geocode_cache:
        return geocode_cache[cache_key]

    geolocator = Nominatim(user_agent="greentrack_makeathon_geocoder")
    query = f"{city}, {country}"
    
    try:
        # Rate limiting adherence per Nominatim rules (1 req/sec)
        time.sleep(1.1)
        location = geolocator.geocode(query, timeout=10)
        
        if location:
            logger.info(f"Geocoded -> {query}: [{location.latitude}, {location.longitude}]")
            coords = (location.latitude, location.longitude)
            geocode_cache[cache_key] = coords
            return coords
        else:
            logger.warning(f"Could not geocode '{query}' - Location not found.")
            geocode_cache[cache_key] = None
            return None
            
    except (GeocoderTimedOut, GeocoderServiceError) as e:
        logger.error(f"Geocoding error for '{query}': {e}")
        return None

def populate_address_coordinates(session: Session):
    logger.info("Fetching null-coordinate addresses from database...")
    
    # Query all addresses that don't have lat/long yet
    addresses = session.query(Address).filter(
        (Address.latitude == None) | (Address.longitude == None)
    ).all()
    
    if not addresses:
        logger.info("All addresses already have coordinates. Nothing to do!")
        return

    logger.info(f"Found {len(addresses)} addresses needing coordinates.")
    
    updates_count = 0
    for address in addresses:
        if not address.city or not address.country:
            logger.debug(f"Skipping Address ID {address.address_id} - Missing City/Country")
            continue
            
        coords = get_coordinates(address.city, address.country)
        if coords:
            address.latitude, address.longitude = coords
            updates_count += 1
            
        # Commit in batches to save progress
        if updates_count > 0 and updates_count % 50 == 0:
            session.commit()
            logger.info(f"Committed {updates_count} address coordinate updates.")

    # Final commit
    if updates_count > 0:
        session.commit()
        logger.info(f"Finished! Successfully geocoded {updates_count} addresses total.")
    else:
        logger.info("Finished. No new coordinates found.")


if __name__ == "__main__":
    db = SessionLocal()
    try:
        populate_address_coordinates(db)
    finally:
        db.close()
