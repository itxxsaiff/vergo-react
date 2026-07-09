<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class DatabaseBackupService
{
    private const DIRECTORY = 'database-backups';

    public function list(): array
    {
        return collect(Storage::files(self::DIRECTORY))
            ->filter(fn (string $path) => str_ends_with($path, '.sql'))
            ->map(fn (string $path) => [
                'name' => basename($path),
                'path' => $path,
                'size' => Storage::size($path),
                'created_at' => date('Y-m-d H:i:s', Storage::lastModified($path)),
            ])
            ->sortByDesc('created_at')
            ->values()
            ->all();
    }

    public function create(): array
    {
        $connection = DB::connection();
        $driver = $connection->getDriverName();
        $database = $connection->getDatabaseName();
        $timestamp = now()->format('Y-m-d_H-i-s');
        $fileName = "vergo-db-backup-{$timestamp}.sql";
        $path = self::DIRECTORY.'/'.$fileName;

        $sql = match ($driver) {
            'mysql', 'mariadb' => $this->createMysqlDump(),
            'sqlite' => $this->createSqliteDump(),
            default => throw new RuntimeException("Database backup is not supported for {$driver}."),
        };

        Storage::put($path, $sql);

        return [
            'name' => $fileName,
            'path' => $path,
            'database' => $database,
            'size' => Storage::size($path),
            'created_at' => now()->toDateTimeString(),
        ];
    }

    public function storeUploadedBackup(UploadedFile $file): array
    {
        $originalName = preg_replace('/[^A-Za-z0-9._-]/', '-', $file->getClientOriginalName());
        $fileName = now()->format('Y-m-d_H-i-s').'-'.$originalName;
        $path = $file->storeAs(self::DIRECTORY, $fileName);

        return [
            'name' => basename($path),
            'path' => $path,
            'size' => Storage::size($path),
            'created_at' => now()->toDateTimeString(),
        ];
    }

    public function restore(string $fileName): void
    {
        $path = $this->resolveBackupPath($fileName);
        $sql = Storage::get($path);

        DB::connection()->unprepared($sql);
    }

    public function delete(string $fileName): void
    {
        Storage::delete($this->resolveBackupPath($fileName));
    }

    public function resolveBackupPath(string $fileName): string
    {
        $safeFileName = basename($fileName);
        $path = self::DIRECTORY.'/'.$safeFileName;

        if (! Storage::exists($path)) {
            throw new RuntimeException('Backup file not found.');
        }

        return $path;
    }

    private function createMysqlDump(): string
    {
        $connection = DB::connection();
        $pdo = $connection->getPdo();
        $database = $connection->getDatabaseName();
        $tables = collect($connection->select('SHOW FULL TABLES'))
            ->map(fn (object $row) => array_values((array) $row))
            ->filter(fn (array $row) => ($row[1] ?? '') === 'BASE TABLE')
            ->pluck(0)
            ->values();

        $sql = [];
        $sql[] = '-- Vergo database backup';
        $sql[] = '-- Database: '.$database;
        $sql[] = '-- Created at: '.now()->toDateTimeString();
        $sql[] = 'SET FOREIGN_KEY_CHECKS=0;';
        $sql[] = 'SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";';
        $sql[] = '';

        foreach ($tables as $table) {
            $quotedTable = $this->quoteIdentifier($table);
            $createRow = (array) $connection->selectOne('SHOW CREATE TABLE '.$quotedTable);
            $createSql = $createRow['Create Table'] ?? array_values($createRow)[1] ?? null;

            if (! $createSql) {
                continue;
            }

            $sql[] = 'DROP TABLE IF EXISTS '.$quotedTable.';';
            $sql[] = $createSql.';';
            $sql[] = '';

            $rows = $connection->table($table)->get();

            foreach ($rows as $row) {
                $values = collect((array) $row)
                    ->map(fn ($value) => $this->quoteValue($value, $pdo))
                    ->implode(', ');

                $columns = collect(array_keys((array) $row))
                    ->map(fn (string $column) => $this->quoteIdentifier($column))
                    ->implode(', ');

                $sql[] = 'INSERT INTO '.$quotedTable.' ('.$columns.') VALUES ('.$values.');';
            }

            $sql[] = '';
        }

        $sql[] = 'SET FOREIGN_KEY_CHECKS=1;';
        $sql[] = '';

        return implode(PHP_EOL, $sql);
    }

    private function createSqliteDump(): string
    {
        $connection = DB::connection();
        $pdo = $connection->getPdo();
        $tables = collect($connection->select("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"))
            ->values();

        $sql = [];
        $sql[] = '-- Vergo database backup';
        $sql[] = '-- Created at: '.now()->toDateTimeString();
        $sql[] = 'PRAGMA foreign_keys=OFF;';
        $sql[] = 'BEGIN TRANSACTION;';
        $sql[] = '';

        foreach ($tables as $tableInfo) {
            $table = $tableInfo->name;
            $quotedTable = $this->quoteIdentifier($table);

            $sql[] = 'DROP TABLE IF EXISTS '.$quotedTable.';';
            $sql[] = rtrim($tableInfo->sql, ';').';';
            $sql[] = '';

            $rows = $connection->table($table)->get();

            foreach ($rows as $row) {
                $values = collect((array) $row)
                    ->map(fn ($value) => $this->quoteValue($value, $pdo))
                    ->implode(', ');

                $columns = collect(array_keys((array) $row))
                    ->map(fn (string $column) => $this->quoteIdentifier($column))
                    ->implode(', ');

                $sql[] = 'INSERT INTO '.$quotedTable.' ('.$columns.') VALUES ('.$values.');';
            }

            $sql[] = '';
        }

        $sql[] = 'COMMIT;';
        $sql[] = 'PRAGMA foreign_keys=ON;';
        $sql[] = '';

        return implode(PHP_EOL, $sql);
    }

    private function quoteIdentifier(string $identifier): string
    {
        $driver = DB::connection()->getDriverName();
        $quote = $driver === 'sqlite' ? '"' : '`';

        return $quote.str_replace($quote, $quote.$quote, $identifier).$quote;
    }

    private function quoteValue(mixed $value, \PDO $pdo): string
    {
        if ($value === null) {
            return 'NULL';
        }

        if (is_bool($value)) {
            return $value ? '1' : '0';
        }

        if (is_int($value) || is_float($value)) {
            return (string) $value;
        }

        return $pdo->quote((string) $value);
    }
}
