from rest_framework import viewsets


class OwnedByUserViewSet(viewsets.ModelViewSet):
    """A ModelViewSet that can only ever see the requesting user's rows.

    Subclasses set `queryset` to the full model queryset; `get_queryset` narrows it.
    Another user's object is indistinguishable from a missing one, so it returns 404.
    """

    owner_field = "user"
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return super().get_queryset().filter(**{self.owner_field: self.request.user})

    def perform_create(self, serializer):
        serializer.save(**{self.owner_field: self.request.user})
