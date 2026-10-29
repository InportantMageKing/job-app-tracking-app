from django.db import transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import ResumeVersion


@receiver(post_delete, sender=ResumeVersion)
def delete_stored_file(sender, instance, **kwargs):
    """Remove the uploaded file whenever its row goes, however it was deleted.

    That covers the API, the admin, and cascades from deleting a user. The file is only
    removed once the transaction commits, so a rolled-back delete keeps its file.
    """
    if instance.file:
        storage, name = instance.file.storage, instance.file.name
        transaction.on_commit(lambda: storage.delete(name))
