from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import transaction
from files.models import File, FileReference, calculate_file_hash, file_upload_path
import hashlib
import os

class FileModelTests(TestCase):
    def setUp(self):
        pass


    def test_calculate_file_hash(self):
        """Test that calculate_file_hash correctly computes a SHA-256 hash"""
        # Create sample file content
        file_content = b'This is a test file content'
        
        # Compute expected hash manually
        expected_hash = hashlib.sha256(file_content).hexdigest()
        
        # Create a SimpleUploadedFile
        test_file = SimpleUploadedFile(
            name='test.txt',
            content=file_content,
            content_type='text/plain'
        )
        
        # Calculate hash using our function
        calculated_hash = calculate_file_hash(test_file)
        
        # Assert the hashes match
        self.assertEqual(calculated_hash, expected_hash)
        
        # Assert that the file pointer is reset to position 0
        self.assertEqual(test_file.tell(), 0)
    
    def test_file_reference_deletion_decrements_reference_count(self):
        """Test that when a FileReference is deleted, the File's reference_count is decremented"""
        # Create a test file
        file_content = b'This is another test file'
        test_file = SimpleUploadedFile(
            name='test_decrement.txt',
            content=file_content,
            content_type='text/plain'
        )
        
        # Create File instance
        file_obj = File.objects.create(
            file_hash=calculate_file_hash(test_file),
            file=test_file,
            file_type='text/plain',
            size=len(file_content),
            reference_count=0  
        )
        
        # Create two FileReference instances
        ref1 = FileReference.objects.create(
            reference_file=file_obj,
            original_filename='file1.txt',
        )
        
        ref2 = FileReference.objects.create(
            reference_file=file_obj,
            original_filename='file2.txt',
        )
        
        # Delete one reference
        ref1.delete()
        
        # Refresh our file object from the database
        file_obj.refresh_from_db()
        
        # Check that reference count is decremented
        self.assertEqual(file_obj.reference_count, 2)
    
    def test_file_deletion_when_reference_count_reaches_zero(self):
        """Test that when the last FileReference is deleted, the File is also deleted"""
        # Create a test file
        file_content = b'This is a test file for deletion'
        test_file = SimpleUploadedFile(
            name='test_deletion.txt',
            content=file_content,
            content_type='text/plain'
        )
        
        # Create File instance
        file_obj = File.objects.create(
            file_hash=calculate_file_hash(test_file),
            file=test_file,
            file_type='text/plain',
            size=len(file_content),
            reference_count=0  # Start with reference count of 1
        )
        
        # Store the file ID
        file_id = file_obj.id
        
        # Create a FileReference instance
        ref = FileReference.objects.get(
            reference_file=file_obj,
        )
        
        # Delete the reference
        ref.delete()
        
        # Check that the File is also deleted
        with self.assertRaises(File.DoesNotExist):
            File.objects.get(id=file_id)

    def test_create_file(self):
        """Test if we can create a File object"""
        test_file = SimpleUploadedFile(
            name='test.txt',
            content=b'test content test_create_file',
            content_type='text/plain'
        )
        
        # Create a File instance
        file_obj = File.objects.create(
            file_hash=calculate_file_hash(test_file),
            file=test_file,
            file_type='text/plain',
            size=len(b'test content'),
            reference_count=0
        )
        self.assertEqual(file_obj.file_hash, calculate_file_hash(test_file))
        self.assertEqual(file_obj.file_type, 'text/plain')
        self.assertEqual(file_obj.size, len(b'test content'))
        self.assertEqual(file_obj.reference_count, 1)

    def test_create_file_reference(self):
        """Test if we can create a FileReference object"""

        test_file = SimpleUploadedFile(
            name='test.txt',
            content=b'test content test_create_file_reference',
            content_type='text/plain'
        )
        
        # Create a File instance
        file_obj = File.objects.create(
            file_hash=calculate_file_hash(test_file),
            file=test_file,
            file_type='text/plain',
            size=len(b'test content'),
            reference_count=1
        )

        file_ref = FileReference.objects.create(
            reference_file=file_obj,
            original_filename='original.txt'
        )
        
        self.assertEqual(file_ref.original_filename, 'original.txt')
        self.assertEqual(file_ref.reference_file, file_obj)
        
        