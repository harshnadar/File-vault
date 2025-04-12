from rest_framework import serializers
from .models import File, FileReference
from .date_time_util import epoch_ms_to_datetime

class FileSerializer(serializers.ModelSerializer):
    class Meta:
        model = File
        fields = ['id', 'file_hash','file', 'file_type', 'size']
        read_only_fields = ['id'] 

class FileReferenceSerializer(serializers.ModelSerializer):
    file = serializers.FileField(source='reference_file.file', read_only=True)
    file_type = serializers.CharField(source='reference_file.file_type', read_only=True)
    size = serializers.IntegerField(source='reference_file.size', read_only=True)
    uploaded_at = serializers.SerializerMethodField()
    
    class Meta:
        model = FileReference
        fields = [
            'id',  
            'uploaded_at', 
            'file', 
            'file_type', 
            'size',
            'original_filename'
        ]
        read_only_fields = ['id', 'uploaded_at']

    def get_uploaded_at(self, obj):
        """Convert the epoch timestamp to ISO format datetime string"""
        dt = epoch_ms_to_datetime(obj.uploaded_at_epoch)
        if dt:
            return dt.isoformat()
        return None