from django.contrib import admin

from .models import ResumeVersion


@admin.register(ResumeVersion)
class ResumeVersionAdmin(admin.ModelAdmin):
    list_display = ["name", "user", "original_filename", "created_at"]
    exclude = ["file"]
    readonly_fields = ["original_filename"]

    def has_add_permission(self, request):
        # Uploads go through the API so validation and naming rules always apply.
        return False
