from datetime import datetime, timezone
import time

# Define base epoch as January 1, 2025 00:00:00 UTC
BASE_EPOCH = datetime(2025, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
BASE_EPOCH_TIMESTAMP = int(BASE_EPOCH.timestamp())

def datetime_to_epoch_ms(dt):
    """
    Convert a datetime object to milliseconds since our custom epoch (Jan 1, 2025)
    Returns an integer representing milliseconds
    """
    if dt is None:
        return None
    
    # Ensure the datetime is timezone-aware
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
        
    # Calculate milliseconds since our base epoch
    return int((dt.timestamp() - BASE_EPOCH_TIMESTAMP) * 1000)

def epoch_ms_to_datetime(epoch_ms):
    """
    Convert milliseconds since our custom epoch back to a datetime object
    """
    if epoch_ms is None:
        return None
    
    # Convert milliseconds to seconds and add to our base epoch timestamp
    timestamp = BASE_EPOCH_TIMESTAMP + (epoch_ms / 1000)
    return datetime.fromtimestamp(timestamp, tz=timezone.utc)

def now_epoch_ms():
    """
    Get the current time as milliseconds since our custom epoch
    """
    return datetime_to_epoch_ms(datetime.now(timezone.utc))