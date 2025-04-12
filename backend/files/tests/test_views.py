from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from files.models import File, FileReference
from django.core.files.uploadedfile import SimpleUploadedFile

class FileViewTests(TestCase):
    def setUp(self):
        """Set up test data"""
        self.client = APIClient()
        self.test_file = SimpleUploadedFile(
            name='test.txt',
            content=b'test content',
            content_type='text/plain'
        )
        
        # Create a File instance
        self.file_obj = File.objects.create(
            file_hash='testhash123',
            file=self.test_file,
            file_type='text/plain',
            size=len(b'test content'),
            reference_count=1
        )
        
        # Create a FileReference
        self.file_ref = FileReference.objects.create(
            reference_file=self.file_obj,
            original_filename='test.txt'
        )

    def test_list_files(self):
        """Test getting list of files"""
        response = self.client.get('/api/files/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 2)

    def test_get_storage_stats(self):
        """Test getting storage statistics"""
        response = self.client.get('/api/files/storage_stats/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('total_files', response.data)
        self.assertIn('total_references', response.data)

    def test_deleting_file(self):
        """Test deleting a file"""
        response = self.client.delete(f'/api/files/{self.file_ref.id}/')
        self.assertEqual(response.status_code, 204)
        