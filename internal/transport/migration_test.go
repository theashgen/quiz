package transport

import (
	"context"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

func TestMigrationRoundTripAndConcurrentUpgrade(t *testing.T) {
	s := openIntegrationStore(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	dir := filepath.Join("..", "..", "migrations")
	migrationDB := stdlib.OpenDBFromPool(s.DB)
	defer migrationDB.Close()
	provider, err := goose.NewProvider(goose.DialectPostgres, migrationDB, os.DirFS(dir))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := provider.UpTo(ctx, 2); err != nil {
		t.Fatal(err)
	}
	if _, err := provider.DownTo(ctx, 0); err != nil {
		t.Fatal(err)
	}
	if _, err := provider.UpTo(ctx, 2); err != nil {
		t.Fatal(err)
	}

	// Recreate the database state left by the original runner.
	seedSession(t, s, "existing-player")
	if _, err := s.DB.Exec(ctx, `
		INSERT INTO accounts (id, name, email, role, password_hash, player_id)
		VALUES ('existing-account', 'Teacher', 'teacher@example.com', 'teacher', 'hash', 'existing-player');
		DROP TABLE goose_db_version;
		CREATE TABLE schema_migrations (version text PRIMARY KEY);
		INSERT INTO schema_migrations VALUES ('001_initial.sql'), ('002_accounts.sql');
	`); err != nil {
		t.Fatal(err)
	}

	var group sync.WaitGroup
	for range 4 {
		group.Go(func() {
			if err := s.Migrate(ctx, dir); err != nil {
				t.Error(err)
			}
		})
	}
	group.Wait()

	account, err := s.Queries().GetAccountByEmail(ctx, "teacher@example.com")
	if err != nil {
		t.Fatal(err)
	}
	if account.ID != "existing-account" || account.PlayerID != "existing-player" {
		t.Fatalf("existing account changed: %+v", account)
	}

	var versions []int64
	if err := s.DB.QueryRow(ctx, `
		SELECT array_agg(version_id ORDER BY version_id)
		FROM goose_db_version WHERE is_applied AND version_id IN (1, 2)
	`).Scan(&versions); err != nil {
		t.Fatal(err)
	}
	if len(versions) != 2 || versions[0] != 1 || versions[1] != 2 {
		t.Fatalf("expected migrations 1 and 2 to be recorded once, got %v", versions)
	}
}
