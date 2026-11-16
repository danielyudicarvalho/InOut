using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InOut.Infrastructure.Identity.Migrations
{
    /// <inheritdoc />
    public partial class IdentitySecurityHardening : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "failed_attempts",
                schema: "identity",
                table: "login_tickets",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "security_stamp",
                schema: "identity",
                table: "login_tickets",
                type: "character varying(128)",
                maxLength: 128,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "failed_attempts",
                schema: "identity",
                table: "email_challenges",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "security_stamp",
                schema: "identity",
                table: "email_challenges",
                type: "character varying(128)",
                maxLength: 128,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "auth_attempts",
                schema: "identity",
                columns: table => new
                {
                    key = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    window_start = table.Column<long>(type: "bigint", nullable: false),
                    count = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_auth_attempts", x => new { x.key, x.window_start });
                });

            migrationBuilder.CreateTable(
                name: "browser_sessions",
                schema: "identity",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    session_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    purpose = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    csrf_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    access_token_protected = table.Column<string>(type: "text", nullable: true),
                    refresh_token_protected = table.Column<string>(type: "text", nullable: true),
                    pending_ticket_protected = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<long>(type: "bigint", nullable: false),
                    expires_at = table.Column<long>(type: "bigint", nullable: false),
                    access_expires_at = table.Column<long>(type: "bigint", nullable: true),
                    refresh_claimed_at = table.Column<long>(type: "bigint", nullable: true),
                    revoked_at = table.Column<long>(type: "bigint", nullable: true),
                    replaced_by_hash = table.Column<string>(type: "text", nullable: true),
                    security_stamp = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_browser_sessions", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_browser_sessions_session_hash",
                schema: "identity",
                table: "browser_sessions",
                column: "session_hash",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "auth_attempts",
                schema: "identity");

            migrationBuilder.DropTable(
                name: "browser_sessions",
                schema: "identity");

            migrationBuilder.DropColumn(
                name: "failed_attempts",
                schema: "identity",
                table: "login_tickets");

            migrationBuilder.DropColumn(
                name: "security_stamp",
                schema: "identity",
                table: "login_tickets");

            migrationBuilder.DropColumn(
                name: "failed_attempts",
                schema: "identity",
                table: "email_challenges");

            migrationBuilder.DropColumn(
                name: "security_stamp",
                schema: "identity",
                table: "email_challenges");
        }
    }
}
