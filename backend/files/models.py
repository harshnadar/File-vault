import uuid
import os
import hashlib
from venv import logger
from django.utils import timezone
from django.db import models, transaction
from django.db.models.signals import pre_delete, post_save, post_delete
from django.dispatch import receiver
from .date_time_util import now_epoch_ms


"""
    Creating multiple tables because, otherwise we'll have to store the metadata multiple times, 
    since we're using sha256 for hash, it's 256 bits, i.e., 32 bytes, which is a lot of space.
    And considering
"""
def calculate_file_hash(file):
    """Calculate MD5 hash for a file."""
    hash_func = hashlib.sha256()
    for chunk in file.chunks():
        hash_func.update(chunk)
    file.seek(0)  # Reset file pointer to the beginning to prevent from any data-loss/error in figuring out the hash
    return hash_func.hexdigest()

def file_upload_path(instance, filename):
    """Generate file path for new file upload"""
    
    """Using slicing to create folders for better organization in the blob"""
    extension = os.path.splitext(filename)[1].lower()
    return os.path.join(
        'uploads',
        instance.file_hash[:4],
        instance.file_hash[4:8],
        instance.file_hash + extension
    )

#class for unique files that we have found till now
class File(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    file_hash = models.CharField(max_length=32, unique=True, db_index=True, default=uuid.uuid4)
    file = models.FileField(upload_to=file_upload_path)
    file_type = models.CharField(max_length=100)
    size = models.BigIntegerField(db_index=True)
    reference_count = models.PositiveIntegerField(default=0)

    temp_original_filename = None  # Class attribute for temporary storage
    
    def __init__(self, *args, **kwargs):
        # Extract original_filename if provided in kwargs
        self.temp_original_filename = kwargs.pop('original_filename', None)
        super().__init__(*args, **kwargs)
    
    class Meta:
        ordering = ['-size']
    
    def __str__(self):
        return self.file_hash
    
    @property
    def total_size_saved(self):
        """Calculate storage saved through deduplication"""
        if(self.reference_count == 0):
            return 0
        return self.size * (self.reference_count - 1)
    

@receiver(post_save, sender=File)
def create_initial_file_reference(sender, instance, created, **kwargs):
    """
    Create an initial FileReference when a new File is created.
    This ensures every File has at least one reference.
    """
    if created:  # Only create reference if this is a new File
        try:
            # Use the stored original filename if available, otherwise fallback to file path
            original_filename = instance.temp_original_filename or instance.file.name.split('/')[-1]
                
            # Create the reference
            with transaction.atomic():
                FileReference.objects.create(
                    reference_file=instance,
                    original_filename=original_filename
                )
        except Exception as e:
            print(f"Error creating initial file reference: {e}")
            # You might want to delete the File if reference creation fails
            instance.delete()
            raise


class FileReference(models.Model):
    """Model to track all file uploads, including duplicates."""
    reference_file = models.ForeignKey(File, on_delete=models.CASCADE, related_name='references')
    original_filename = models.CharField(max_length=255, db_index=True)
    uploaded_at_epoch = models.BigIntegerField(default=now_epoch_ms, db_index=True)
    
    class Meta:
        ordering = ['-uploaded_at_epoch']
        
    
    def __str__(self):
        return self.original_filename
    
    def save(self, *args, **kwargs):
        """Override save to handle reference count increment"""
        is_new = self._state.adding  # Check if this is a new instance
        if is_new:  # Only increment if this is a new reference
            with transaction.atomic():
                self.reference_file.reference_count += 1
                self.reference_file.save()
        super().save(*args, **kwargs)
    
@receiver(post_delete, sender=FileReference)
def update_file_reference_count(sender, instance, **kwargs):
    """
    Decrement the reference count when a FileReference is deleted.
    If reference count becomes zero, delete the File and its physical file.
    """
    with transaction.atomic():
        file = instance.reference_file
        
        # Store file information before any changes
        file_path = file.file.path if file.file else None
        file_hash = file.file_hash
        
        # Decrement reference count
        file.reference_count -= 1
        
        if file.reference_count <= 0:
            try:
                # First delete the physical file if it exists
                if file_path and os.path.exists(file_path):
                    os.remove(file_path)
                    
                    # Clean up empty directories
                    directory = os.path.dirname(file_path)
                    while directory.endswith(('uploads', file_hash[:4], file_hash[4:8])):
                        try:
                            if os.path.exists(directory) and not os.listdir(directory):
                                os.rmdir(directory)
                            directory = os.path.dirname(directory)
                        except OSError:
                            break
                
                # Now delete the File instance
                File.objects.filter(id=file.id).delete()
                
            except Exception as e:
                logger.error(f"Error cleaning up file {file_hash}: {e}")
                raise  # Re-raise to trigger transaction rollback
        else:
            # Just save the updated reference count
            file.save(update_fields=['reference_count'])