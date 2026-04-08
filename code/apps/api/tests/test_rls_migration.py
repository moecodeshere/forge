from pathlib import Path


def test_rls_migration_contains_owner_checks() -> None:
    migration_path = (
        Path(__file__).resolve().parents[3] / "supabase" / "migrations" / "002_rls.sql"
    )
    sql = migration_path.read_text(encoding="utf-8")

    assert "auth.uid() = user_id" in sql
    assert "checkpoints_select_own" in sql
    assert "deployments_insert_own" in sql
