from django.db.models import Count, Prefetch
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend

from accounts.permissions import IsTraveller, IsHost, IsAdmin
from utils.pagination import EightPerPagePagination

from .models import Complaint, ComplaintEvidence, ComplaintEvent, ComplaintStatus
from .permissions import IsComplaintFiler
from .serializers import (
    ComplaintCreateSerializer,
    ComplaintListSerializer,
    ComplaintDetailSerializer,
    ComplaintRespondentDetailSerializer,
    AdminComplaintDetailSerializer,
    EvidenceUploadSerializer,
    EvidenceReadSerializer,
    ResponseSubmitSerializer,
    ResponseReadSerializer,
    EventReadSerializer,
    AdminModerateSerializer,
    AdminSeveritySerializer,
    AdminOutcomeSerializer,
)
from .services.complaint_service import (
    create_complaint,
    submit_evidence,
    submit_response,
    admin_triage,
    admin_request_info,
    admin_send_to_respondent,
    admin_begin_review,
    admin_escalate,
    admin_retriage,
    admin_update_severity,
    admin_record_outcome,
    admin_close,
)
from utils.exceptions import ServiceError


# SHARED HELPERS
def _annotated_complaint_qs():
    """
    Base queryset with annotated counts to avoid N+1.
    """
    return (
        Complaint.objects
        .annotate(
            event_count=Count('events', distinct=True),
            evidence_count=Count('evidences', distinct=True),
        )
    )


def _detail_select_related():
    """
    select_related chain for detail views.
    """
    return (
        'booking', 'booking_item', 'booking_item__listing',
        'booking_item__package', 'filed_by',
        'listing', 'package', 'complaint_against_user',
    )


def _list_select_related():
    """
    select_related chain for list views using snapshot-backed target labels.
    """
    return (
        'booking_item', 'filed_by', 'listing', 'package',
    )


# TRAVELLER VIEWS

class TravellerComplaintListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/complaints/ — list own filed complaints

    POST /api/complaints/ — create new complaint
    """
    permission_classes = [IsAuthenticated, IsTraveller]
    pagination_class = EightPerPagePagination
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['category', 'status', 'severity']

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ComplaintCreateSerializer
        return ComplaintListSerializer
    
    def get_queryset(self):
        return (
            _annotated_complaint_qs()
            .filter(filed_by=self.request.user)
            .select_related(*_list_select_related())
        )
    
    def create(self, request, *args, **kwargs):
        serializer = ComplaintCreateSerializer(
            data=request.data, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        complaint = create_complaint(request.user, serializer.validated_data)
        output = ComplaintDetailSerializer(complaint, context={'request': request})
        return Response(output.data, status=status.HTTP_201_CREATED)


class TravellerComplaintDetailView(generics.RetrieveAPIView):
    """
    GET /api/complaints/{pk}/ — detail of complaint I filed
    """
    permission_classes = [IsAuthenticated, IsTraveller, IsComplaintFiler]
    serializer_class = ComplaintDetailSerializer

    def get_queryset(self):
        return (
            Complaint.objects
            .filter(filed_by=self.request.user)
            .select_related(*_detail_select_related())
            .prefetch_related(
                Prefetch('evidences', queryset=ComplaintEvidence.objects.select_related('uploaded_by')),
                Prefetch('events', queryset=ComplaintEvent.objects.select_related('actor')),
            )
        )
    

class TravellerEvidenceListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/complaints/{complaint_id}/evidence/ — list evidence
    POST /api/complaints/{complaint_id}/evidence/ — upload evidence
    """
    permission_classes = [IsAuthenticated, IsTraveller]
    pagination_class = None  # evidence lists are typically small

    # Statuses where evidence upload is blocked
    _UPLOAD_BLOCKED_STATUSES = {
        ComplaintStatus.RESOLVED,
        ComplaintStatus.REJECTED,
        ComplaintStatus.CLOSED,
    }

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return EvidenceUploadSerializer
        return EvidenceReadSerializer

    def _get_complaint(self):
        return get_object_or_404(
            Complaint,
            pk=self.kwargs['complaint_id'],
            filed_by=self.request.user,
        )

    def get_queryset(self):
        complaint = self._get_complaint()
        return complaint.evidences.select_related('uploaded_by').all()

    def create(self, request, *args, **kwargs):
        complaint = self._get_complaint()
        if complaint.status in self._UPLOAD_BLOCKED_STATUSES:
            return Response(
                {'detail': 'Cannot upload evidence for a complaint that is resolved, rejected, or closed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = EvidenceUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        evidence = submit_evidence(
            complaint, request.user,
            serializer.validated_data['file'],
            serializer.validated_data.get('description', ''),
        )
        return Response(
            EvidenceReadSerializer(evidence).data,
            status=status.HTTP_201_CREATED,
        )


# TRAVELLER AS RESPONDENT

class TravellerReceivedComplaintListView(generics.ListAPIView):
    """
    GET /api/complaints/received/ — complaints filed against me
    """
    permission_classes = [IsAuthenticated, IsTraveller]
    serializer_class = ComplaintListSerializer
    pagination_class = EightPerPagePagination
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['category', 'status', 'severity']

    def get_queryset(self):
        return (
            _annotated_complaint_qs()
            .filter(
                complaint_against_user=self.request.user,
                status__in=[
                    ComplaintStatus.AWAITING_RESPONDENT,
                    ComplaintStatus.UNDER_REVIEW,
                    ComplaintStatus.ESCALATED,
                    ComplaintStatus.RESOLVED,
                    ComplaintStatus.REJECTED,
                    ComplaintStatus.CLOSED,
                ],
            )
            .select_related(*_list_select_related())
        )


class TravellerReceivedComplaintDetailView(generics.RetrieveAPIView):
    """
    GET /api/complaints/received/{pk}/  — detail of complaint against me

    No object-level IsComplaintRespondent permission — queryset filters by complaint_against_user AND status, so non-visible complaints return 404 (not 403).
    """
    permission_classes = [IsAuthenticated, IsTraveller]
    serializer_class = ComplaintRespondentDetailSerializer

    def get_queryset(self):
        return (
            Complaint.objects
            .filter(
                complaint_against_user=self.request.user,
                status__in=[
                    ComplaintStatus.AWAITING_RESPONDENT,
                    ComplaintStatus.UNDER_REVIEW,
                    ComplaintStatus.ESCALATED,
                    ComplaintStatus.RESOLVED,
                    ComplaintStatus.REJECTED,
                    ComplaintStatus.CLOSED,
                ],
            )
            .select_related(*_detail_select_related())
            .prefetch_related(
                Prefetch('evidences', queryset=ComplaintEvidence.objects.select_related('uploaded_by')),
            )
        )


class TravellerRespondView(APIView):
    """
    POST /api/complaints/received/{pk}/respond/   — submit response as respondent

    Filters by status=AWAITING_RESPONDENT so that the respondent cannot discover a complaint's existence before it has been forwarded to them (404 not 400).
    """
    permission_classes = [IsAuthenticated, IsTraveller]

    def post(self, request, pk):
        complaint = get_object_or_404(
            Complaint,
            pk=pk,
            complaint_against_user=request.user,
            status=ComplaintStatus.AWAITING_RESPONDENT,
        )
        serializer = ResponseSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        response = submit_response(
            complaint, request.user, serializer.validated_data['body'],
        )
        return Response(
            ResponseReadSerializer(response).data,
            status=status.HTTP_201_CREATED,
        )


class TravellerRespondentEvidenceListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/complaints/received/{complaint_id}/evidence/ — see evidence

    POST /api/complaints/received/{complaint_id}/evidence/ — upload counter-evidence
    """
    permission_classes = [IsAuthenticated, IsTraveller]
    pagination_class = None

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return EvidenceUploadSerializer
        return EvidenceReadSerializer

    def _get_complaint(self):
        complaint = get_object_or_404(
            Complaint,
            pk=self.kwargs['complaint_id'],
            complaint_against_user=self.request.user,
            status__in=[
                ComplaintStatus.AWAITING_RESPONDENT,
                ComplaintStatus.UNDER_REVIEW,
                ComplaintStatus.ESCALATED,
                ComplaintStatus.RESOLVED,
                ComplaintStatus.REJECTED,
                ComplaintStatus.CLOSED,
            ],
        )
        return complaint

    def _get_visible_evidence(self, complaint):
        qs = complaint.evidences.select_related('uploaded_by')
        if complaint.is_sensitive:
            qs = qs.filter(uploaded_by=self.request.user)
        return qs.all()

    def get_queryset(self):
        complaint = self._get_complaint()
        return self._get_visible_evidence(complaint)

    def create(self, request, *args, **kwargs):
        complaint = self._get_complaint()
        if complaint.status in {ComplaintStatus.RESOLVED, ComplaintStatus.REJECTED, ComplaintStatus.CLOSED}:
            return Response(
                {'detail': 'Cannot upload evidence for a complaint that is resolved, rejected, or closed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = EvidenceUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        evidence = submit_evidence(
            complaint, request.user,
            serializer.validated_data['file'],
            serializer.validated_data.get('description', ''),
        )
        return Response(
            EvidenceReadSerializer(evidence).data,
            status=status.HTTP_201_CREATED,
        )


# HOST VIEWS
class HostComplaintListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/host/complaints/ — list own filed complaints

    POST /api/host/complaints/ — create new complaint
    """
    permission_classes = [IsAuthenticated, IsHost]
    pagination_class = EightPerPagePagination
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['category', 'status', 'severity']

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ComplaintCreateSerializer
        return ComplaintListSerializer

    def get_queryset(self):
        return (
            _annotated_complaint_qs()
            .filter(filed_by=self.request.user)
            .select_related(*_list_select_related())
        )

    def create(self, request, *args, **kwargs):
        serializer = ComplaintCreateSerializer(
            data=request.data, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        complaint = create_complaint(request.user, serializer.validated_data)
        output = ComplaintDetailSerializer(complaint, context={'request': request})
        return Response(output.data, status=status.HTTP_201_CREATED)


class HostComplaintDetailView(generics.RetrieveAPIView):
    """
    GET /api/host/complaints/{pk}/ — detail of complaint I filed
    """
    permission_classes = [IsAuthenticated, IsHost, IsComplaintFiler]
    serializer_class = ComplaintDetailSerializer

    def get_queryset(self):
        return (
            Complaint.objects
            .filter(filed_by=self.request.user)
            .select_related(*_detail_select_related())
            .prefetch_related(
                Prefetch('evidences', queryset=ComplaintEvidence.objects.select_related('uploaded_by')),
                Prefetch('events', queryset=ComplaintEvent.objects.select_related('actor')),
            )
        )


class HostEvidenceListCreateView(generics.ListCreateAPIView):
    """
    GET /api/host/complaints/{complaint_id}/evidence/

    POST /api/host/complaints/{complaint_id}/evidence/
    """
    permission_classes = [IsAuthenticated, IsHost]
    pagination_class = None

    _UPLOAD_BLOCKED_STATUSES = {
        ComplaintStatus.RESOLVED,
        ComplaintStatus.REJECTED,
        ComplaintStatus.CLOSED,
    }

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return EvidenceUploadSerializer
        return EvidenceReadSerializer

    def _get_complaint(self):
        return get_object_or_404(
            Complaint,
            pk=self.kwargs['complaint_id'],
            filed_by=self.request.user,
        )

    def get_queryset(self):
        complaint = self._get_complaint()
        return complaint.evidences.select_related('uploaded_by').all()

    def create(self, request, *args, **kwargs):
        complaint = self._get_complaint()
        if complaint.status in self._UPLOAD_BLOCKED_STATUSES:
            return Response(
                {'detail': 'Cannot upload evidence for a complaint that is resolved, rejected, or closed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = EvidenceUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        evidence = submit_evidence(
            complaint, request.user,
            serializer.validated_data['file'],
            serializer.validated_data.get('description', ''),
        )
        return Response(
            EvidenceReadSerializer(evidence).data,
            status=status.HTTP_201_CREATED,
        )


# HOST AS RESPONDENT 
class HostReceivedComplaintListView(generics.ListAPIView):
    """
    GET /api/host/complaints/received/ — complaints filed against me
    """
    permission_classes = [IsAuthenticated, IsHost]
    serializer_class = ComplaintListSerializer
    pagination_class = EightPerPagePagination
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['category', 'status', 'severity']

    def get_queryset(self):
        return (
            _annotated_complaint_qs()
            .filter(
                complaint_against_user=self.request.user,
                status__in=[
                    ComplaintStatus.AWAITING_RESPONDENT,
                    ComplaintStatus.UNDER_REVIEW,
                    ComplaintStatus.ESCALATED,
                    ComplaintStatus.RESOLVED,
                    ComplaintStatus.REJECTED,
                    ComplaintStatus.CLOSED,
                ],
            )
            .select_related(*_list_select_related())
        )

class HostReceivedComplaintDetailView(generics.RetrieveAPIView):
    """
    GET /api/host/complaints/received/{pk}/

    Queryset filters by complaint_against_user AND status so non-visible complaints return 404 (not 403).
    """
    permission_classes = [IsAuthenticated, IsHost]
    serializer_class = ComplaintRespondentDetailSerializer

    def get_queryset(self):
        return (
            Complaint.objects
            .filter(
                complaint_against_user=self.request.user,
                status__in=[
                    ComplaintStatus.AWAITING_RESPONDENT,
                    ComplaintStatus.UNDER_REVIEW,
                    ComplaintStatus.ESCALATED,
                    ComplaintStatus.RESOLVED,
                    ComplaintStatus.REJECTED,
                    ComplaintStatus.CLOSED,
                ],
            )
            .select_related(*_detail_select_related())
            .prefetch_related(
                Prefetch('evidences', queryset=ComplaintEvidence.objects.select_related('uploaded_by')),
            )
        )


class HostRespondView(APIView):
    """
    POST /api/host/complaints/received/{pk}/respond/

    Filters by status=AWAITING_RESPONDENT for 404 privacy.
    """
    permission_classes = [IsAuthenticated, IsHost]

    def post(self, request, pk):
        complaint = get_object_or_404(
            Complaint,
            pk=pk,
            complaint_against_user=request.user,
            status=ComplaintStatus.AWAITING_RESPONDENT,
        )
        serializer = ResponseSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        response = submit_response(
            complaint, request.user, serializer.validated_data['body'],
        )
        return Response(
            ResponseReadSerializer(response).data,
            status=status.HTTP_201_CREATED,
        )


class HostRespondentEvidenceListCreateView(generics.ListCreateAPIView):
    """
    GET /api/host/complaints/received/{complaint_id}/evidence/ — see evidence
    POST /api/host/complaints/received/{complaint_id}/evidence/   — upload counter-evidence
    """
    permission_classes = [IsAuthenticated, IsHost]
    pagination_class = None

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return EvidenceUploadSerializer
        return EvidenceReadSerializer

    def _get_complaint(self):
        complaint = get_object_or_404(
            Complaint,
            pk=self.kwargs['complaint_id'],
            complaint_against_user=self.request.user,
            status__in=[
                ComplaintStatus.AWAITING_RESPONDENT,
                ComplaintStatus.UNDER_REVIEW,
                ComplaintStatus.ESCALATED,
                ComplaintStatus.RESOLVED,
                ComplaintStatus.REJECTED,
                ComplaintStatus.CLOSED,
            ],
        )
        return complaint

    def _get_visible_evidence(self, complaint):
        qs = complaint.evidences.select_related('uploaded_by')
        if complaint.is_sensitive:
            qs = qs.filter(uploaded_by=self.request.user)
        return qs.all()

    def get_queryset(self):
        complaint = self._get_complaint()
        return self._get_visible_evidence(complaint)

    def create(self, request, *args, **kwargs):
        complaint = self._get_complaint()
        if complaint.status in {ComplaintStatus.RESOLVED, ComplaintStatus.REJECTED, ComplaintStatus.CLOSED}:
            return Response(
                {'detail': 'Cannot upload evidence for a complaint that is resolved, rejected, or closed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = EvidenceUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        evidence = submit_evidence(
            complaint, request.user,
            serializer.validated_data['file'],
            serializer.validated_data.get('description', ''),
        )
        return Response(
            EvidenceReadSerializer(evidence).data,
            status=status.HTTP_201_CREATED,
        )


# ADMIN VIEWS

class AdminComplaintListView(generics.ListAPIView):
    """
    GET /api/admin/complaints/
    """
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = ComplaintListSerializer
    pagination_class = EightPerPagePagination
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['category', 'status', 'severity', 'filed_by_role']

    def get_queryset(self):
        return (
            _annotated_complaint_qs()
            .select_related(*_list_select_related())
        )


class AdminComplaintDetailView(generics.RetrieveAPIView):
    """
    GET /api/admin/complaints/{pk}/
    """
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = AdminComplaintDetailSerializer

    def get_queryset(self):
        return (
            Complaint.objects
            .select_related(*_detail_select_related())
            .prefetch_related(
                Prefetch('evidences', queryset=ComplaintEvidence.objects.select_related('uploaded_by')),
                Prefetch('events', queryset=ComplaintEvent.objects.select_related('actor')),
            )
        )


class AdminModerateView(APIView):
    """
    POST /api/admin/complaints/{pk}/moderate/

    Action-based moderation (matches ReviewModerateSerializer pattern).
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        complaint = get_object_or_404(
            Complaint.objects.select_related(*_detail_select_related()), pk=pk,
        )
        serializer = AdminModerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        action = serializer.validated_data['action']
        note = serializer.validated_data.get('note', '')
        summary = serializer.validated_data.get('summary_for_respondent', '')

        action_map = {
            'triage': lambda: admin_triage(complaint, request.user, note),
            'request_info': lambda: admin_request_info(complaint, request.user, note),
            'send_to_respondent': lambda: admin_send_to_respondent(complaint, request.user, summary),
            'begin_review': lambda: admin_begin_review(complaint, request.user),
            'escalate': lambda: admin_escalate(complaint, request.user, note),
            'retriage': lambda: admin_retriage(complaint, request.user, note),
            'close': lambda: admin_close(complaint, request.user),
        }

        handler = action_map.get(action)
        if not handler:
            return Response(
                {'detail': f"Unknown action: {action}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        handler() 
        complaint.refresh_from_db()
        output = AdminComplaintDetailSerializer(complaint, context={'request': request})
        return Response(output.data)


class AdminSeverityView(APIView):
    """
    PATCH /api/admin/complaints/{pk}/severity/
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def patch(self, request, pk):
        complaint = get_object_or_404(Complaint, pk=pk)
        serializer = AdminSeveritySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        admin_update_severity(
            complaint, request.user,
            serializer.validated_data['severity'],
            serializer.validated_data.get('reason', ''),
        )
        complaint.refresh_from_db()
        output = AdminComplaintDetailSerializer(complaint, context={'request': request})
        return Response(output.data)


class AdminOutcomeView(APIView):
    """
    POST /api/admin/complaints/{pk}/record-outcome/
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        complaint = get_object_or_404(Complaint, pk=pk)
        serializer = AdminOutcomeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        admin_record_outcome(
            complaint, request.user,
            serializer.validated_data['outcome'],
            serializer.validated_data['resolution_note'],
            serializer.validated_data.get('protective_action', ''),
        )
        complaint.refresh_from_db()
        output = AdminComplaintDetailSerializer(complaint, context={'request': request})
        return Response(output.data)
    

class AdminEventListView(generics.ListAPIView):
    """
    GET /api/admin/complaints/{complaint_id}/events/
    """
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = EventReadSerializer
    pagination_class = None

    def get_queryset(self):
        complaint = get_object_or_404(Complaint, pk=self.kwargs['complaint_id'])
        return complaint.events.select_related('actor').all()
    
