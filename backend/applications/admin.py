from django.contrib import admin

from .models import Application, ApplicationEvent


class ApplicationEventInline(admin.TabularInline):
    model = ApplicationEvent
    extra = 0
    can_delete = False
    readonly_fields = ["event_type", "from_status", "to_status", "note", "created_at"]


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ["company", "job_title", "user", "current_status", "date_applied"]
    list_filter = ["current_status", "source"]
    search_fields = ["company", "job_title"]
    readonly_fields = ["current_status"]
    inlines = [ApplicationEventInline]

    def has_add_permission(self, request):
        # Creation must go through the service layer so the first event is written.
        return False
