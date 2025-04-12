from django.shortcuts import render
from rest_framework.decorators import action
from rest_framework import viewsets, status
from rest_framework.response import Response
from .models import File, calculate_file_hash, FileReference
from .serializers import FileSerializer, FileReferenceSerializer
from django.db.models import F, ExpressionWrapper, BigIntegerField, Sum
from django.db.models.functions import Coalesce
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.pagination import PageNumberPagination
from django_filters import rest_framework as filters
import logging
from .date_time_util import datetime_to_epoch_ms, BASE_EPOCH_TIMESTAMP

logger = logging.getLogger(__name__)

# Create your views here.
class FilesPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 50

class FileFilter(filters.FilterSet):
    # Search by filename with case-insensitive contains
    filename = filters.CharFilter(field_name='original_filename', lookup_expr='icontains')
    
    # Size range filters
    min_size = filters.NumberFilter(field_name='reference_file__size', lookup_expr='gte')
    max_size = filters.NumberFilter(field_name='reference_file__size', lookup_expr='lte')
    
    # Filter by file type (exact match)
    file_type = filters.CharFilter(method='filter_file_types')
    def filter_file_types(self, queryset, name, value):
        """
        Filter files by multiple file types using OR operation
        value comes as comma-separated string of file types
        """
        if not value:
            return queryset
            
        file_types = value.split(',')
        if file_types:
            # Use Q objects to create OR condition
            from django.db.models import Q
            file_type_query = Q()
            for file_type in file_types:
                file_type_query |= Q(reference_file__file_type=file_type)
            return queryset.filter(file_type_query)
        return queryset

    # Add direct epoch filter parameters
    date_after_epoch = filters.NumberFilter(method='filter_after_epoch')
    date_before_epoch = filters.NumberFilter(method='filter_before_epoch')
    
    def filter_after_epoch(self, queryset, name, value):
        # Convert date to datetime at start of day, then to epoch ms
        if value:
            # JavaScript timestamp is milliseconds since 1970-01-01
            # Our custom epoch is milliseconds since 2025-01-01
            # Need to subtract the difference to convert
            custom_epoch_ms = value - (BASE_EPOCH_TIMESTAMP * 1000)
            return queryset.filter(uploaded_at_epoch__gte=custom_epoch_ms)
        return queryset
    
    def filter_before_epoch(self, queryset, name, value):
        # Convert date to datetime at end of day, then to epoch ms
        if value:
            # JavaScript timestamp is milliseconds since 1970-01-01
            # Our custom epoch is milliseconds since 2025-01-01
            # Need to subtract the difference to convert
            custom_epoch_ms = value - (BASE_EPOCH_TIMESTAMP * 1000)
            return queryset.filter(uploaded_at_epoch__lte=custom_epoch_ms)
        return queryset
    
    class Meta:
        model = FileReference
        fields = ['filename', 'min_size', 'max_size', 'file_type', 'date_after_epoch', 'date_before_epoch']

class FileViewSet(viewsets.ModelViewSet):
    # Update the ordering to use the new epoch field
    queryset = FileReference.objects.all()
    serializer_class = FileReferenceSerializer
    pagination_class = FilesPagination
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = FileFilter
    search_fields = ['original_filename', 'reference_file__file_type']
    ordering_fields = ['uploaded_at_epoch', 'original_filename', 'reference_file__size']
    ordering = ['-uploaded_at_epoch']  # Default ordering updated

    def create(self, request, *args, **kwargs):
        # Check file size before uploading (10MB = 10 * 1024 * 1024 bytes)
        file_obj = request.FILES.get('file')
        
        if not file_obj:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check file size limit (10MB)
        MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB in bytes
        if file_obj.size > MAX_FILE_SIZE:
            return Response(
                {'error': f'Maximum file size allowed is 10MB. Your file is {file_obj.size / (1024 * 1024):.2f}MB'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        file_hash = calculate_file_hash(file_obj) if file_obj else None

        if file_hash is None:
            return Response({'error': 'Could not calculate file hash'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # File exists, just create a new reference
            unique_file = File.objects.get(file_hash=file_hash)
            file_reference = FileReference.objects.create(
                reference_file=unique_file,
                original_filename=file_obj.name,
            )
            return Response(
                FileReferenceSerializer(file_reference).data,
                status=status.HTTP_201_CREATED
            )
        except File.DoesNotExist:
            # This is a new unique file
            unique_file = File.objects.create(
                file_hash=file_hash,
                file=file_obj,
                file_type=file_obj.content_type,
                size=file_obj.size,
                reference_count=0,
                original_filename=file_obj.name
            )            
            # Create a reference to this file
            file_reference = FileReference.objects.get(
                reference_file=unique_file,
            )
            return Response(
                FileReferenceSerializer(file_reference).data,
                status=status.HTTP_201_CREATED
            )
    
    def list(self, request, *args, **kwargs):
        # Log query parameters for debugging
        logger.debug(f"Query parameters: {request.query_params}")
        
        # Clean up query parameters
        if hasattr(request.query_params, '_mutable'):
            request.query_params._mutable = True
            for param in ['min_size', 'max_size']:
                if param in request.query_params and request.query_params[param] in ['null', 'undefined', '']:
                    del request.query_params[param]
            request.query_params._mutable = False
        
        # Apply filters
        queryset = self.filter_queryset(self.get_queryset())
        
        # Apply pagination
        page = self.paginate_queryset(queryset)
        
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
            
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
        
    @action(detail=False, methods=['GET'])
    def storage_stats(self, request):
        """
        Get storage statistics including total space saved through deduplication.
        Returns:
            - total_files: Number of unique files
            - total_references: Number of file references
            - total_size: Total size of unique files
            - total_space_saved: Space saved through deduplication
        """
        space_saved = File.objects.aggregate(
            saved=Sum(
                ExpressionWrapper(
                    F('size') * (F('reference_count') - 1),
                    output_field=BigIntegerField()
                )
            )
        )['saved'] or 0
        stats = {
            'total_files': File.objects.count(),
            'total_references': FileReference.objects.count(),
            'total_size': File.objects.aggregate(
                total=Coalesce(Sum('size'), 0)
            )['total'],
            'total_space_saved': space_saved,
        }
            
        # Convert bytes to more readable format
        stats['total_size_readable'] = self._format_size(stats['total_size'])
        stats['total_space_saved_readable'] = self._format_size(stats['total_space_saved'])
        
        return Response(stats)
    
    @action(detail=False, methods=['GET'])
    def file_types(self, request):
        """Get all unique file types for filtering"""
        # Get unique file types by accessing through the relationship
        file_types = FileReference.objects.values_list(
            'reference_file__file_type', flat=True
        ).distinct().order_by('reference_file__file_type')
        
        return Response({"file_types": list(file_types)})
    
    def _format_size(self, size_in_bytes):
        """Convert bytes to human readable format"""
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size_in_bytes < 1024:
                return f"{size_in_bytes:.2f} {unit}"
            size_in_bytes /= 1024
        return f"{size_in_bytes:.2f} PB"
