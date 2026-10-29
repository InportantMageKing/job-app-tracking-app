from django.db import migrations


class Migration(migrations.Migration):
    """Make usernames unique regardless of case at the database level.

    The signup serializer already rejects case-insensitive duplicates, but two concurrent
    signups can both pass that check; this index makes the second insert fail instead.
    """

    dependencies = [("auth", "0012_alter_user_first_name_max_length")]

    operations = [
        migrations.RunSQL(
            sql="CREATE UNIQUE INDEX accounts_username_upper_uniq ON auth_user (UPPER(username));",
            reverse_sql="DROP INDEX accounts_username_upper_uniq;",
        ),
    ]
